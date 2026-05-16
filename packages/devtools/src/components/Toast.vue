<script setup lang="ts">
import { lastToast } from "../state";
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150 ease-in"
    leave-active-class="transition-opacity duration-150 ease-in"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="lastToast"
      class="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-we-primary px-2.5 py-1 text-[11px] text-white pointer-events-none whitespace-nowrap"
    >
      {{ lastToast }}
    </div>
  </Transition>
</template>
