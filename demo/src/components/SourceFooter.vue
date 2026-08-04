<script setup lang="ts">
import { ChevronRight, RefreshCw } from "lucide-vue-next";

defineProps<{
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
  </footer>
</template>
