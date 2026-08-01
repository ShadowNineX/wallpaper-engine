<script setup lang="ts">
import { computed } from "vue";
import type { WallpaperSliderValue } from "../../../wallpaper-engine/src/types/listeners";
import type { WallpaperSliderProperty } from "../../../wallpaper-engine/src/types/project";
import { useDevtoolsStore } from "../store";
import { Slider } from "@/components/ui/slider";

const props = defineProps<{
  propKey: string;
  def: WallpaperSliderProperty;
}>();

const store = useDevtoolsStore();
const runtimeValue = computed(
  () => store.currentValues[props.propKey] as WallpaperSliderValue | undefined,
);
const step = computed(
  () =>
    props.def.step ??
    (props.def.fraction ? 10 ** -(props.def.precision ?? 1) : 1),
);

function onSlider(values: number[] | undefined): void {
  const next = values?.[0];
  const current = runtimeValue.value;
  if (next === undefined || !current) return;
  current.value = next;
  store.deliverProperty(props.propKey);
}
</script>

<template>
  <div class="flex items-center gap-3">
    <Slider
      :id="propKey"
      :model-value="[runtimeValue?.value ?? def.value]"
      :min="def.min"
      :max="def.max"
      :step="step"
      class="flex-1"
      @update:model-value="onSlider"
    />
    <span
      class="min-w-12 rounded-md border border-we-border bg-we-panel px-2 py-1 text-right text-[10px] tabular-nums text-we-muted"
    >
      {{ runtimeValue?.value ?? def.value }}
    </span>
  </div>
</template>
