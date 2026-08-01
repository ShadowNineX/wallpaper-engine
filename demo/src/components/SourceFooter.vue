<script setup lang="ts">
import { ChevronRight, Image as ImageIcon, RefreshCw } from "lucide-vue-next";

defineProps<{
  sourceLabel: string;
  randomSource: boolean;
  gallerySource: boolean;
}>();

const emit = defineEmits<{
  shuffle: [];
  advance: [];
}>();
</script>

<template>
  <footer class="footerbar">
    <div class="source-readout">
      <span class="source-icon"><ImageIcon :size="14" /></span>
      <div>
        <span class="micro-label">BACKGROUND SOURCE</span>
        <strong>{{ sourceLabel }}</strong>
      </div>
    </div>
    <button
      v-if="randomSource"
      class="source-action"
      type="button"
      title="Load another random file"
      @click="emit('shuffle')"
    >
      <RefreshCw :size="14" />
      SHUFFLE
    </button>
    <button
      v-else-if="gallerySource"
      class="source-action"
      type="button"
      title="Advance gallery"
      @click="emit('advance')"
    >
      NEXT
      <ChevronRight :size="14" />
    </button>
    <div v-else class="audio-readout">
      <span class="audio-bars"><i /><i /><i /><i /></span>
      AUDIO REACTIVE
    </div>
  </footer>
</template>
