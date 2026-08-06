import type { AudioAnalyzer } from '../src/helpers';
import { describe, expect, it } from 'vitest';
import {
  analyzeAudioFrame,
  clampAudio,
  createAudioAnalyzer,
} from '../src/helpers';

const SILENCE = Array.from<number>({ length: 128 }).fill(0);
const KICK = Array.from(
  { length: 128 },
  (_, index) => Math.exp(-(index % 64) / 5) * 0.92,
);
const CLAP = Array.from(
  { length: 128 },
  (_, index) => Math.exp(-(((index % 64 - 25) / 10) ** 2)) * 0.58,
);
const HI_HAT = Array.from(
  { length: 128 },
  (_, index) =>
    Math.exp(-(((index % 64 - 52) / 8) ** 2))
    * (index < 64 ? 0.34 : 0.28),
);

function setStereoBin(
  frame: number[],
  bin: number,
  magnitude: number,
): void {
  frame[bin] = magnitude;
  frame[bin + 64] = magnitude;
}

function warmUp(analyzer: AudioAnalyzer): void {
  for (let frame = 0; frame < 3; frame++)
    analyzer.process(SILENCE);
}

function expectNoEvents(analyzer: AudioAnalyzer): void {
  expect({
    kick: analyzer.kick,
    clap: analyzer.clap,
    hiHat: analyzer.hiHat,
    beat: analyzer.beat,
    onset: analyzer.onset,
  }).toEqual({ kick: 0, clap: 0, hiHat: 0, beat: 0, onset: 0 });
}

function classify(profile: number[]): AudioAnalyzer {
  const analyzer = createAudioAnalyzer();
  warmUp(analyzer);
  analyzer.process(profile);
  return analyzer;
}

function processPulseTempo(
  analyzer: AudioAnalyzer,
  bpm: number,
  frameCount = 240,
): void {
  const periodFrames = (60 * 30) / bpm;
  for (let frame = 0; frame < frameCount; frame++) {
    const deltaSeconds = frame % 2 === 0 ? 0.031 : 0.035;
    analyzer.process(frame % periodFrames === 0 ? KICK : SILENCE, deltaSeconds);
  }
}

function writeTrackFrame(frame: number[], frameIndex: number): void {
  const kickAge = (frameIndex % 30) / 30;
  const clapAge = ((frameIndex + 15) % 30) / 30;
  const hatAge = (frameIndex % 5) / 30;
  const kick = Math.exp(-kickAge * 22);
  const clap = Math.exp(-clapAge * 30);
  const hat = Math.exp(-hatAge * 52);
  const trackTime = frameIndex / 30;
  const bassline
    = 0.07 + 0.05 * (0.5 + 0.5 * Math.sin(trackTime * Math.PI * 2));

  for (let bin = 0; bin < 64; bin++) {
    const kickProfile = Math.exp(-bin / 5);
    const bassProfile = Math.exp(-(((bin - 8) / 7) ** 2));
    const clapProfile = Math.exp(-(((bin - 25) / 10) ** 2));
    const hatProfile = Math.exp(-(((bin - 52) / 8) ** 2));
    const body
      = kick * kickProfile * 0.92
        + bassline * bassProfile
        + clap * clapProfile * 0.58;
    frame[bin] = Math.min(1, body + hat * hatProfile * 0.34);
    frame[bin + 64] = Math.min(1, body + hat * hatProfile * 0.28);
  }
}

