import type {
  AudioFrameAnalysis,
  WritableAudioFrameAnalysis,
} from './frame';
import { writeAudioFrameAnalysis } from './frame';
import { AudioTempoTracker } from './tempo';

const CHANNEL_LENGTH = 64;
const BAND_COUNT = 3;
const BASS_END = 6;
const MIDRANGE_END = 24;
const DEFAULT_DELTA_SECONDS = 1 / 30;
const BASELINE_TIME_CONSTANT = 0.4;
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
  private readonly tempo = new AudioTempoTracker();
  private readonly sensitivity: number;
  private readonly eventCooldown: number;
  private readonly peakDecayPerSecond: number;
  private warmUpFrames = 0;
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
    this.tempo.update(this.tempoFlux, deltaSeconds);
    this.bpm = this.tempo.bpm;
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
    this.bpm = 0;
    this.onset = 0;
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
    this.tempo.reset();
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
