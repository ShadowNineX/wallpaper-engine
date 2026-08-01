<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useDevtoolsStore } from "../store";

const { listenerCounts } = storeToRefs(useDevtoolsStore());
const mediaListenerCount = computed(
  () =>
    listenerCounts.value.mediaStatus +
    listenerCounts.value.mediaProps +
    listenerCounts.value.mediaThumb +
    listenerCounts.value.mediaPlayback +
    listenerCounts.value.mediaTimeline,
);

const statuses = computed(() => [
  {
    label: "Properties",
    detail: listenerCounts.value.property ? "ready" : "waiting",
    active: listenerCounts.value.property,
  },
  {
    label: "Plugins",
    detail: listenerCounts.value.plugin ? "ready" : "waiting",
    active: listenerCounts.value.plugin,
  },
  {
    label: "Audio",
    detail: `${listenerCounts.value.audio} listeners`,
    active: listenerCounts.value.audio > 0,
  },
  {
    label: "Media",
    detail: `${mediaListenerCount.value} of 5`,
    active: mediaListenerCount.value > 0,
  },
]);
</script>

<template>
  <div
    class="grid shrink-0 grid-cols-2 gap-1.5 border-b border-we-border bg-we-surface/85 p-2"
  >
    <div
      v-for="status in statuses"
      :key="status.label"
      class="flex min-w-0 items-center gap-2 rounded-md border border-white/8 bg-[linear-gradient(135deg,rgba(91,134,237,0.1),rgba(139,92,246,0.06))] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      :title="`${status.label}: ${status.detail}`"
    >
      <span
        class="size-1.5 shrink-0 rounded-full"
        :class="
          status.active
            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
            : 'bg-we-border-strong'
        "
      />
      <span class="min-w-0 truncate text-[11px] font-medium text-we-muted">
        {{ status.label }}
      </span>
      <span class="ml-auto shrink-0 text-[11px] text-we-faint">
        {{ status.detail }}
      </span>
    </div>
  </div>
</template>
