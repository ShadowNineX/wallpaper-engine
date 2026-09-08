<script setup lang="ts">
import { ChevronRight, RefreshCw } from "lucide-vue-next";

defineProps<{
  randomSource: boolean;
  gallerySource: boolean;
  canShuffle: boolean;
  canAdvance: boolean;
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
      :disabled="!canShuffle"
      :title="
        canShuffle
          ? 'Load another random file'
          : 'Choose a directory to enable shuffle'
      "
      @click="emit('shuffle')"
    >
      <RefreshCw :size="14" />
      SHUFFLE
    </button>
    <button
      v-else-if="gallerySource"
      class="source-action"
      type="button"
      :disabled="!canAdvance"
      :title="
        canAdvance
          ? 'Advance gallery'
          : 'Add at least two files to enable gallery navigation'
      "
      @click="emit('advance')"
    >
      NEXT
      <ChevronRight :size="14" />
    </button>
  </footer>
</template>
