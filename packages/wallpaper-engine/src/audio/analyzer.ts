import type {
  AudioFrameAnalysis,
  WritableAudioFrameAnalysis,
} from './frame';
import { writeAudioFrameAnalysis } from './frame';

const CHANNEL_LENGTH = 64;
const BAND_COUNT = 3;
const BASS_END = 6;
const MIDRANGE_END = 24;
const DEFAULT_DELTA_SECONDS = 1 / 30;
const BASELINE_TIME_CONSTANT = 0.4;
const MIN_BPM = 40;
const MAX_BPM = 240;
const BPM_ESTIMATE_SMOOTHING = 0.25;
const BPM_TIMEOUT_SECONDS = 4;
const BPM_PRIOR_WIDTH_OCTAVES = 1.2;
const BPM_TRACKING_PRIOR_WIDTH_OCTAVES = 0.7;
const BPM_FAST_LAG_PREFERENCE = 0.15;
const TEMPO_SAMPLE_RATE = 30;
const TEMPO_WINDOW_FRAMES = TEMPO_SAMPLE_RATE * 8;
const TEMPO_MIN_HISTORY_FRAMES = TEMPO_SAMPLE_RATE * 4;
const TEMPO_ESTIMATE_INTERVAL_FRAMES = TEMPO_SAMPLE_RATE / 2;
const TEMPO_CANDIDATE_COARSE_STEP_BPM = 1;
const TEMPO_CANDIDATE_FINE_STEP_BPM = 0.25;
const TEMPO_CANDIDATE_FINE_RADIUS_BPM = 1;
const TEMPO_HARMONIC_COUNT = 4;
const TEMPO_ONSET_BASELINE_SECONDS = 0.5;
const TEMPO_MIN_ONSET = 0.002;
const TEMPO_MIN_PERIODICITY = 0.25;
const TEMPO_TRANSITION_MIN_PERIODICITY = 0.4;
const TEMPO_PRIMARY_CORRELATION_WEIGHT = 0.1;
const TEMPO_OCTAVE_CORRECTION_MIN_BPM = 60;
const TEMPO_OCTAVE_CORRECTION_MAX_BPM = 90;
const TEMPO_OCTAVE_CORRECTION_MIN_CORRELATION = 0.15;
const TEMPO_OCTAVE_ALIGNMENT_TOLERANCE = 0.1;
const TEMPO_CANDIDATE_CONFIRMATIONS = 3;
const TEMPO_CANDIDATE_MATCH_TOLERANCE = 0.05;
const TEMPO_TRANSITION_CONFIRMATIONS = 6;
const TEMPO_TRACKING_UPDATE_TOLERANCE = 0.1;

function validateDeltaSeconds(deltaSeconds: number): void {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError(
      'Audio analyzer deltaSeconds must be a finite non-negative number.',
    );
  }
}

/**
 * Controls the sensitivity, retrigger delay, and loudness-envelope decay of an
 * audio analyzer.
 *
 * @example
 * const options: AudioAnalyzerOptions = {
 *   sensitivity: 0.8,
 *   eventCooldown: 0.1,
 *   peakDecayPerSecond: 2,
 * };
 */
export interface AudioAnalyzerOptions {
  /** Detector sensitivity from 0 (strictest) to 1 (most sensitive). */
  sensitivity?: number;
  /** Minimum seconds before the same spectrum band can trigger again. */
  eventCooldown?: number;
  /** Normalized units removed from the decaying peak each second. */
  peakDecayPerSecond?: number;
}

/**
 * Stateful loudness and spectrum-transient analyzer for Wallpaper Engine's
 * 128-sample stereo audio callback.
 *
 * Kick, clap, and hi-hat values are spectrum-based estimates rather than
 * source separation. Event fields describe only the most recently processed
 * frame.
 *
 * @example
 * const analyzer = createAudioAnalyzer();
 * window.wallpaperRegisterAudioListener((audioArray) => {
 *   analyzer.process(audioArray);
 *   if (analyzer.beat > 0) pulse(analyzer.beat);
 * });
 */
