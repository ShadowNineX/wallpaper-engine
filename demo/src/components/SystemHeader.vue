<script setup lang="ts">
import { computed } from "vue";
import { Waves } from "lucide-vue-next";

const props = defineProps<{
  showDebugInfo: boolean;
  mediaLinked: boolean;
  fpsLimit: number;
  measuredFps: number;
  lastFrameDelta: number;
  audioRmsVolume: number;
  audioDecayingPeakVolume: number;
  audioBeat: number;
  audioBpm: number;
}>();

const fpsLimitLabel = computed(() =>
  props.fpsLimit === 0 ? "∞" : String(props.fpsLimit),
);
const frameDeltaLabel = computed(() =>
  (props.lastFrameDelta * 1_000).toFixed(1),
);
const audioRmsLabel = computed(() => props.audioRmsVolume.toFixed(3));
const audioPeakLabel = computed(() =>
  props.audioDecayingPeakVolume.toFixed(3),
);
const audioBeatLabel = computed(() => props.audioBeat.toFixed(3));
const audioBpmLabel = computed(() =>
  props.audioBpm > 0 ? String(Math.round(props.audioBpm)) : "--",
);
</script>

<template>
  <header v-if="showDebugInfo" class="topbar">
    <div class="system-cluster">
      <span class="system-pill">
        <span class="status-dot" :class="mediaLinked ? 'is-live' : ''" />
        MEDIA {{ mediaLinked ? "LINKED" : "STANDBY" }}
      </span>
      <span
        class="system-pill"
        title="Configured limit · measured render rate · latest rendered-frame delta"
      >
        <Waves :size="13" />
        <span class="system-readout">
          LIMIT <span class="system-value system-value--rate">{{ fpsLimitLabel }}</span>
          · ACTUAL <span class="system-value system-value--rate">{{ measuredFps }}</span>
          · Δ <span class="system-value system-value--delta">{{ frameDeltaLabel }}</span> MS
        </span>
      </span>
      <span
        class="system-pill"
        title="Current RMS level · decaying peak envelope · latest beat strength"
      >
        <span class="system-readout">
          AUDIO RMS <span class="system-value system-value--level">{{ audioRmsLabel }}</span>
          · PEAK <span class="system-value system-value--level">{{ audioPeakLabel }}</span>
          · BEAT <span class="system-value system-value--level">{{ audioBeatLabel }}</span>
          · BPM <span class="system-value">{{ audioBpmLabel }}</span>
        </span>
      </span>
    </div>
  </header>
</template>

