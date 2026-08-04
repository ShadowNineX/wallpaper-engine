import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  audioSettings,
  audioState,
  lastFrame,
  resetAudioSettings,
  setAudioMode,
} from '../src/audio';
import { listenerFns } from '../src/store';

beforeEach(() => {
  vi.useFakeTimers();
  listenerFns.audio.length = 0;
  setAudioMode('off');
  resetAudioSettings();
});

afterEach(() => {
  setAudioMode('off');
  resetAudioSettings();
  vi.useRealTimers();
});

describe('audio simulator', () => {
  it('emits silent 128-sample stereo frames at roughly 30 Hz', () => {
    const listener = vi.fn();
    listenerFns.audio.push(listener);

    setAudioMode('silence');
    vi.advanceTimersByTime(67);

    expect(audioState.mode).toBe('silence');
    expect(listener).toHaveBeenCalledTimes(2);
    const frame = listener.mock.calls[0]?.[0] as number[];
    expect(frame).toHaveLength(128);
    expect(frame.every(sample => sample === 0)).toBe(true);
    expect(lastFrame.value).toEqual(frame);
  });

  it('emits bounded reactive-spectrum samples', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const listener = vi.fn();
    listenerFns.audio.push(listener);

    setAudioMode('random');
    vi.advanceTimersByTime(34);

    const frame = listener.mock.calls[0]?.[0] as number[];
    expect(frame).toHaveLength(128);
    expect(frame.every(sample => sample >= 0 && sample <= 1)).toBe(true);
    expect(new Set(frame).size).toBeGreaterThan(10);
  });

  it('emits a changing smooth sweep', () => {
    const listener = vi.fn();
    listenerFns.audio.push(listener);

    setAudioMode('sine');
    vi.advanceTimersByTime(67);

    const first = listener.mock.calls[0]?.[0] as number[];
    const second = listener.mock.calls[1]?.[0] as number[];
    expect(first).toHaveLength(128);
    expect(first.every(sample => sample >= 0 && sample <= 1)).toBe(true);
    expect(second).not.toEqual(first);
  });

  it('emits synchronized low-frequency bass pulses', () => {
    const listener = vi.fn();
    listenerFns.audio.push(listener);

    setAudioMode('bass');
    vi.advanceTimersByTime(67);

    const first = listener.mock.calls[0]?.[0] as number[];
    const second = listener.mock.calls[1]?.[0] as number[];
    const lowEnergy = first
      .slice(0, 8)
      .reduce((total, sample) => total + sample, 0);
    const highEnergy = first
      .slice(48, 64)
      .reduce((total, sample) => total + sample, 0);

    expect(first).toHaveLength(128);
    expect(first.slice(0, 64)).toEqual(first.slice(64));
    expect(lowEnergy).toBeGreaterThan(highEnergy);
    expect(second).not.toEqual(first);
  });

  it('alternates energy between the left and right channels', () => {
    const listener = vi.fn();
    listenerFns.audio.push(listener);

    setAudioMode('stereo');
    vi.advanceTimersByTime(67);

    const first = listener.mock.calls[0]?.[0] as number[];
    const second = listener.mock.calls[1]?.[0] as number[];
    const leftEnergy = first
      .slice(0, 64)
      .reduce((total, sample) => total + sample, 0);
    const rightEnergy = first
      .slice(64)
      .reduce((total, sample) => total + sample, 0);

    expect(first).toHaveLength(128);
    expect(first.every(sample => sample >= 0 && sample <= 1)).toBe(true);
    expect(Math.abs(leftEnergy - rightEnergy)).toBeGreaterThan(1);
    expect(second).not.toEqual(first);
  });

  it('emits a repeating kick, clap, and hi-hat track pattern', () => {
    const listener = vi.fn();
    listenerFns.audio.push(listener);

    setAudioMode('track');
    vi.advanceTimersByTime(2_100);

    const frames = listener.mock.calls.map(call => call[0] as number[]);
    const first = frames[0] as number[];
    const betweenKick = frames[7] as number[];
    const clapBeat = frames[15] as number[];
    const betweenHat = frames[3] as number[];
    const repeated = frames[60] as number[];
    const bandEnergy = (frame: number[], start: number, end: number) =>
      frame
        .slice(start, end)
        .reduce((total, sample) => total + sample, 0);

    expect(frames.length).toBeGreaterThanOrEqual(62);
    expect(frames.every(frame => frame.length === 128)).toBe(true);
    expect(frames.every(frame =>
      frame.every(sample => sample >= 0 && sample <= 1),
    )).toBe(true);
    expect(bandEnergy(first, 0, 8)).toBeGreaterThan(
      bandEnergy(betweenKick, 0, 8) * 4,
    );
    expect(bandEnergy(clapBeat, 18, 34)).toBeGreaterThan(
      bandEnergy(first, 18, 34) * 2,
    );
    expect(bandEnergy(first, 48, 64)).toBeGreaterThan(
      bandEnergy(betweenHat, 48, 64) * 2,
    );
    expect(repeated).toEqual(first);
  });

  it('adjusts track output and individual instrument levels', () => {
    const listener = vi.fn();
    listenerFns.audio.push(listener);
    audioSettings.trackBassline = 0;
    audioSettings.trackKick = 0;
    audioSettings.trackClap = 0;
    audioSettings.trackHiHat = 0;

    setAudioMode('track');
    vi.advanceTimersByTime(34);
    const muted = listener.mock.calls[0]?.[0] as number[];
    expect(muted.every(sample => sample === 0)).toBe(true);

    setAudioMode('off');
    listener.mockClear();
    audioSettings.trackKick = 1;
    audioSettings.output = 0.25;
    setAudioMode('track');
    vi.advanceTimersByTime(34);
    const quietKick = listener.mock.calls[0]?.[0] as number[];

    setAudioMode('off');
    listener.mockClear();
    audioSettings.output = 1;
    setAudioMode('track');
    vi.advanceTimersByTime(34);
    const fullKick = listener.mock.calls[0]?.[0] as number[];

    expect(quietKick[0]).toBeGreaterThan(0);
    expect(fullKick[0]).toBeCloseTo((quietKick[0] ?? 0) * 4, 10);
  });

  it('moves track beats according to the configured tempo', () => {
    const listener = vi.fn();
    listenerFns.audio.push(listener);
    audioSettings.trackBassline = 0;
    audioSettings.trackKick = 0;
    audioSettings.trackClap = 1;
    audioSettings.trackHiHat = 0;
    const midEnergy = (frame: number[]) =>
      frame
        .slice(18, 34)
        .reduce((total, sample) => total + sample, 0);
    const peakIndex = (frames: number[][]) => {
      const energies = frames.map(midEnergy);
      return energies.indexOf(Math.max(...energies));
    };

    audioSettings.trackTempo = 120;
    setAudioMode('track');
    vi.advanceTimersByTime(1_100);
    const regularFrames = listener.mock.calls.map(call => call[0] as number[]);

    setAudioMode('off');
    listener.mockClear();
    audioSettings.trackTempo = 60;
    setAudioMode('track');
    vi.advanceTimersByTime(1_100);
    const slowFrames = listener.mock.calls.map(call => call[0] as number[]);

    expect(peakIndex(regularFrames)).toBe(15);
    expect(peakIndex(slowFrames)).toBe(30);
  });

  it('stops callbacks and clears the displayed frame when switched off', () => {
    const listener = vi.fn();
    listenerFns.audio.push(listener);
    setAudioMode('silence');
    vi.advanceTimersByTime(34);
    expect(listener).toHaveBeenCalledOnce();

    setAudioMode('off');
    vi.advanceTimersByTime(100);

    expect(listener).toHaveBeenCalledOnce();
    expect(lastFrame.value).toEqual([]);
  });

  it('isolates wallpaper callback failures', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const healthy = vi.fn();
    listenerFns.audio.push(
      () => {
        throw new Error('broken callback');
      },
      healthy,
    );

    setAudioMode('silence');
    vi.advanceTimersByTime(34);

    expect(healthy).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(
      '[WE Dev] audio listener threw',
      expect.any(Error),
    );
  });
});
