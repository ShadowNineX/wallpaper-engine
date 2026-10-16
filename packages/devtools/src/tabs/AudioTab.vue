<script setup lang="ts">
import type { Component } from 'vue';
import type { AudioMode, AudioSettings } from '../audio';
import UButton from '@nuxt/ui/components/Button.vue';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue';
import ArrowsLeftRight from '~icons/ph/arrows-left-right-duotone';
import Heartbeat from '~icons/ph/heartbeat-duotone';
import SpeakerSlash from '~icons/ph/speaker-slash-duotone';
import WaveSine from '~icons/ph/wave-sine-duotone';
import AudioLines from '~icons/ph/waveform-duotone';
import WaveformSlash from '~icons/ph/waveform-slash-duotone';
import {
  AUDIO_MODE_LABELS,
  audioSettings,
  audioState,
  lastFrame,
  setAudioMode,
} from '../audio';
import CallbackStatus from '../components/CallbackStatus.vue';
import RangeSlider from '../components/RangeSlider.vue';
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
const activeModeDescription = computed(
  () => modes.find(mode => mode.value === audioState.mode)?.description ?? '',
);
const audioListenerLabel = computed(() => `${listenerCounts.value.audio} registered audio ${listenerCounts.value.audio === 1 ? 'listener' : 'listeners'}`);
const spectrumCanRender = computed(
  () => audioState.mode !== 'off' && listenerCounts.value.audio > 0,
);
const spectrumStatus = computed(() => {
  if (audioState.mode === 'off') {
    return {
      label: 'Stopped',
      description: 'Callbacks are stopped. Choose a mode to begin.',
      tone: 'text-we-faint',
      dot: 'bg-we-faint',
    };
  }
  if (listenerCounts.value.audio === 0) {
    return {
      label: 'Waiting',
      description: 'No audio listener is registered.',
      tone: 'text-amber-300',
      dot: 'bg-amber-300',
    };
  }
  if (audioState.mode === 'silence') {
    return {
      label: 'Silence',
      description: `Sending a zeroed spectrum to ${audioListenerLabel.value}.`,
      tone: 'text-we-muted',
      dot: 'bg-we-muted',
    };
  }
  return {
    label: 'Live',
    description: `Streaming ${AUDIO_MODE_LABELS[audioState.mode]} at about 30 Hz.`,
    tone: 'text-emerald-300',
    dot: 'bg-emerald-300',
  };
});
const spectrumAriaLabel = computed(
  () => `Stereo spectrum preview: left channel above, right channel below. ${spectrumStatus.value.label}: ${spectrumStatus.value.description}`,
);
function updateAudioSetting(
  key: keyof AudioSettings,
  value: number | number[] | undefined,
): void {
  const next = Array.isArray(value) ? value[0] : value;
  if (next !== undefined)
    audioSettings[key] = next;
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
      spectrumCanRender.value,
    );
  }
  animationFrame = requestAnimationFrame(drawFrame);
}

onMounted(drawFrame);
onBeforeUnmount(() => cancelAnimationFrame(animationFrame));
</script>

<template>
  <div>
    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">
            Audio simulation
          </h2>
          <p class="we-card-description text-pretty">
            Preview 128-sample stereo spectrum frames generated at about 30 Hz.
          </p>
        </div>
        <CallbackStatus
          :ready="listenerCounts.audio > 0"
          :ready-label="audioListenerLabel"
          missing-label="Waiting for audio listener"
        />
      </div>

      <div class="mb-4 overflow-hidden rounded-lg border border-we-border bg-we-surface">
        <canvas
          ref="canvas"
          width="392"
          height="56"
          class="block h-14 w-full px-1.5 pt-1.5"
          :aria-label="spectrumAriaLabel"
          aria-describedby="we-audio-spectrum-status"
        />
        <div
          id="we-audio-spectrum-status"
          role="status"
          aria-live="polite"
          class="flex min-w-0 items-center gap-2 border-t border-we-border/70 px-2.5 py-2 text-[10px] leading-4"
        >
          <span
            class="size-1.5 shrink-0 rounded-full"
            :class="spectrumStatus.dot"
            aria-hidden="true"
          />
          <span class="shrink-0 font-semibold" :class="spectrumStatus.tone">
            {{ spectrumStatus.label }}
          </span>
          <span class="truncate text-we-faint">
            {{ spectrumStatus.description }}
          </span>
        </div>
      </div>

      <div
        class="we-audio-modes grid w-full rounded-xl border border-we-border bg-we-surface p-1"
        aria-label="Audio processing mode"
      >
        <UButton
          v-for="mode in modes"
          :key="mode.value"
          type="button"
          color="primary"
          :variant="audioState.mode === mode.value ? 'soft' : 'ghost'"
          :aria-pressed="audioState.mode === mode.value"
          class="h-10 min-w-0 justify-center gap-1.5 whitespace-nowrap px-2 text-[11px] transition-[background-color,color,box-shadow]"
          :title="mode.description"
          @click="setAudioMode(mode.value)"
        >
          <component
            :is="mode.icon"
            class="size-3.5 shrink-0"
            aria-hidden="true"
          />
          <span class="truncate font-medium leading-4">
            {{ AUDIO_MODE_LABELS[mode.value] }}
          </span>
        </UButton>
      </div>
      <p class="mt-2 min-h-4 text-[11px] leading-4 text-we-faint" aria-live="polite">
        {{ activeModeDescription }}
      </p>

      <div
        v-if="activeControls.length > 0"
        class="mt-5 space-y-5 border-t border-we-border pt-4"
      >
        <div
          v-for="control in activeControls"
          :key="control.key"
          class="grid gap-1.5"
        >
          <div class="flex min-w-0 items-baseline justify-between gap-3">
            <div class="flex min-w-0 items-baseline gap-2">
              <label
                :for="`audio-${control.key}`"
                class="we-field-label shrink-0 text-we-text"
              >
                {{ control.label }}
              </label>
              <span class="truncate text-[10px] text-we-faint">
                {{ control.description }}
              </span>
            </div>
            <output
              :for="`audio-${control.key}`"
              class="min-w-14 shrink-0 text-right font-mono text-[11px] font-medium tabular-nums text-we-muted"
            >
              {{ formatAudioSetting(control) }}
            </output>
          </div>
          <RangeSlider
            :id="`audio-${control.key}`"
            :aria-label="control.label"
            :aria-valuetext="formatAudioSetting(control)"
            :model-value="audioSettings[control.key]"
            :min="control.min"
            :max="control.max"
            :step="control.step"
            class="min-w-0 py-1"
            @update:model-value="
              (value) => updateAudioSetting(control.key, value)
            "
          />
        </div>
      </div>
    </section>
  </div>
</template>