export interface AudioAnalyzer extends AudioFrameAnalysis {
  /** Peak magnitude held and linearly decayed between frames. */
  readonly decayingPeakVolume: number;
  /** Estimated low-spectrum kick transient strength from 0 to 1. */
  readonly kick: number;
  /** Estimated mid/high-spectrum clap transient strength from 0 to 1. */
  readonly clap: number;
  /** Estimated high-spectrum hi-hat transient strength from 0 to 1. */
  readonly hiHat: number;
  /** Maximum kick or clap strength for the current frame. */
  readonly beat: number;
  /**
   * Smoothed 40–240 BPM estimate from onset-envelope autocorrelation, or zero
   * until enough periodic history is available.
   */
  readonly bpm: number;
  /** Strongest detected spectrum-band transient for the current frame. */
  readonly onset: number;
  /** Analyze one frame, optionally using its measured elapsed time. */
  process: (audioArray: ArrayLike<number>, deltaSeconds?: number) => void;
  /** Clear all accumulated analysis state while preserving options. */
  reset: () => void;
}

class AudioAnalyzerImpl implements AudioAnalyzer, WritableAudioFrameAnalysis {
  averageVolume = 0;
  rmsVolume = 0;
  peakVolume = 0;
  leftVolume = 0;
  rightVolume = 0;
  stereoBalance = 0;
  bass = 0;
  midrange = 0;
  treble = 0;
  decayingPeakVolume = 0;
  kick = 0;
  clap = 0;
  hiHat = 0;
  beat = 0;
  bpm = 0;
  onset = 0;

  private readonly currentSpectrum = new Float64Array(CHANNEL_LENGTH);
  private readonly previousSpectrum = new Float64Array(CHANNEL_LENGTH);
  private readonly bandFlux = new Float64Array(BAND_COUNT);
  private readonly adaptiveMean = new Float64Array(BAND_COUNT);
  private readonly adaptiveDeviation = new Float64Array(BAND_COUNT);
  private readonly cooldown = new Float64Array(BAND_COUNT);
  private readonly active = new Uint8Array(BAND_COUNT);
  private readonly strength = new Float64Array(BAND_COUNT);
  private readonly tempoOnsetHistory = new Float64Array(TEMPO_WINDOW_FRAMES);
  private readonly sensitivity: number;
  private readonly eventCooldown: number;
  private readonly peakDecayPerSecond: number;
  private warmUpFrames = 0;
  private bpmEstimate = 0;
  private tempoWriteIndex = 0;
  private tempoHistoryCount = 0;
  private tempoFramesSinceEstimate = 0;
  private tempoCandidate = 0;
  private tempoCandidateConfirmations = 0;
  private tempoSilenceSeconds = 0;
  private tempoFluxBaseline = 0;
  private tempoFlux = 0;

  constructor(
    sensitivity: number,
    eventCooldown: number,
    peakDecayPerSecond: number,
  ) {
    this.sensitivity = sensitivity;
    this.eventCooldown = eventCooldown;
    this.peakDecayPerSecond = peakDecayPerSecond;
  }

  private updateDecayingPeak(deltaSeconds: number): void {
    this.decayingPeakVolume = Math.max(
      this.peakVolume,
      Math.max(
        0,
        this.decayingPeakVolume
        - this.peakDecayPerSecond * deltaSeconds,
      ),
    );
  }

  private clearCurrentEvents(): void {
    this.kick = 0;
    this.clap = 0;
    this.hiHat = 0;
    this.beat = 0;
    this.onset = 0;
    this.tempoFlux = 0;
    this.bandFlux.fill(0);
    this.active.fill(0);
    this.strength.fill(0);
  }

  private updateBandFlux(): void {
    for (let bin = 0; bin < CHANNEL_LENGTH; bin++) {
      const current = this.currentSpectrum[bin]!;
      const previous = this.previousSpectrum[bin]!;
      const flux = Math.max(0, current - previous);
      this.tempoFlux += Math.max(
        0,
        Math.log1p(current) - Math.log1p(previous),
      );
      this.previousSpectrum[bin] = current;

      if (bin < BASS_END)
        this.bandFlux[0]! += flux;
      else if (bin < MIDRANGE_END)
        this.bandFlux[1]! += flux;
      else
        this.bandFlux[2]! += flux;
    }

    this.bandFlux[0]! /= BASS_END;
    this.bandFlux[1]! /= MIDRANGE_END - BASS_END;
    this.bandFlux[2]! /= CHANNEL_LENGTH - MIDRANGE_END;
    this.tempoFlux /= CHANNEL_LENGTH;
  }

  private getBandEnergy(band: number): number {
    if (band === 0)
      return this.bass;
    if (band === 1)
      return this.midrange;
    return this.treble;
  }

