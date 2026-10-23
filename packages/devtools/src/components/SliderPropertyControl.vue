<script setup lang="ts">
import type { WallpaperSliderValue } from '../../../wallpaper-engine/src/types/listeners';
import type { WallpaperSliderProperty } from '../../../wallpaper-engine/src/types/project';
import { computed } from 'vue';
import { tr } from '../config';
import { useDevtoolsStore } from '../store';
import RangeSlider from './RangeSlider.vue';

const props = defineProps<{
  propKey: string;
  def: WallpaperSliderProperty;
}>();

const store = useDevtoolsStore();
const runtimeValue = computed(
  () => store.currentValues[props.propKey] as WallpaperSliderValue | undefined,
);
const step = computed(() => props.def.step || 1);

function onSlider(next: number | undefined): void {
  const current = runtimeValue.value;
  if (next === undefined || !current)
    return;
  // Match the native rzslider's step grid and precision on interaction; the
  // native panel leaves the initial value untouched (enforceStep: false).
  const increments = Number(((next - props.def.min) / step.value).toPrecision(12));
  const snapped = props.def.min + Math.round(increments) * step.value;
  current.value = Number(snapped.toFixed(props.def.precision || 1));
  store.deliverProperty(props.propKey);
}
</script>

<template>
  <div class="flex items-center gap-3">
    <RangeSlider
      :id="propKey"
      :aria-label="tr(def.text)"
      :model-value="runtimeValue?.value ?? def.value"
      :min="def.min"
      :max="def.max"
      :step="step"
      class="flex-1"
      @update:model-value="onSlider"
    />
    <span
      class="min-w-12 rounded-md border border-we-border bg-we-surface px-2 py-1.5 text-right text-[11px] tabular-nums text-we-muted"
    >
      {{ runtimeValue?.value ?? def.value }}
    </span>
  </div>
</template>
