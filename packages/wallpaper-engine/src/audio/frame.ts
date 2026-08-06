const AUDIO_FRAME_LENGTH = 128;
const CHANNEL_LENGTH = 64;
const BASS_END = 6;
const MIDRANGE_END = 24;

/**
 * Aggregate loudness, stereo, and ordered-spectrum metrics for one Wallpaper
 * Engine audio callback frame.
 *
 * @example
 * const analysis: AudioFrameAnalysis = analyzeAudioFrame(audioArray);
 * console.log(analysis.rmsVolume, analysis.bass);
 */
export interface AudioFrameAnalysis {
  /** Arithmetic mean of all clamped samples. */
  readonly averageVolume: number;
  /** Root-mean-square of all clamped samples. */
  readonly rmsVolume: number;
  /** Largest clamped sample in the frame. */
  readonly peakVolume: number;
  /** Arithmetic mean of the left channel. */
  readonly leftVolume: number;
  /** Arithmetic mean of the right channel. */
  readonly rightVolume: number;
  /** Stereo balance from left-only (-1) through equal (0) to right-only (1). */
  readonly stereoBalance: number;
  /** Mean stereo-combined magnitude across ordered spectrum bins 0–5. */
  readonly bass: number;
  /** Mean stereo-combined magnitude across ordered spectrum bins 6–23. */
  readonly midrange: number;
  /** Mean stereo-combined magnitude across ordered spectrum bins 24–63. */
  readonly treble: number;
}

/** @internal */
export interface WritableAudioFrameAnalysis {
  averageVolume: number;
  rmsVolume: number;
  peakVolume: number;
  leftVolume: number;
  rightVolume: number;
  stereoBalance: number;
  bass: number;
  midrange: number;
  treble: number;
}

/** @internal */
export function clampAudioSample(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** @internal */
export function writeAudioFrameAnalysis(
  audioArray: ArrayLike<number>,
  target: WritableAudioFrameAnalysis,
  monoSpectrum?: { [index: number]: number },
): void {
  if (audioArray.length !== AUDIO_FRAME_LENGTH) {
    throw new RangeError(
      'Wallpaper Engine audio frames must contain exactly 128 samples.',
    );
  }

  let total = 0;
  let squaredTotal = 0;
  let peak = 0;
  let leftTotal = 0;
  let rightTotal = 0;
  let bassTotal = 0;
  let midrangeTotal = 0;
  let trebleTotal = 0;

  for (let bin = 0; bin < CHANNEL_LENGTH; bin++) {
    const left = clampAudioSample(audioArray[bin]!);
    const right = clampAudioSample(audioArray[bin + CHANNEL_LENGTH]!);
    const mono = (left + right) / 2;

    leftTotal += left;
    rightTotal += right;
    total += left + right;
    squaredTotal += left * left + right * right;
    peak = Math.max(peak, left, right);

    if (monoSpectrum)
      monoSpectrum[bin] = mono;

    if (bin < BASS_END)
      bassTotal += mono;
    else if (bin < MIDRANGE_END)
      midrangeTotal += mono;
    else
      trebleTotal += mono;
  }

  const leftVolume = leftTotal / CHANNEL_LENGTH;
  const rightVolume = rightTotal / CHANNEL_LENGTH;
  const stereoTotal = leftVolume + rightVolume;

  target.averageVolume = total / AUDIO_FRAME_LENGTH;
  target.rmsVolume = Math.sqrt(squaredTotal / AUDIO_FRAME_LENGTH);
  target.peakVolume = peak;
  target.leftVolume = leftVolume;
  target.rightVolume = rightVolume;
  target.stereoBalance
    = stereoTotal === 0 ? 0 : (rightVolume - leftVolume) / stereoTotal;
  target.bass = bassTotal / BASS_END;
  target.midrange = midrangeTotal / (MIDRANGE_END - BASS_END);
  target.treble = trebleTotal / (CHANNEL_LENGTH - MIDRANGE_END);
}

/**
 * Analyze one 128-sample Wallpaper Engine stereo spectrum frame.
 *
 * Samples are clamped to the 0–1 range without mutating the input. Frequency
 * regions are ordered-spectrum bins, not absolute frequency measurements.
 *
 * @example
 * window.wallpaperRegisterAudioListener((audioArray) => {
 *   const frame = analyzeAudioFrame(audioArray);
 *   meter.value = frame.averageVolume;
 * });
 *
 * @throws {RangeError} If the frame does not contain exactly 128 samples.
 */
export function analyzeAudioFrame(
  audioArray: ArrayLike<number>,
): AudioFrameAnalysis {
  const analysis: WritableAudioFrameAnalysis = {
    averageVolume: 0,
    rmsVolume: 0,
    peakVolume: 0,
    leftVolume: 0,
    rightVolume: 0,
    stereoBalance: 0,
    bass: 0,
    midrange: 0,
    treble: 0,
  };
  writeAudioFrameAnalysis(audioArray, analysis);
  return analysis;
}
