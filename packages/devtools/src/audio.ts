import { reactive, shallowRef } from "vue";
import { listenerFns } from "./store";

export type AudioMode = "off" | "silence" | "random" | "sine";

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
    for (let i = 0; i < 128; i++) {
      const t = (i % 64) / 64;
      arr[i] = Math.max(0, Math.sin(phase + t * Math.PI * 2)) * (1 - t * 0.6);
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
  audioState.mode = mode;
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (mode !== "off") timer = globalThis.setInterval(tick, 1000 / 30);
}
