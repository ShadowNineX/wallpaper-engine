import { reactive, shallowRef } from "vue";
import { listenerFns } from "./store";

export type AudioMode =
  | "off"
  | "silence"
  | "random"
  | "sine"
  | "bass"
  | "stereo";

export const AUDIO_MODE_LABELS = {
  off: "Off",
  silence: "Silence",
  random: "Noise",
  sine: "Sweep",
  bass: "Bass pulse",
  stereo: "Stereo pan",
} as const satisfies Record<AudioMode, string>;

let timer: ReturnType<typeof setInterval> | null = null;
let phase = 0;
export const audioState = reactive({ mode: "off" as AudioMode });
/** Last 128-sample frame sent to listeners, updated every tick. */
export const lastFrame = shallowRef<number[]>([]);

type ActiveAudioMode = Exclude<AudioMode, "off">;
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
  phase += 0.1;
  for (let bin = 0; bin < 64; bin++) {
    const position = bin / 64;
    const sample =
      Math.max(0, Math.sin(phase + position * Math.PI * 2)) *
      (1 - position * 0.6);
    frame[bin] = sample;
    frame[bin + 64] = sample;
  }
}

function writeBassFrame(frame: number[]): void {
  phase += 0.2;
  const pulse =
    0.12 + 0.88 * Math.pow((Math.sin(phase) + 1) / 2, 6);
  for (let bin = 0; bin < 64; bin++) {
    const fundamental = Math.exp(-bin / 6);
    const harmonic = 0.4 * Math.exp(-Math.pow((bin - 12) / 5, 2));
    const sample = Math.min(1, pulse * (fundamental + harmonic));
    frame[bin] = sample;
    frame[bin + 64] = sample;
  }
}

function writeStereoFrame(frame: number[]): void {
  phase += 0.12;
  const rightLevel = (Math.sin(phase) + 1) / 2;
  const leftLevel = 1 - rightLevel;
  for (let bin = 0; bin < 64; bin++) {
    const profile = 0.25 + 0.75 * Math.exp(-bin / 22);
    frame[bin] = profile * leftLevel;
    frame[bin + 64] = profile * rightLevel;
  }
}

const FRAME_WRITERS = {
  silence: writeSilenceFrame,
  random: writeNoiseFrame,
  sine: writeSweepFrame,
  bass: writeBassFrame,
  stereo: writeStereoFrame,
} satisfies Record<ActiveAudioMode, FrameWriter>;

function tick(): void {
  if (listenerFns.audio.length === 0) return;
  const mode = audioState.mode;
  if (mode === "off") return;

  const frame = new Array<number>(128);
  FRAME_WRITERS[mode](frame);
  lastFrame.value = frame;
  for (const listener of listenerFns.audio) {
    try {
      listener(frame);
    } catch (error) {
      console.error("[WE Dev] audio listener threw", error);
    }
  }
}

export function setAudioMode(mode: AudioMode): void {
  if (audioState.mode !== mode) phase = 0;
  audioState.mode = mode;
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (mode === "off") {
    lastFrame.value = [];
    return;
  }
  timer = globalThis.setInterval(tick, 1000 / 30);
}