describe('analyzeAudioFrame', () => {
  it('computes loudness, stereo, and ordered-spectrum metrics', () => {
    const audio = [
      ...Array.from<number>({ length: 64 }).fill(0.25),
      ...Array.from<number>({ length: 64 }).fill(0.75),
    ];

    const analysis = analyzeAudioFrame(audio);

    expect(analysis.averageVolume).toBe(0.5);
    expect(analysis.rmsVolume).toBeCloseTo(Math.sqrt(0.3125));
    expect(analysis.peakVolume).toBe(0.75);
    expect(analysis.leftVolume).toBe(0.25);
    expect(analysis.rightVolume).toBe(0.75);
    expect(analysis.stereoBalance).toBe(0.5);
    expect(analysis.bass).toBe(0.5);
    expect(analysis.midrange).toBe(0.5);
    expect(analysis.treble).toBe(0.5);
  });

  it('clamps malformed samples without mutating or reusing inputs', () => {
    const audio = Array.from<number>({ length: 128 }).fill(0.25);
    audio[0] = -1;
    audio[1] = 2;
    audio[64] = Number.NaN;
    audio[65] = Number.POSITIVE_INFINITY;
    const original = audio.slice();

    const first = analyzeAudioFrame(audio);
    const second = analyzeAudioFrame(clampAudio(audio));

    expect(first).toEqual(second);
    expect(audio).toEqual(original);
    expect(first).not.toBe(analyzeAudioFrame(audio));
  });

  it('reports silent and one-sided stereo balance', () => {
    expect(analyzeAudioFrame(SILENCE).stereoBalance).toBe(0);
    expect(
      analyzeAudioFrame([
        ...Array.from<number>({ length: 64 }).fill(1),
        ...Array.from<number>({ length: 64 }).fill(0),
      ]).stereoBalance,
    ).toBe(-1);
    expect(
      analyzeAudioFrame([
        ...Array.from<number>({ length: 64 }).fill(0),
        ...Array.from<number>({ length: 64 }).fill(1),
      ]).stereoBalance,
    ).toBe(1);
  });

  it('uses exact bass, midrange, and treble bin boundaries', () => {
    const audio = Array.from<number>({ length: 128 }).fill(0);
    setStereoBin(audio, 5, 0.6);
    setStereoBin(audio, 6, 0.3);
    setStereoBin(audio, 23, 0.3);
    setStereoBin(audio, 24, 0.9);

    const analysis = analyzeAudioFrame(audio);

    expect(analysis.bass).toBeCloseTo(0.6 / 6);
    expect(analysis.midrange).toBeCloseTo(0.6 / 18);
    expect(analysis.treble).toBeCloseTo(0.9 / 40);
  });

  it('accepts typed-array frames', () => {
    const audio = new Float32Array(128);
    audio.fill(0.25);

    const analysis = analyzeAudioFrame(audio);
    const analyzer = createAudioAnalyzer();
    analyzer.process(audio);

    expect(analysis.averageVolume).toBe(0.25);
    expect(analyzer.averageVolume).toBe(0.25);
    expect(analyzer.decayingPeakVolume).toBe(0.25);
  });

  it.each([127, 129])('rejects a %i-sample frame', (length) => {
    expect(() => analyzeAudioFrame(Array.from<number>({ length }).fill(0))).toThrow(
      new RangeError(
        'Wallpaper Engine audio frames must contain exactly 128 samples.',
      ),
    );
  });
});