  private updateBandDetectors(
    deltaSeconds: number,
    warmingUp: boolean,
  ): void {
    const thresholdMultiplier = 3.1 - this.sensitivity * 1.9;
    const minimumFlux = 0.055 - this.sensitivity * 0.045;
    const minimumEnergy = 0.11 - this.sensitivity * 0.09;
    const alpha = 1 - Math.exp(-deltaSeconds / BASELINE_TIME_CONSTANT);

    for (let band = 0; band < BAND_COUNT; band++) {
      this.cooldown[band] = Math.max(
        0,
        this.cooldown[band]! - deltaSeconds,
      );

      const mean = this.adaptiveMean[band]!;
      const deviation = this.adaptiveDeviation[band]!;
      const threshold = Math.max(
        minimumFlux,
        mean
        + thresholdMultiplier
        * Math.max(deviation, minimumFlux * 0.25),
      );
      const flux = this.bandFlux[band]!;

      if (
        !warmingUp
        && this.cooldown[band] === 0
        && this.getBandEnergy(band) >= minimumEnergy
        && flux > threshold
      ) {
        this.active[band] = 1;
        this.strength[band] = Math.min(1, flux / (threshold * 2));
        this.cooldown[band] = this.eventCooldown;
      }

      const learningFlux = Math.min(flux, threshold * 1.5);
      const updatedMean = mean + alpha * (learningFlux - mean);
      this.adaptiveMean[band] = updatedMean;
      this.adaptiveDeviation[band]
        = deviation
          + alpha * (Math.abs(learningFlux - updatedMean) - deviation);
    }
  }

  private classifyEvents(): void {
    const lowFlux = this.bandFlux[0]!;
    const midFlux = this.bandFlux[1]!;
    const highFlux = this.bandFlux[2]!;

    if (
      this.active[0] !== 0
      && lowFlux >= midFlux * 0.5
      && lowFlux >= highFlux * 0.35
    ) {
      this.kick = this.strength[0]!;
    }

    const clapDetected
      = this.active[1] !== 0
        && this.active[2] !== 0
        && midFlux >= highFlux * 0.35
        && highFlux >= midFlux * 0.35
        && midFlux + highFlux >= lowFlux * 1.15;

    if (clapDetected) {
      this.clap = Math.min(this.strength[1]!, this.strength[2]!);
    }
    else if (
      this.active[2] !== 0
      && highFlux >= midFlux * 1.5
      && highFlux >= lowFlux * 1.5
    ) {
      this.hiHat = this.strength[2]!;
    }

    this.beat = Math.max(this.kick, this.clap);
    this.onset = Math.max(
      this.strength[0]!,
      this.strength[1]!,
      this.strength[2]!,
    );
  }

  private alignBpmToEstimate(candidate: number): number {
    if (this.bpmEstimate === 0)
      return candidate;

    let aligned = candidate;
    let distance = Math.abs(candidate - this.bpmEstimate);
    const maximumAlignmentDistance
      = this.bpmEstimate * TEMPO_OCTAVE_ALIGNMENT_TOLERANCE;
    const doubled = candidate * 2;
    if (doubled <= MAX_BPM) {
      const doubledDistance = Math.abs(doubled - this.bpmEstimate);
      if (
        doubledDistance < distance
        && doubledDistance <= maximumAlignmentDistance
      ) {
        aligned = doubled;
        distance = doubledDistance;
      }
    }

    const halved = candidate / 2;
    const halvedDistance = Math.abs(halved - this.bpmEstimate);
    if (
      halved >= MIN_BPM
      && halvedDistance < distance
      && halvedDistance <= maximumAlignmentDistance
    ) {
      aligned = halved;
    }
    return aligned;
  }

  private clearBpmEstimate(): void {
    this.bpm = 0;
    this.bpmEstimate = 0;
    this.tempoOnsetHistory.fill(0);
    this.tempoWriteIndex = 0;
    this.tempoHistoryCount = 0;
    this.tempoFramesSinceEstimate = 0;
    this.tempoCandidate = 0;
    this.tempoCandidateConfirmations = 0;
    this.tempoSilenceSeconds = 0;
    this.tempoFluxBaseline = 0;
  }

  private getTempoOnset(position: number): number {
    const oldestIndex
      = this.tempoWriteIndex
        - this.tempoHistoryCount
        + TEMPO_WINDOW_FRAMES;
    return this.tempoOnsetHistory[
      (oldestIndex + position) % TEMPO_WINDOW_FRAMES
    ]!;
  }

