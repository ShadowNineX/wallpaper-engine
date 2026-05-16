<script setup lang="ts">
import { toast } from "vue-sonner";
import { listenerFns, useDevtoolsStore } from "../store";

const store = useDevtoolsStore();
const general = store.general;
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";

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
    <NumberField
      id="general-fps"
      :model-value="general.fps"
      :min="0"
      :max="240"
      @update:model-value="
        (v) => {
          if (v !== undefined) general.fps = v;
        }
      "
    >
      <Label for="general-fps" class="text-[11px] text-we-muted">FPS</Label>
      <NumberFieldContent>
        <NumberFieldDecrement />
        <NumberFieldInput />
        <NumberFieldIncrement />
      </NumberFieldContent>
    </NumberField>
    <Button size="sm" class="w-full" @click="applyFps">Apply general</Button>
  </div>
</template>
