<script setup lang="ts">
import type { WallpaperTextValue } from '../../../wallpaper-engine/src/types/listeners';
import type { WallpaperTextInputProperty } from '../../../wallpaper-engine/src/types/project';
import UInput from '@nuxt/ui/components/Input.vue';
import { computed } from 'vue';
import { useDevtoolsStore } from '../store';

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
  if (!current)
    return;
  current.value = String(next);
  store.deliverProperty(props.propKey);
}
</script>

<template>
  <UInput
    :id="propKey"
    type="text"
    :model-value="runtimeValue?.value ?? def.value"
    class="h-9 text-[12px]"
    @update:model-value="onText"
  />
</template>
