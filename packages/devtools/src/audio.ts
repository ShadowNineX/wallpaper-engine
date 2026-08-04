import { reactive, shallowRef } from 'vue';
import { listenerFns } from './store';

export type AudioMode
  = | 'off'
    | 'silence'
    | 'random'
    | 'sine'
    | 'bass'
    | 'stereo'
    | 'track';

export const AUDIO_MODE_LABELS = {
  off: 'Off',
  silence: 'Silence',
  random: 'Noise',
  sine: 'Sweep',
  bass: 'Bass pulse',
  stereo: 'Stereo pan',
  track: 'Track loop',
} as const satisfies Record<AudioMode, string>;

export interface AudioSettings {
  output: number;
  sweepSpeed: number;
  bassSpeed: number;
  stereoSpeed: number;
  trackTempo: number;
  trackBassline: number;
  trackKick: number;
  trackClap: number;
  trackHiHat: number;
}

const DEFAULT_AUDIO_SETTINGS = {
  output: 1,
  sweepSpeed: 1,
  bassSpeed: 1,
  stereoSpeed: 1,
  trackTempo: 120,
  trackBassline: 1,
  trackKick: 1,
  trackClap: 1,
  trackHiHat: 1,
} satisfies AudioSettings;

export const audioSettings = reactive<AudioSettings>({
  ...DEFAULT_AUDIO_SETTINGS,
});

let timer: ReturnType<typeof setInterval> | null = null;
let phase = 0;
let trackFrame = 0;
export const audioState = reactive({ mode: 'off' as AudioMode });
/** Last 128-sample frame sent to listeners, updated every tick. */
export const lastFrame = shallowRef<number[]>([]);

type ActiveAudioMode = Exclude<AudioMode, 'off'>;
type FrameWriter = (frame: number[]) => void;

function writeSilenceFrame(frame: number[]): void {
  frame.fill(0);
}

function writeNoiseFrame(frame: number[]): void {
  for (let i = 0; i < 128; i++) {
    const decay = Math.exp(-(i % 64) / 16);
    frame[i] = Math.random() * decay;
  }
}

function writeSweepFrame(frame: number[]): void {
  phase += 0.1 * audioSettings.sweepSpeed;
  for (let bin = 0; bin < 64; bin++) {
    const position = bin / 64;
    const sample
      = Math.max(0, Math.sin(phase + position * Math.PI * 2))
        * (1 - position * 0.6);
    frame[bin] = sample;
    frame[bin + 64] = sample;
  }
}

function writeBassFrame(frame: number[]): void {
  phase += 0.2 * audioSettings.bassSpeed;
  const pulse
    = 0.12 + 0.88 * ((Math.sin(phase) + 1) / 2) ** 6;
  for (let bin = 0; bin < 64; bin++) {
    const fundamental = Math.exp(-bin / 6);
    const harmonic = 0.4 * Math.exp(-(((bin - 12) / 5) ** 2));
    const sample = Math.min(1, pulse * (fundamental + harmonic));
    frame[bin] = sample;
    frame[bin + 64] = sample;
  }
}

function writeStereoFrame(frame: number[]): void {
  phase += 0.12 * audioSettings.stereoSpeed;
  const rightLevel = (Math.sin(phase) + 1) / 2;
  const leftLevel = 1 - rightLevel;
  for (let bin = 0; bin < 64; bin++) {
    const profile = 0.25 + 0.75 * Math.exp(-bin / 22);
    frame[bin] = profile * leftLevel;
    frame[bin + 64] = profile * rightLevel;
  }
}

function writeTrackFrame(frame: number[]): void {
  const frameIndex = trackFrame;
  trackFrame = (trackFrame + audioSettings.trackTempo / 120) % 60;
  const trackTime = frameIndex / 30;
  const kickAge = (frameIndex % 30) / 30;
  const clapAge = ((frameIndex + 15) % 30) / 30;
  const hatAge = (frameIndex % 5) / 30;
  const kick = Math.exp(-kickAge * 22) * audioSettings.trackKick;
  const clap = Math.exp(-clapAge * 30) * audioSettings.trackClap;
  const hat = Math.exp(-hatAge * 52) * audioSettings.trackHiHat;
  const bassline
    = (0.07
      + 0.05 * (0.5 + 0.5 * Math.sin(trackTime * Math.PI * 2)))
    * audioSettings.trackBassline;

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

const FRAME_WRITERS = {
  silence: writeSilenceFrame,
  random: writeNoiseFrame,
  sine: writeSweepFrame,
  bass: writeBassFrame,
  stereo: writeStereoFrame,
  track: writeTrackFrame,
} satisfies Record<ActiveAudioMode, FrameWriter>;

function applyOutput(frame: number[]): void {
  if (audioSettings.output === 1)
    return;
  for (let index = 0; index < frame.length; index++)
    frame[index] = (frame[index] ?? 0) * audioSettings.output;
}

function tick(): void {
  if (listenerFns.audio.length === 0)
    return;
  const mode = audioState.mode;
  if (mode === 'off')
    return;

  const frame = Array.from<number>({ length: 128 }).fill(0);
  FRAME_WRITERS[mode](frame);
  applyOutput(frame);
  lastFrame.value = frame;
  for (const listener of listenerFns.audio) {
    try {
      listener(frame);
    }
    catch (error) {
      console.error('[WE Dev] audio listener threw', error);
    }
  }
}

export function resetAudioSettings(): void {
  Object.assign(audioSettings, DEFAULT_AUDIO_SETTINGS);
}

export function setAudioMode(mode: AudioMode): void {
  if (audioState.mode !== mode) {
    phase = 0;
    trackFrame = 0;
  }
  audioState.mode = mode;
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (mode === 'off') {
    lastFrame.value = [];
    return;
  }
  timer = globalThis.setInterval(tick, 1000 / 30);
}
