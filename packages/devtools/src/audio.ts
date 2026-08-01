import { reactive, shallowRef } from "vue";
import { listenerFns } from "./store";

export type AudioMode =
  | "off"
  | "silence"
  | "random"
  | "sine"
  | "bass"
  | "stereo";

let timer: ReturnType<typeof setInterval> | null = null;
let phase = 0;
export const audioState = reactive({ mode: "off" as AudioMode });
/** Last 128-sample frame sent to listeners, updated every tick. */
export const lastFrame = shallowRef<number[]>([]);

function tick(): void {
  if (listenerFns.audio.length === 0) return;
  const arr = new Array<number>(128);
  if (audioState.mode === "silence") {
    arr.fill(0);
  } else if (audioState.mode === "random") {
    for (let i = 0; i < 128; i++) {
      const decay = Math.exp(-(i % 64) / 16);
      arr[i] = Math.random() * decay;
    }
  } else if (audioState.mode === "sine") {
    phase += 0.1;
    for (let bin = 0; bin < 64; bin++) {
      const position = bin / 64;
      const sample =
        Math.max(0, Math.sin(phase + position * Math.PI * 2)) *
        (1 - position * 0.6);
      arr[bin] = sample;
      arr[bin + 64] = sample;
    }
  } else if (audioState.mode === "bass") {
    phase += 0.2;
    const pulse =
      0.12 + 0.88 * Math.pow((Math.sin(phase) + 1) / 2, 6);
    for (let bin = 0; bin < 64; bin++) {
      const fundamental = Math.exp(-bin / 6);
      const harmonic = 0.4 * Math.exp(-Math.pow((bin - 12) / 5, 2));
      const sample = Math.min(1, pulse * (fundamental + harmonic));
      arr[bin] = sample;
      arr[bin + 64] = sample;
    }
  } else if (audioState.mode === "stereo") {
    phase += 0.12;
    const rightLevel = (Math.sin(phase) + 1) / 2;
    const leftLevel = 1 - rightLevel;
    for (let bin = 0; bin < 64; bin++) {
      const profile = 0.25 + 0.75 * Math.exp(-bin / 22);
      arr[bin] = profile * leftLevel;
      arr[bin + 64] = profile * rightLevel;
    }
  }
  lastFrame.value = arr;
  for (const fn of listenerFns.audio) {
    try {
      fn(arr);
    } catch (e) {
      console.error("[WE Dev] audio listener threw", e);
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
