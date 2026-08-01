<script setup lang="ts">
import { computed } from "vue";
import type { WallpaperComboValue } from "../../../wallpaper-engine/src/types/listeners";
import type { WallpaperComboProperty } from "../../../wallpaper-engine/src/types/project";
import { tr } from "../config";
import { useDevtoolsStore } from "../store";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

const props = defineProps<{
  propKey: string;
  def: WallpaperComboProperty;
}>();

const store = useDevtoolsStore();
const runtimeValue = computed(
  () => store.currentValues[props.propKey] as WallpaperComboValue | undefined,
);

function onCombo(event: Event): void {
  const selected = (event.target as HTMLSelectElement).value;
  const current = runtimeValue.value;
  if (!current) return;
  const option = props.def.options.find((item) => item.value === selected);
  current.value = selected;
  current.text = option ? tr(option.label) : selected;
  store.deliverProperty(props.propKey);
}
</script>

<template>
  <div class="*:data-[slot=native-select-wrapper]:w-full">
    <NativeSelect
      :id="propKey"
      :model-value="runtimeValue?.value ?? def.value"
      class="h-8 w-full bg-we-btn text-xs text-we-text hover:bg-we-btn-hover"
      @change="onCombo"
    >
      <NativeSelectOption
        v-for="option in def.options"
        :key="option.value"
        :value="option.value"
      >
        {{ tr(option.label) }}
      </NativeSelectOption>
    </NativeSelect>
  </div>
</template>
