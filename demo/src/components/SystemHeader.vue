<script setup lang="ts">
import { computed } from "vue";
import { Sparkles, Waves } from "lucide-vue-next";

const props = defineProps<{
  greeting: string;
  showDebugInfo: boolean;
  mediaLinked: boolean;
  fpsLimit: number;
  measuredFps: number;
  lastFrameDelta: number;
}>();

const fpsLimitLabel = computed(() =>
  props.fpsLimit === 0 ? "∞" : String(props.fpsLimit),
);
const frameDeltaLabel = computed(() =>
  (props.lastFrameDelta * 1_000).toFixed(1),
);
</script>

<template>
  <header class="topbar">
    <div class="brand-lockup">
      <span class="brand-mark"><Sparkles :size="15" /></span>
      <div>
        <p class="eyebrow">{{ greeting }}</p>
        <p class="brand-subtitle">Reactive desktop atmosphere</p>
      </div>
    </div>
    <div v-if="showDebugInfo" class="system-cluster">
      <span class="system-pill">
        <span class="status-dot" :class="mediaLinked ? 'is-live' : ''" />
        MEDIA {{ mediaLinked ? "LINKED" : "STANDBY" }}
      </span>
      <span
        class="system-pill"
        title="Configured limit · measured render rate · latest rendered-frame delta"
      >
        <Waves :size="13" />
        LIMIT {{ fpsLimitLabel }} · ACTUAL {{ measuredFps }} · Δ
        {{ frameDeltaLabel }} MS
      </span>
    </div>
  </header>
</template>