  private calculateTempoMean(): number {
    let total = 0;
    for (let frame = 0; frame < this.tempoHistoryCount; frame++)
      total += this.getTempoOnset(frame);
    return total / this.tempoHistoryCount;
  }

  private calculateTempoCorrelation(lag: number, mean: number): number {
    const firstFrame = Math.ceil(lag);
    const pairCount = this.tempoHistoryCount - firstFrame;
    let correlation = 0;
    let leadingEnergy = 0;
    let laggingEnergy = 0;
    for (
      let frame = firstFrame;
      frame < this.tempoHistoryCount;
      frame++
    ) {
      const laggingPosition = frame - lag;
      const lowerFrame = Math.floor(laggingPosition);
      const fraction = laggingPosition - lowerFrame;
      const lowerOnset = this.getTempoOnset(lowerFrame);
      const upperOnset = this.getTempoOnset(
        Math.min(lowerFrame + 1, this.tempoHistoryCount - 1),
      );
      const leading = this.getTempoOnset(frame) - mean;
      const lagging
        = lowerOnset + (upperOnset - lowerOnset) * fraction - mean;
      correlation += leading * lagging;
      leadingEnergy += leading * leading;
      laggingEnergy += lagging * lagging;
    }
    const normalization = Math.sqrt(leadingEnergy * laggingEnergy);
    return pairCount > 0 && normalization > 0
      ? correlation / normalization
      : 0;
  }

  private calculateTempoPeriodicity(
    candidateBpm: number,
    mean: number,
  ): number {
    const baseLag = (60 * TEMPO_SAMPLE_RATE) / candidateBpm;
    let harmonicPeriodicity = 0;
    let harmonicWeightTotal = 0;
    for (
      let harmonic = 1;
      harmonic <= TEMPO_HARMONIC_COUNT;
      harmonic++
    ) {
      const harmonicLag = baseLag * harmonic;
      if (harmonicLag >= this.tempoHistoryCount - 1)
        break;
      const correlation = Math.max(
        0,
        this.calculateTempoCorrelation(harmonicLag, mean),
      );
      const weight = harmonic * harmonic;
      harmonicPeriodicity += correlation * weight;
      harmonicWeightTotal += weight;
    }
    return harmonicWeightTotal === 0
      ? 0
      : harmonicPeriodicity / harmonicWeightTotal;
  }

  private scoreTempoCandidate(
    candidateBpm: number,
    mean: number,
    priorCenter: number,
  ): number {
    const harmonicPeriodicity
      = this.calculateTempoPeriodicity(candidateBpm, mean);
    if (harmonicPeriodicity < TEMPO_MIN_PERIODICITY)
      return Number.NEGATIVE_INFINITY;

    const baseLag = (60 * TEMPO_SAMPLE_RATE) / candidateBpm;
    const primaryCorrelation = Math.max(
      0,
      this.calculateTempoCorrelation(baseLag, mean),
    );
    const octaveDistance = Math.log2(candidateBpm / priorCenter);
    const priorWidth = this.bpmEstimate === 0
      ? BPM_PRIOR_WIDTH_OCTAVES
      : BPM_TRACKING_PRIOR_WIDTH_OCTAVES;
    const prior = -0.5 * (octaveDistance / priorWidth) ** 2;
    return Math.log1p(1_000_000 * harmonicPeriodicity)
      + prior
      + BPM_FAST_LAG_PREFERENCE * Math.log2(candidateBpm / 120)
      + TEMPO_PRIMARY_CORRELATION_WEIGHT * primaryCorrelation;
  }

  private correctTempoOctave(candidate: number, mean: number): number {
    if (
      candidate > TEMPO_OCTAVE_CORRECTION_MAX_BPM
      || candidate * 2 > MAX_BPM
    ) {
      return candidate;
    }

    const doubledLag
      = (60 * TEMPO_SAMPLE_RATE) / (candidate * 2);
    const doubledCorrelation = Math.max(
      0,
      this.calculateTempoCorrelation(doubledLag, mean),
    );
    return candidate < TEMPO_OCTAVE_CORRECTION_MIN_BPM
      || doubledCorrelation >= TEMPO_OCTAVE_CORRECTION_MIN_CORRELATION
      ? candidate * 2
      : candidate;
  }

