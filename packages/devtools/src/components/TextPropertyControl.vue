<script setup lang="ts">
import { computed } from "vue";
import type { WallpaperTextValue } from "../../../wallpaper-engine/src/types/listeners";
import type { WallpaperTextInputProperty } from "../../../wallpaper-engine/src/types/project";
import { useDevtoolsStore } from "../store";
import { Input } from "@/components/ui/input";

const props = defineProps<{
  propKey: string;
  def: WallpaperTextInputProperty;
}>();

const store = useDevtoolsStore();
const runtimeValue = computed(
  () => store.currentValues[props.propKey] as WallpaperTextValue | undefined,
);

function onText(next: string | number): void {
  const current = runtimeValue.value;
  if (!current) return;
  current.value = String(next);
  store.deliverProperty(props.propKey);
}
</script>

<template>
  <Input
    :id="propKey"
    type="text"
    :model-value="runtimeValue?.value ?? def.value"
    class="h-8 text-xs"
    @update:model-value="onText"
  />
</template>
