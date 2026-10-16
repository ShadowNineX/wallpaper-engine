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

/** Internal, allocation-free tempo history and periodicity tracker. */
export class AudioTempoTracker {
  bpm = 0;

  private readonly tempoOnsetHistory = new Float64Array(TEMPO_WINDOW_FRAMES);
  private bpmEstimate = 0;
  private tempoWriteIndex = 0;
  private tempoHistoryCount = 0;
  private tempoFramesSinceEstimate = 0;
  private tempoCandidate = 0;
  private tempoCandidateConfirmations = 0;
  private tempoSilenceSeconds = 0;
  private tempoFluxBaseline = 0;
  private tempoSampleRemainder = 0;
  private tempoSampleArea = 0;
  private previousOnset = 0;
  private pendingFlux = 0;

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

  reset(): void {
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
    this.tempoSampleRemainder = 0;
    this.tempoSampleArea = 0;
    this.previousOnset = 0;
    this.pendingFlux = 0;
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

  update(tempoFlux: number, deltaSeconds: number): void {
    // A paused callback stream contains no timing evidence for the missing span.
    // Discard it in constant time instead of inventing repeated onset samples.
    if (deltaSeconds >= BPM_TIMEOUT_SECONDS) {
      this.reset();
      return;
    }
    if (deltaSeconds === 0) {
      this.pendingFlux = Math.max(this.pendingFlux, tempoFlux);
      return;
    }

    tempoFlux = Math.max(tempoFlux, this.pendingFlux);
    this.pendingFlux = 0;

    const tempoOnset = Math.max(0, tempoFlux - this.tempoFluxBaseline);
    const baselineAlpha
      = 1 - Math.exp(-deltaSeconds / TEMPO_ONSET_BASELINE_SECONDS);
    this.tempoFluxBaseline
      += (tempoFlux - this.tempoFluxBaseline) * baselineAlpha;

    if (tempoOnset >= TEMPO_MIN_ONSET)
      this.tempoSilenceSeconds = 0;
    else
      this.tempoSilenceSeconds += deltaSeconds;
    if (this.tempoSilenceSeconds > BPM_TIMEOUT_SECONDS) {
      this.reset();
      return;
    }

    // Keep autocorrelation lags in seconds even when callbacks are throttled or
    // arrive faster than 30 Hz. Integrating the interpolated envelope preserves
    // attacks between ticks instead of losing them during downsampling.
    const previousRemainder = this.tempoSampleRemainder;
    const sampleSpan = deltaSeconds * TEMPO_SAMPLE_RATE;
    const elapsedSamples = previousRemainder + sampleSpan;
    const sampleCount = Math.floor(elapsedSamples + 1e-9);
    this.tempoSampleRemainder = Math.max(0, elapsedSamples - sampleCount);
    const hadMinimumHistory = this.tempoHistoryCount >= TEMPO_MIN_HISTORY_FRAMES;
    let previousFraction = 0;
    let previousValue = this.previousOnset;
    for (let sample = 0; sample < sampleCount; sample++) {
      const fraction = Math.min(1, (sample + 1 - previousRemainder) / sampleSpan);
      const value = this.previousOnset + (tempoOnset - this.previousOnset) * fraction;
      this.tempoSampleArea += (previousValue + value) / 2 * (fraction - previousFraction) * sampleSpan;
      this.tempoOnsetHistory[this.tempoWriteIndex] = this.tempoSampleArea;
      this.tempoWriteIndex = (this.tempoWriteIndex + 1) % TEMPO_WINDOW_FRAMES;
      this.tempoSampleArea = 0;
      previousFraction = fraction;
      previousValue = value;
    }
    this.tempoSampleArea += (previousValue + tempoOnset) / 2 * (1 - previousFraction) * sampleSpan;
    this.previousOnset = tempoOnset;
    if (sampleCount === 0)
      return;
    this.tempoHistoryCount = Math.min(TEMPO_WINDOW_FRAMES, this.tempoHistoryCount + sampleCount);
    if (this.tempoHistoryCount < TEMPO_MIN_HISTORY_FRAMES)
      return;

    this.tempoFramesSinceEstimate += sampleCount;
    if (hadMinimumHistory && this.tempoFramesSinceEstimate < TEMPO_ESTIMATE_INTERVAL_FRAMES)
      return;
    this.tempoFramesSinceEstimate = 0;
    this.estimateBpm();
  }
}
