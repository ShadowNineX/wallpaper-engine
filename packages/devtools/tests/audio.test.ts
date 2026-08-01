import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioState, lastFrame, setAudioMode } from '../src/audio';
import { listenerFns } from '../src/store';

beforeEach(() => {
  vi.useFakeTimers();
  listenerFns.audio.length = 0;
  setAudioMode('off');
});

afterEach(() => {
  setAudioMode('off');
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