describe('createAudioAnalyzer', () => {
  it('populates loudness without events during three warm-up frames', () => {
    const analyzer = createAudioAnalyzer();
    const frame = Array.from<number>({ length: 128 }).fill(0.5);

    for (let call = 0; call < 3; call++) {
      analyzer.process(frame);
      expect(analyzer.averageVolume).toBe(0.5);
      expect(analyzer.rmsVolume).toBe(0.5);
      expect(analyzer.peakVolume).toBe(0.5);
      expect(analyzer.decayingPeakVolume).toBe(0.5);
      expect(analyzer.bpm).toBe(0);
      expectNoEvents(analyzer);
    }
  });

  it('classifies an isolated kick profile', () => {
    const analyzer = classify(KICK);

    expect(analyzer.kick).toBeGreaterThan(0);
    expect(analyzer.beat).toBe(analyzer.kick);
    expect(analyzer.onset).toBeGreaterThan(0);
    expect(analyzer.clap).toBe(0);
    expect(analyzer.hiHat).toBe(0);
  });

  it('classifies an isolated clap profile', () => {
    const analyzer = classify(CLAP);

    expect(analyzer.clap).toBeGreaterThan(0);
    expect(analyzer.beat).toBe(analyzer.clap);
    expect(analyzer.onset).toBeGreaterThan(0);
    expect(analyzer.kick).toBe(0);
    expect(analyzer.hiHat).toBe(0);
  });

  it('classifies an isolated hi-hat profile without a beat', () => {
    const analyzer = classify(HI_HAT);

    expect(analyzer.hiHat).toBeGreaterThan(0);
    expect(analyzer.onset).toBeGreaterThan(0);
    expect(analyzer.clap).toBe(0);
    expect(analyzer.kick).toBe(0);
    expect(analyzer.beat).toBe(0);
  });

  it('reports an unclassified midrange transient as an onset', () => {
    const midrange = Array.from<number>({ length: 128 }).fill(0);
    for (let bin = 6; bin < 24; bin++)
      setStereoBin(midrange, bin, 0.5);

    const analyzer = classify(midrange);

    expect(analyzer.onset).toBeGreaterThan(0);
    expect(analyzer.kick).toBe(0);
    expect(analyzer.clap).toBe(0);
    expect(analyzer.hiHat).toBe(0);
    expect(analyzer.beat).toBe(0);
  });

  it('allows kick and clap classifications to coexist', () => {
    const analyzer = classify(Array.from<number>({ length: 128 }).fill(0.5));

    expect(analyzer.kick).toBeGreaterThan(0);
    expect(analyzer.clap).toBeGreaterThan(0);
    expect(analyzer.hiHat).toBe(0);
    expect(analyzer.beat).toBe(Math.max(analyzer.kick, analyzer.clap));
    expect(analyzer.onset).toBeGreaterThan(0);
  });

  it('does not retrigger on a sustained or falling profile', () => {
    const analyzer = createAudioAnalyzer();
    warmUp(analyzer);

    analyzer.process(KICK);
    expect(analyzer.kick).toBeGreaterThan(0);

    analyzer.process(KICK);
    expectNoEvents(analyzer);

    analyzer.process(KICK.map(sample => sample * 0.5));
    expectNoEvents(analyzer);
  });

  it('suppresses an attack during cooldown and allows it afterward', () => {
    const analyzer = createAudioAnalyzer({ eventCooldown: 0.13 });
    warmUp(analyzer);

    analyzer.process(KICK);
    expect(analyzer.kick).toBeGreaterThan(0);

    analyzer.process(SILENCE, 0);
    analyzer.process(KICK, 0);
    expectNoEvents(analyzer);

    analyzer.process(SILENCE, 0.13);
    analyzer.process(KICK, 0);
    expect(analyzer.kick).toBeGreaterThan(0);
  });

  it('rejects aperiodic spectrum noise as low-confidence tempo', () => {
    const analyzer = createAudioAnalyzer();
    const frame = Array.from<number>({ length: 128 }).fill(0);
    let randomState = 123456789;
    for (let frameIndex = 0; frameIndex < 900; frameIndex++) {
      for (let sample = 0; sample < frame.length; sample++) {
        randomState
          = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
        frame[sample] = randomState / 4294967296;
      }
      analyzer.process(frame, 1 / 30);
    }

    expect(analyzer.bpm).toBe(0);
  });

  it('holds an accepted tempo through low-confidence non-silent frames', () => {
    const analyzer = createAudioAnalyzer();
    processPulseTempo(analyzer, 120);

    const frame = Array.from<number>({ length: 128 }).fill(0);
    let randomState = 123456789;
    let minimumBpm = Number.POSITIVE_INFINITY;
    let maximumBpm = 0;
    for (let frameIndex = 0; frameIndex < 300; frameIndex++) {
      for (let sample = 0; sample < frame.length; sample++) {
        randomState
          = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
        frame[sample] = randomState / 4294967296;
      }
      analyzer.process(frame, 1 / 30);
      minimumBpm = Math.min(minimumBpm, analyzer.bpm);
      maximumBpm = Math.max(maximumBpm, analyzer.bpm);
    }

    expect(minimumBpm).toBeCloseTo(120);
    expect(maximumBpm).toBeCloseTo(120);
  });

  it.each([60, 90, 120, 180])(
    'estimates %i BPM from onset-envelope periodicity',
    (bpm) => {
      const analyzer = createAudioAnalyzer();

      processPulseTempo(analyzer, bpm);

      expect(analyzer.bpm).toBeCloseTo(bpm, 0);
      expect(Math.round(analyzer.bpm)).toBe(bpm);
    },
  );

  it('resolves steady subdivisions over a strong half-time accent', () => {
    const analyzer = createAudioAnalyzer();
    const weakKick = KICK.map(value => value * 0.6);
    for (let frame = 0; frame < 480; frame++) {
      const beatFrame = frame % 21;
      const profile = beatFrame === 0
        ? KICK
        : beatFrame === 11
          ? weakKick
          : SILENCE;
      analyzer.process(profile, 1 / 30);
    }

    expect(analyzer.bpm).toBeCloseTo(171.5, 0);
  });

  it('tracks a sustained non-octave tempo change', () => {
    const analyzer = createAudioAnalyzer();
    processPulseTempo(analyzer, 120);
    processPulseTempo(analyzer, 180, 480);

    expect(analyzer.bpm).toBeCloseTo(180, 0);
  });

  it('holds 120 BPM through accented subdivisions and missed beats', () => {
    const analyzer = createAudioAnalyzer();
    for (let frame = 0; frame < 240; frame++) {
      const beatNumber = Math.floor(frame / 15);
      const isMainBeat = frame % 15 === 0 && beatNumber % 4 !== 3;
      const isSubdivision = frame % 15 === 8;
      const profile = isMainBeat
        ? KICK
        : isSubdivision
          ? HI_HAT
          : SILENCE;
      analyzer.process(profile, 1 / 30);
    }

    expect(Math.round(analyzer.bpm)).toBe(120);
  });

  it('reports the devtools 120 BPM Track loop accurately', () => {
    const analyzer = createAudioAnalyzer();
    const frame = Array.from<number>({ length: 128 }).fill(0);
    for (let frameIndex = 0; frameIndex < 240; frameIndex++) {
      writeTrackFrame(frame, frameIndex);
      analyzer.process(frame, 0.033);
    }

    expect(analyzer.bpm).toBeCloseTo(120, 0);
    expect(Math.round(analyzer.bpm)).toBe(120);
  });

  it('clears BPM after silence and requires fresh periodic history', () => {
    const analyzer = createAudioAnalyzer();
    processPulseTempo(analyzer, 120);
    expect(Math.round(analyzer.bpm)).toBe(120);

    analyzer.process(SILENCE, 4.01);
    expect(analyzer.bpm).toBe(0);

    processPulseTempo(analyzer, 90, 149);
    expect(analyzer.bpm).toBe(0);
    analyzer.process(SILENCE, 1 / 30);
    expect(Math.round(analyzer.bpm)).toBe(90);
  });

  it('holds, decays, and raises the peak envelope', () => {
    const analyzer = createAudioAnalyzer({ peakDecayPerSecond: 2 });

    analyzer.process(Array.from<number>({ length: 128 }).fill(0.8));
    expect(analyzer.decayingPeakVolume).toBeCloseTo(0.8);

    analyzer.process(SILENCE, 0.1);
    expect(analyzer.decayingPeakVolume).toBeCloseTo(0.6);

    analyzer.process(Array.from<number>({ length: 128 }).fill(0.7));
    expect(analyzer.decayingPeakVolume).toBeCloseTo(0.7);
  });

  it('advances peak decay and cooldown across a large delta', () => {
    const analyzer = createAudioAnalyzer({
      eventCooldown: 10,
      peakDecayPerSecond: 0.1,
    });
    warmUp(analyzer);

    analyzer.process(KICK);
    expect(analyzer.kick).toBeGreaterThan(0);
    expect(analyzer.decayingPeakVolume).toBeGreaterThan(0);

    analyzer.process(SILENCE, 20);
    expect(analyzer.decayingPeakVolume).toBe(0);

    analyzer.process(KICK, 0);
    expect(analyzer.kick).toBeGreaterThan(0);
  });

  it('clears all state and restarts warm-up on reset', () => {
    const analyzer = createAudioAnalyzer();
    processPulseTempo(analyzer, 120);
    expect(Math.round(analyzer.bpm)).toBe(120);
    analyzer.reset();

    expect({
      averageVolume: analyzer.averageVolume,
      rmsVolume: analyzer.rmsVolume,
      peakVolume: analyzer.peakVolume,
      leftVolume: analyzer.leftVolume,
      rightVolume: analyzer.rightVolume,
      stereoBalance: analyzer.stereoBalance,
      bass: analyzer.bass,
      midrange: analyzer.midrange,
      treble: analyzer.treble,
      decayingPeakVolume: analyzer.decayingPeakVolume,
      kick: analyzer.kick,
      clap: analyzer.clap,
      hiHat: analyzer.hiHat,
      beat: analyzer.beat,
      bpm: analyzer.bpm,
      onset: analyzer.onset,
    }).toEqual({
      averageVolume: 0,
      rmsVolume: 0,
      peakVolume: 0,
      leftVolume: 0,
      rightVolume: 0,
      stereoBalance: 0,
      bass: 0,
      midrange: 0,
      treble: 0,
      decayingPeakVolume: 0,
      kick: 0,
      clap: 0,
      hiHat: 0,
      beat: 0,
      bpm: 0,
      onset: 0,
    });

    analyzer.process(KICK);
    expectNoEvents(analyzer);
    analyzer.process(SILENCE);
    expectNoEvents(analyzer);
    analyzer.process(SILENCE);
    expectNoEvents(analyzer);
    analyzer.process(KICK);
    expect(analyzer.kick).toBeGreaterThan(0);
  });

  it.each([
    [{ sensitivity: -0.01 }, 'Audio analyzer sensitivity must be a finite number from 0 to 1.'],
    [{ sensitivity: 1.01 }, 'Audio analyzer sensitivity must be a finite number from 0 to 1.'],
    [{ sensitivity: Number.NaN }, 'Audio analyzer sensitivity must be a finite number from 0 to 1.'],
    [{ eventCooldown: -0.01 }, 'Audio analyzer eventCooldown must be a finite non-negative number.'],
    [{ eventCooldown: Number.POSITIVE_INFINITY }, 'Audio analyzer eventCooldown must be a finite non-negative number.'],
    [{ peakDecayPerSecond: -0.01 }, 'Audio analyzer peakDecayPerSecond must be a finite non-negative number.'],
    [{ peakDecayPerSecond: Number.NaN }, 'Audio analyzer peakDecayPerSecond must be a finite non-negative number.'],
  ])('rejects invalid options %#', (options, message) => {
    expect(() => createAudioAnalyzer(options)).toThrow(new RangeError(message));
  });

  it('accepts option boundaries', () => {
    expect(() => createAudioAnalyzer({
      sensitivity: 0,
      eventCooldown: 0,
      peakDecayPerSecond: 0,
    })).not.toThrow();
    expect(() => createAudioAnalyzer({ sensitivity: 1 })).not.toThrow();
  });

  it.each([
    -0.01,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('rejects invalid deltaSeconds %s', (deltaSeconds) => {
    const analyzer = createAudioAnalyzer();
    expect(() => analyzer.process(SILENCE, deltaSeconds)).toThrow(
      new RangeError(
        'Audio analyzer deltaSeconds must be a finite non-negative number.',
      ),
    );
  });

  it('rejects malformed frame lengths without changing current metrics', () => {
    const analyzer = createAudioAnalyzer();
    analyzer.process(Array.from<number>({ length: 128 }).fill(0.5));

    expect(() => analyzer.process(Array.from<number>({ length: 127 }).fill(0))).toThrow(
      new RangeError(
        'Wallpaper Engine audio frames must contain exactly 128 samples.',
      ),
    );
    expect(analyzer.averageVolume).toBe(0.5);
  });
});
