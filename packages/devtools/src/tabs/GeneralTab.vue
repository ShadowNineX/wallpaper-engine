<script setup lang="ts">
import { general, listenerFns, toast } from "../state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function applyFps(): void {
  const l = listenerFns.property;
  if (!l?.applyGeneralProperties) {
    toast("No general listener");
    return;
  }
  l.applyGeneralProperties({ fps: general.fps });
  toast(`FPS → ${general.fps}`);
}
</script>

<template>
  <div class="space-y-3 rounded-md border border-we-border bg-we-section p-2.5">
    <h3
      class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
    >
      General
    </h3>
    <div class="grid grid-cols-[110px_1fr] items-center gap-2">
      <Label for="general-fps" class="text-[11px] text-we-muted">FPS</Label>
      <Input
        id="general-fps"
        v-model.number="general.fps"
        type="number"
        min="0"
        max="240"
        class="h-7 text-xs"
      />
    </div>
    <Button size="sm" @click="applyFps">Apply general</Button>
  </div>
</template>
