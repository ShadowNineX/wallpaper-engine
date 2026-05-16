<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from "vue";
import { type AudioMode, audioState, lastFrame, setAudioMode } from "../audio";
import { useDevtoolsStore } from "../store";
import { storeToRefs } from "pinia";

const { listenerCounts } = storeToRefs(useDevtoolsStore());
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const modes: AudioMode[] = ["off", "silence", "random", "sine"];
const canvas = shallowRef<HTMLCanvasElement | null>(null);
let raf = 0;

function pick(m: AudioMode): void {
  setAudioMode(m);
}

function drawFrame(): void {
  const c = canvas.value;
  if (c) {
    const ctx = c.getContext("2d");
    if (ctx) {
      const frame = lastFrame.value;
      const W = c.width;
      const H = c.height;
      ctx.clearRect(0, 0, W, H);
      const barCount = 64;
      const barW = W / barCount;
      const active = audioState.mode !== "off";
      for (let i = 0; i < barCount; i++) {
        const sample = frame[i] ?? 0;
        const h = Math.max(1, sample * H);
        ctx.fillStyle = active
          ? "rgba(59,130,246,0.8)"
          : "rgba(100,100,110,0.3)";
        ctx.fillRect(i * barW + 0.5, H - h, barW - 1, h);
      }
    }
  }
  raf = requestAnimationFrame(drawFrame);
}

onMounted(() => {
  drawFrame();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
});
</script>

<template>
  <div class="space-y-3 rounded-md border border-we-border bg-we-section p-2.5">
    <div class="flex items-center justify-between">
      <h3
        class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
      >
        Synthetic audio
      </h3>
      <div class="flex items-center gap-1.5">
        <span
          class="inline-block size-2 rounded-full transition-colors"
          :class="
            audioState.mode !== 'off' ? 'bg-amber-400' : 'bg-we-border-strong'
          "
        />
        <span class="text-[10px] text-we-faint capitalize">{{
          audioState.mode
        }}</span>
      </div>
    </div>
    <canvas
      ref="canvas"
      width="320"
      height="40"
      class="w-full rounded bg-we-panel/60"
    />
    <ToggleGroup
      type="single"
      :model-value="audioState.mode"
      size="sm"
      class="flex flex-wrap justify-start gap-1.5"
      @update:model-value="
        (v) => {
          if (v) pick(v as AudioMode);
        }
      "
    >
      <ToggleGroupItem
        v-for="m in modes"
        :key="m"
        :value="m"
        class="h-7 px-3 text-xs capitalize"
      >
        {{ m }}
      </ToggleGroupItem>
    </ToggleGroup>
    <p class="text-[11px] text-we-faint">
      {{ listenerCounts.audio }} audio listener(s) registered.
    </p>
  </div>
</template>
