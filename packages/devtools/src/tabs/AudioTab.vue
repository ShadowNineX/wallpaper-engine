<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from "vue";
import { storeToRefs } from "pinia";
import AudioLines from "~icons/ph/waveform-duotone";
import { type AudioMode, audioState, lastFrame, setAudioMode } from "../audio";
import { useDevtoolsStore } from "../store";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const { listenerCounts } = storeToRefs(useDevtoolsStore());
const modes: Array<{ value: AudioMode; label: string; description: string }> = [
  { value: "off", label: "Off", description: "Stops callbacks" },
  { value: "silence", label: "Silence", description: "Zeroed spectrum" },
  { value: "random", label: "Noise", description: "Reactive spectrum" },
  { value: "sine", label: "Sweep", description: "Frequency sweep" },
  { value: "bass", label: "Bass pulse", description: "Low-end pulse" },
  { value: "stereo", label: "Stereo pan", description: "Left-right motion" },
];

const canvas = shallowRef<HTMLCanvasElement | null>(null);
let animationFrame = 0;

function drawFrame(): void {
  const target = canvas.value;
  const context = target?.getContext("2d");
  if (target && context) {
    const width = target.width;
    const height = target.height;
    const frame = lastFrame.value;
    const active = audioState.mode !== "off";
    context.clearRect(0, 0, width, height);

    const centerY = height / 2;
    const labelWidth = 12;
    const plotWidth = width - labelWidth;
    const barWidth = plotWidth / 64;
    const barSize = Math.max(1, barWidth - 1.5);
    const channelHeight = centerY - 3;

    context.fillStyle = "rgba(86, 93, 107, 0.55)";
    context.fillRect(labelWidth, centerY - 0.5, plotWidth, 1);

    if (active) {
      const leftGradient = context.createLinearGradient(0, centerY, 0, 0);
      leftGradient.addColorStop(0, "rgba(44, 95, 208, 0.45)");
      leftGradient.addColorStop(1, "rgba(96, 165, 250, 0.95)");
      context.fillStyle = leftGradient;
      for (let bin = 0; bin < 64; bin++) {
        const barHeight = (frame[bin] ?? 0) * channelHeight;
        if (barHeight <= 0) continue;
        context.fillRect(
          labelWidth + bin * barWidth + 0.5,
          centerY - barHeight,
          barSize,
          barHeight,
        );
      }

      const rightGradient = context.createLinearGradient(
        0,
        centerY,
        0,
        height,
      );
      rightGradient.addColorStop(0, "rgba(109, 72, 190, 0.45)");
      rightGradient.addColorStop(1, "rgba(167, 139, 250, 0.95)");
      context.fillStyle = rightGradient;
      for (let bin = 0; bin < 64; bin++) {
        const barHeight = (frame[bin + 64] ?? 0) * channelHeight;
        if (barHeight <= 0) continue;
        context.fillRect(
          labelWidth + bin * barWidth + 0.5,
          centerY + 1,
          barSize,
          barHeight,
        );
      }
    }

    context.font = '8px "JetBrains Mono Variable", monospace';
    context.textBaseline = "middle";
    context.fillStyle = active ? "#83a7ff" : "#6c6f78";
    context.fillText("L", 1, centerY - 7);
    context.fillStyle = active ? "#b49cff" : "#6c6f78";
    context.fillText("R", 1, centerY + 8);
  }
  animationFrame = requestAnimationFrame(drawFrame);
}

onMounted(drawFrame);
onBeforeUnmount(() => cancelAnimationFrame(animationFrame));
</script>

<template>
  <div class="space-y-3">
    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">Audio processing</h2>
          <p class="we-card-description">
            Send 128-sample stereo spectrum frames at approximately 30 Hz.
          </p>
        </div>
        <div
          class="flex size-8 items-center justify-center rounded-lg"
          :class="
            audioState.mode !== 'off'
              ? 'bg-amber-400/15 text-amber-300'
              : 'bg-we-panel text-we-faint'
          "
        >
          <AudioLines class="size-4" />
        </div>
      </div>

      <div
        class="mb-3 overflow-hidden rounded-lg border border-we-border bg-we-panel/80 p-1.5"
      >
        <canvas
          ref="canvas"
          width="392"
          height="56"
          class="block h-14 w-full"
          aria-label="Stereo spectrum preview: left channel above, right channel below"
        />
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        :spacing="1.5"
        :model-value="audioState.mode"
        class="grid w-full grid-cols-3"
        aria-label="Audio processing mode"
        @update:model-value="
          (value) => {
            if (value) setAudioMode(value as AudioMode);
          }
        "
      >
        <ToggleGroupItem
          v-for="mode in modes"
          :key="mode.value"
          :value="mode.value"
          class="h-auto min-w-0 flex-col gap-1.5 whitespace-normal rounded-lg border-we-border/80 bg-we-panel/40 px-3 py-3 shadow-sm transition-colors hover:border-we-border-strong hover:bg-we-button-hover data-[state=on]:border-we-primary/60 data-[state=on]:bg-we-primary/15 data-[state=on]:text-we-text"
          :title="mode.description"
        >
          <span class="text-[11px] font-medium leading-4">{{ mode.label }}</span>
          <span
            class="min-h-4 w-full text-center text-[10px] leading-4 font-normal opacity-60"
          >
            {{ mode.description }}
          </span>
        </ToggleGroupItem>
      </ToggleGroup>
    </section>

    <div
      class="flex items-center gap-2 rounded-lg border border-we-border bg-we-surface px-3 py-2.5"
    >
      <span
        class="size-2 rounded-full"
        :class="listenerCounts.audio > 0 ? 'bg-emerald-400' : 'bg-we-border-strong'"
      />
      <div class="min-w-0 flex-1">
        <div class="text-[11px] font-medium text-we-muted">
          {{ listenerCounts.audio }} registered audio
          {{ listenerCounts.audio === 1 ? "listener" : "listeners" }}
        </div>
        <div class="text-[10px] text-we-faint">
          {{
            listenerCounts.audio > 0
              ? "Frames are delivered while a source is active."
              : "Waiting for wallpaperRegisterAudioListener."
          }}
        </div>
      </div>
    </div>
  </div>
</template>