  private clearTempoCandidate(): void {
    this.tempoCandidate = 0;
    this.tempoCandidateConfirmations = 0;
  }

  private confirmTempoCandidate(
    candidate: number,
    requiredConfirmations: number,
  ): boolean {
    const relativeDifference = this.tempoCandidate === 0
      ? Number.POSITIVE_INFINITY
      : Math.abs(candidate - this.tempoCandidate) / this.tempoCandidate;
    if (relativeDifference > TEMPO_CANDIDATE_MATCH_TOLERANCE) {
      this.tempoCandidate = candidate;
      this.tempoCandidateConfirmations = 1;
      return false;
    }

    this.tempoCandidateConfirmations++;
    this.tempoCandidate += (
      candidate - this.tempoCandidate
    ) / this.tempoCandidateConfirmations;
    return this.tempoCandidateConfirmations >= requiredConfirmations;
  }

  private holdBpmEstimate(): void {
    this.clearTempoCandidate();
  }

  private applyTempoCandidate(
    candidate: number,
    periodicity: number,
  ): void {
    if (this.bpmEstimate === 0) {
      if (
        !this.confirmTempoCandidate(
          candidate,
          TEMPO_CANDIDATE_CONFIRMATIONS,
        )
      ) {
        return;
      }

      this.bpmEstimate = this.tempoCandidate;
      this.bpm = this.bpmEstimate;
      this.clearTempoCandidate();
      return;
    }

    const relativeDifference
      = Math.abs(candidate - this.bpmEstimate) / this.bpmEstimate;
    if (relativeDifference <= TEMPO_TRACKING_UPDATE_TOLERANCE) {
      this.bpmEstimate
        += (candidate - this.bpmEstimate) * BPM_ESTIMATE_SMOOTHING;
      this.bpm = this.bpmEstimate;
      this.clearTempoCandidate();
      return;
    }
    if (periodicity < TEMPO_TRANSITION_MIN_PERIODICITY) {
      this.clearTempoCandidate();
      return;
    }

    if (
      this.confirmTempoCandidate(
        candidate,
        TEMPO_TRANSITION_CONFIRMATIONS,
      )
    ) {
      this.bpmEstimate = this.tempoCandidate;
      this.bpm = this.bpmEstimate;
      this.clearTempoCandidate();
    }
  }

  private estimateBpm(): void {
    const mean = this.calculateTempoMean();
    const priorCenter = this.bpmEstimate || 120;
    let bestBpm = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (
      let candidateBpm = MIN_BPM;
      candidateBpm <= MAX_BPM;
      candidateBpm += TEMPO_CANDIDATE_COARSE_STEP_BPM
    ) {
      const score = this.scoreTempoCandidate(
        candidateBpm,
        mean,
        priorCenter,
      );
      if (score > bestScore) {
        bestBpm = candidateBpm;
        bestScore = score;
      }
    }
    if (bestBpm !== 0) {
      const coarseBestBpm = bestBpm;
      const fineStart = Math.max(
        MIN_BPM,
        coarseBestBpm - TEMPO_CANDIDATE_FINE_RADIUS_BPM,
      );
      const fineEnd = Math.min(
        MAX_BPM,
        coarseBestBpm + TEMPO_CANDIDATE_FINE_RADIUS_BPM,
      );
      for (
        let candidateBpm = fineStart;
        candidateBpm <= fineEnd;
        candidateBpm += TEMPO_CANDIDATE_FINE_STEP_BPM
      ) {
        const score = this.scoreTempoCandidate(
          candidateBpm,
          mean,
          priorCenter,
        );
        if (score > bestScore) {
          bestBpm = candidateBpm;
          bestScore = score;
        }
      }
    }
    if (bestBpm === 0) {
      this.holdBpmEstimate();
      return;
    }

    const candidate = this.alignBpmToEstimate(
      this.correctTempoOctave(bestBpm, mean),
    );
    const periodicity = this.calculateTempoPeriodicity(bestBpm, mean);
    this.applyTempoCandidate(candidate, periodicity);
  }

