<script setup lang="ts">
import { type AudioMode, audioState, setAudioMode } from "../audio";
import { listenerCounts } from "../state";
import { Button } from "@/components/ui/button";

const modes: AudioMode[] = ["off", "silence", "random", "sine"];

function pick(m: AudioMode): void {
  setAudioMode(m);
}
</script>

<template>
  <div class="space-y-3 rounded-md border border-we-border bg-we-section p-2.5">
    <h3
      class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
    >
      Synthetic audio (30 fps)
    </h3>
    <div class="flex flex-wrap gap-1.5">
      <Button
        v-for="m in modes"
        :key="m"
        size="sm"
        :variant="audioState.mode === m ? 'default' : 'outline'"
        @click="pick(m)"
      >
        {{ m }}
      </Button>
    </div>
    <p class="text-[11px] text-we-faint mt-1">
      {{ listenerCounts.audio }} audio listener(s) registered.
    </p>
  </div>
</template>
