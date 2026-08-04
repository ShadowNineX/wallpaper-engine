<script setup lang="ts">
import type { Component } from 'vue';
import type { AudioMode, AudioSettings } from '../audio';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue';
import ArrowsLeftRight from '~icons/ph/arrows-left-right-duotone';
import Heartbeat from '~icons/ph/heartbeat-duotone';
import SpeakerSlash from '~icons/ph/speaker-slash-duotone';
import WaveSine from '~icons/ph/wave-sine-duotone';
import AudioLines from '~icons/ph/waveform-duotone';
import WaveformSlash from '~icons/ph/waveform-slash-duotone';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  AUDIO_MODE_LABELS,
  audioSettings,
  audioState,
  lastFrame,
  setAudioMode,
} from '../audio';
import { useDevtoolsStore } from '../store';

const { listenerCounts } = storeToRefs(useDevtoolsStore());
const modes: Array<{
  value: AudioMode;
  description: string;
  icon: Component;
}> = [
  {
    value: 'off',
    description: 'Stops callbacks',
    icon: SpeakerSlash,
  },
  {
    value: 'silence',
    description: 'Zeroed spectrum',
    icon: WaveformSlash,
  },
  {
    value: 'random',
    description: 'Reactive spectrum',
    icon: AudioLines,
  },
  {
    value: 'sine',
    description: 'Frequency sweep',
    icon: WaveSine,
  },
  {
    value: 'bass',
    description: 'Low-end pulse',
    icon: Heartbeat,
  },
  {
    value: 'stereo',
    description: 'Left-right motion',
    icon: ArrowsLeftRight,
  },
  {
    value: 'track',
    description: 'Kick, clap, and hats',
    icon: AudioLines,
  },
];

interface AudioControl {
  key: keyof AudioSettings;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  format: 'percent' | 'rate' | 'tempo';
}

const outputControl = {
  key: 'output',
  label: 'Output',
  description: 'Final spectrum level',
  min: 0,
  max: 1,
  step: 0.05,
  format: 'percent',
} satisfies AudioControl;

const modeControls: Partial<Record<AudioMode, readonly AudioControl[]>> = {
  random: [outputControl],
  sine: [
    outputControl,
    {
      key: 'sweepSpeed',
      label: 'Sweep rate',
      description: 'Frequency travel speed',
      min: 0.25,
      max: 2,
      step: 0.05,
      format: 'rate',
    },
  ],
  bass: [
    outputControl,
    {
      key: 'bassSpeed',
      label: 'Pulse rate',
      description: 'Low-end pulse speed',
      min: 0.25,
      max: 2,
      step: 0.05,
      format: 'rate',
    },
  ],
  stereo: [
    outputControl,
    {
      key: 'stereoSpeed',
      label: 'Pan rate',
      description: 'Left-right travel speed',
      min: 0.25,
      max: 2,
      step: 0.05,
      format: 'rate',
    },
  ],
  track: [
    outputControl,
    {
      key: 'trackTempo',
      label: 'Tempo',
      description: 'Track playback speed',
      min: 60,
      max: 180,
      step: 5,
      format: 'tempo',
    },
    {
      key: 'trackBassline',
      label: 'Continuous bass',
      description: 'Sustained low-end bed',
      min: 0,
      max: 1.5,
      step: 0.05,
      format: 'percent',
    },
    {
      key: 'trackKick',
      label: 'Kick',
      description: 'Low-frequency transient',
      min: 0,
      max: 1.5,
      step: 0.05,
      format: 'percent',
    },
    {
      key: 'trackClap',
      label: 'Clap',
      description: 'Mid-frequency transient',
      min: 0,
      max: 1.5,
      step: 0.05,
      format: 'percent',
    },
    {
      key: 'trackHiHat',
      label: 'Hi-hat',
      description: 'High-frequency transient',
      min: 0,
      max: 1.5,
      step: 0.05,
      format: 'percent',
    },
  ],
};

const activeControls = computed<readonly AudioControl[]>(
  () => modeControls[audioState.mode] ?? [],
);
function updateAudioSetting(
  key: keyof AudioSettings,
  values: number[] | undefined,
): void {
  const value = values?.[0];
  if (value !== undefined)
    audioSettings[key] = value;
}

function formatAudioSetting(control: AudioControl): string {
  const value = audioSettings[control.key];
  if (control.format === 'tempo')
    return `${Math.round(value)} BPM`;
  if (control.format === 'rate')
    return `${value.toFixed(2)}×`;
  return `${Math.round(value * 100)}%`;
}

const canvas = shallowRef<HTMLCanvasElement | null>(null);
let animationFrame = 0;

interface ChannelStyle {
  sampleOffset: number;
  direction: -1 | 1;
  nearColor: string;
  farColor: string;
}

const LEFT_CHANNEL_STYLE = {
  sampleOffset: 0,
  direction: -1,
  nearColor: 'rgba(44, 95, 208, 0.45)',
  farColor: 'rgba(96, 165, 250, 0.95)',
} satisfies ChannelStyle;