  private updateBpm(deltaSeconds: number): void {
    const tempoFlux = this.tempoFlux;
    const tempoOnset = Math.max(0, tempoFlux - this.tempoFluxBaseline);
    const baselineAlpha
      = 1 - Math.exp(-deltaSeconds / TEMPO_ONSET_BASELINE_SECONDS);
    this.tempoFluxBaseline
      += (tempoFlux - this.tempoFluxBaseline) * baselineAlpha;
    this.tempoOnsetHistory[this.tempoWriteIndex] = tempoOnset;
    this.tempoWriteIndex
      = (this.tempoWriteIndex + 1) % TEMPO_WINDOW_FRAMES;
    this.tempoHistoryCount = Math.min(
      TEMPO_WINDOW_FRAMES,
      this.tempoHistoryCount + 1,
    );

    if (tempoOnset >= TEMPO_MIN_ONSET)
      this.tempoSilenceSeconds = 0;
    else
      this.tempoSilenceSeconds += deltaSeconds;
    if (this.tempoSilenceSeconds > BPM_TIMEOUT_SECONDS) {
      this.clearBpmEstimate();
      return;
    }
    if (this.tempoHistoryCount < TEMPO_MIN_HISTORY_FRAMES)
      return;

    this.tempoFramesSinceEstimate++;
    if (
      this.tempoHistoryCount !== TEMPO_MIN_HISTORY_FRAMES
      && this.tempoFramesSinceEstimate < TEMPO_ESTIMATE_INTERVAL_FRAMES
    ) {
      return;
    }
    this.tempoFramesSinceEstimate = 0;
    this.estimateBpm();
  }

  process(
    audioArray: ArrayLike<number>,
    deltaSeconds = DEFAULT_DELTA_SECONDS,
  ): void {
    validateDeltaSeconds(deltaSeconds);
    writeAudioFrameAnalysis(audioArray, this, this.currentSpectrum);
    this.updateDecayingPeak(deltaSeconds);
    this.clearCurrentEvents();
    this.updateBandFlux();

    const warmingUp = this.warmUpFrames < 3;
    this.updateBandDetectors(deltaSeconds, warmingUp);
    if (warmingUp)
      this.warmUpFrames++;
    else
      this.classifyEvents();
    this.updateBpm(deltaSeconds);
  }

  reset(): void {
    this.averageVolume = 0;
    this.rmsVolume = 0;
    this.peakVolume = 0;
    this.leftVolume = 0;
    this.rightVolume = 0;
    this.stereoBalance = 0;
    this.bass = 0;
    this.midrange = 0;
    this.treble = 0;
    this.decayingPeakVolume = 0;
    this.kick = 0;
    this.clap = 0;
    this.hiHat = 0;
    this.beat = 0;
    this.onset = 0;
    this.bpm = 0;
    this.currentSpectrum.fill(0);
    this.previousSpectrum.fill(0);
    this.bandFlux.fill(0);
    this.tempoFlux = 0;
    this.adaptiveMean.fill(0);
    this.adaptiveDeviation.fill(0);
    this.cooldown.fill(0);
    this.active.fill(0);
    this.strength.fill(0);
    this.warmUpFrames = 0;
    this.clearBpmEstimate();
  }
}

/**
 * Create a reusable loudness and spectrum-transient analyzer.
 *
 * The analyzer reuses its internal buffers, so `process()` and `reset()` do
 * not allocate arrays or result objects.
 *
 * @example
 * const analyzer = createAudioAnalyzer({ sensitivity: 0.75 });
 * analyzer.process(audioArray, 1 / 30);
 * console.log(analyzer.averageVolume, analyzer.kick);
 *
 * @throws {RangeError} If any option is outside its documented range.
 */
export function createAudioAnalyzer(
  options?: AudioAnalyzerOptions,
): AudioAnalyzer {
  const {
    sensitivity = 0.65,
    eventCooldown = 0.13,
    peakDecayPerSecond = 1.5,
  } = options ?? {};

  if (
    !Number.isFinite(sensitivity)
    || sensitivity < 0
    || sensitivity > 1
  ) {
    throw new RangeError(
      'Audio analyzer sensitivity must be a finite number from 0 to 1.',
    );
  }
  if (!Number.isFinite(eventCooldown) || eventCooldown < 0) {
    throw new RangeError(
      'Audio analyzer eventCooldown must be a finite non-negative number.',
    );
  }
  if (!Number.isFinite(peakDecayPerSecond) || peakDecayPerSecond < 0) {
    throw new RangeError(
      'Audio analyzer peakDecayPerSecond must be a finite non-negative number.',
    );
  }

  return new AudioAnalyzerImpl(
    sensitivity,
    eventCooldown,
    peakDecayPerSecond,
  );
}
