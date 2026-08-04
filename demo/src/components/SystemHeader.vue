<script setup lang="ts">
import { computed } from "vue";
import { Waves } from "lucide-vue-next";

const props = defineProps<{
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
        LIMIT {{ fpsLimitLabel }} · ACTUAL {{ measuredFps }} · Δ
        {{ frameDeltaLabel }} MS
      </span>
    </div>
  </header>
</template>