const RIGHT_CHANNEL_STYLE = {
  sampleOffset: 64,
  direction: 1,
  nearColor: 'rgba(109, 72, 190, 0.45)',
  farColor: 'rgba(167, 139, 250, 0.95)',
} satisfies ChannelStyle;

function drawChannel(
  context: CanvasRenderingContext2D,
  frame: readonly number[],
  width: number,
  height: number,
  style: ChannelStyle,
): void {
  const centerY = height / 2;
  const labelWidth = 12;
  const plotWidth = width - labelWidth;
  const barWidth = plotWidth / 64;
  const barSize = Math.max(1, barWidth - 1.5);
  const channelHeight = centerY - 3;
  const gradientEndY = style.direction === -1 ? 0 : height;
  const gradient = context.createLinearGradient(0, centerY, 0, gradientEndY);
  gradient.addColorStop(0, style.nearColor);
  gradient.addColorStop(1, style.farColor);
  context.fillStyle = gradient;

  for (let bin = 0; bin < 64; bin++) {
    const barHeight = (frame[style.sampleOffset + bin] ?? 0) * channelHeight;
    if (barHeight <= 0)
      continue;
    const barY
      = style.direction === -1 ? centerY - barHeight : centerY + 1;
    context.fillRect(
      labelWidth + bin * barWidth + 0.5,
      barY,
      barSize,
      barHeight,
    );
  }
}

function drawChannelLabels(
  context: CanvasRenderingContext2D,
  height: number,
  active: boolean,
): void {
  const centerY = height / 2;
  context.font = '8px "JetBrains Mono Variable", monospace';
  context.textBaseline = 'middle';
  context.fillStyle = active ? '#83a7ff' : '#6c6f78';
  context.fillText('L', 1, centerY - 7);
  context.fillStyle = active ? '#b49cff' : '#6c6f78';
  context.fillText('R', 1, centerY + 8);
}

function renderSpectrum(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: readonly number[],
  active: boolean,
): void {
  context.clearRect(0, 0, width, height);
  const centerY = height / 2;
  const labelWidth = 12;
  context.fillStyle = 'rgba(86, 93, 107, 0.55)';
  context.fillRect(labelWidth, centerY - 0.5, width - labelWidth, 1);

  if (active) {
    drawChannel(context, frame, width, height, LEFT_CHANNEL_STYLE);
    drawChannel(context, frame, width, height, RIGHT_CHANNEL_STYLE);
  }
  drawChannelLabels(context, height, active);
}

function drawFrame(): void {
  const target = canvas.value;
  const context = target?.getContext('2d');
  if (target && context) {
    renderSpectrum(
      context,
      target.width,
      target.height,
      lastFrame.value,
      audioState.mode !== 'off',
    );
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
          <h2 class="we-card-title">
            Audio processing
          </h2>
          <p class="we-card-description text-pretty">
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
        class="grid w-full grid-cols-2"
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
          <span
            class="flex size-7 items-center justify-center rounded-md transition-colors"
            :class="
              audioState.mode === mode.value
                ? 'bg-we-primary/20 text-we-primary'
                : 'bg-we-surface/70 text-we-faint'
            "
          >
            <component :is="mode.icon" class="size-4" aria-hidden="true" />
          </span>
          <span class="text-[11px] font-medium leading-4">
            {{ AUDIO_MODE_LABELS[mode.value] }}
          </span>
          <span
            class="min-h-4 w-full text-center text-[10px] leading-4 font-normal opacity-60"
          >
            {{ mode.description }}
          </span>
        </ToggleGroupItem>
      </ToggleGroup>

      <div
        v-if="activeControls.length > 0"
        class="mt-3 space-y-3 rounded-lg border border-we-border bg-we-panel/55 p-3"
      >
        <div>
          <div class="text-[11px] font-semibold text-we-text">
            Simulation controls
          </div>
          <div class="mt-0.5 text-[10px] text-we-faint">
            Tune the selected development signal in real time.
          </div>
        </div>
        <div
          v-for="control in activeControls"
          :key="control.key"
          class="we-field"
        >
          <div>
            <Label
              :for="`audio-${control.key}`"
              class="we-field-label"
            >
              {{ control.label }}
            </Label>
            <div class="mt-0.5 text-[10px] text-we-faint">
              {{ control.description }}
            </div>
          </div>
          <div class="flex min-w-0 items-center gap-3">
            <Slider
              :id="`audio-${control.key}`"
              :aria-label="control.label"
              :model-value="[audioSettings[control.key]]"
              :min="control.min"
              :max="control.max"
              :step="control.step"
              class="min-w-0 flex-1"
              @update:model-value="
                (values) => updateAudioSetting(control.key, values)
              "
            />
            <span
              class="min-w-14 rounded-md border border-we-border bg-we-surface px-2 py-1 text-right text-[10px] tabular-nums text-we-muted"
            >
              {{ formatAudioSetting(control) }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <div
      class="flex items-center gap-2 rounded-lg border border-we-border bg-we-surface px-3 py-2.5"
    >
      <span
        class="size-2 rounded-full"
        :class="
          listenerCounts.audio > 0 ? 'bg-emerald-400' : 'bg-we-border-strong'
        "
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
