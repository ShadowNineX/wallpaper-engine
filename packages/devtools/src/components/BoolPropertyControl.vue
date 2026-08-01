<script setup lang="ts">
import { computed } from "vue";
import type { WallpaperBoolValue } from "../../../wallpaper-engine/src/types/listeners";
import type { WallpaperBoolProperty } from "../../../wallpaper-engine/src/types/project";
import { useDevtoolsStore } from "../store";
import { Checkbox } from "@/components/ui/checkbox";

const props = defineProps<{
  propKey: string;
  def: WallpaperBoolProperty;
}>();

const store = useDevtoolsStore();
const runtimeValue = computed(
  () => store.currentValues[props.propKey] as WallpaperBoolValue | undefined,
);

function onBool(checked: unknown): void {
  const current = runtimeValue.value;
  if (!current) return;
  current.value = checked === true;
  store.deliverProperty(props.propKey);
}
</script>

<template>
  <label
    :for="propKey"
    class="flex cursor-pointer items-center gap-2 text-[11px] text-we-muted"
  >
    <Checkbox
      :id="propKey"
      :model-value="runtimeValue?.value ?? def.value"
      class="size-4.5"
      @update:model-value="onBool"
    />
    <span>{{ runtimeValue?.value ?? def.value ? "Enabled" : "Disabled" }}</span>
  </label>
</template>
