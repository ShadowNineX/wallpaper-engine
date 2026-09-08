<script setup lang="ts">
defineProps<{
  ready: boolean;
  readyLabel: string;
  missingLabel: string;
}>();
</script>

<template>
  <div
    class="we-callback-status"
    :class="ready ? 'text-emerald-300' : 'text-we-faint'"
  >
    <span
      class="size-1.5 shrink-0 rounded-full"
      :class="ready ? 'bg-emerald-400' : 'bg-we-border-strong'"
      aria-hidden="true"
    />
    <span>{{ ready ? readyLabel : missingLabel }}</span>
  </div>
</template>
