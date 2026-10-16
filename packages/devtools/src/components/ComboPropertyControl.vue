<script setup lang="ts">
import type { WallpaperComboValue } from '../../../wallpaper-engine/src/types/listeners';
import type { WallpaperComboProperty } from '../../../wallpaper-engine/src/types/project';
import USelect from '@nuxt/ui/components/Select.vue';
import { computed } from 'vue';
import { tr } from '../config';
import { useDevtoolsStore } from '../store';

const props = defineProps<{
  propKey: string;
  def: WallpaperComboProperty;
}>();

const store = useDevtoolsStore();
const runtimeValue = computed(
  () => store.currentValues[props.propKey] as WallpaperComboValue | undefined,
);

const items = computed(() => props.def.options.map(option => ({ label: tr(option.label), value: option.value })));

function onCombo(selected: string): void {
  const current = runtimeValue.value;
  if (!current)
    return;
  const option = props.def.options.find(item => item.value === selected);
  current.value = selected;
  current.text = option ? tr(option.label) : selected;
  store.deliverProperty(props.propKey);
}
</script>

<template>
  <USelect
    :id="propKey"
    :model-value="runtimeValue?.value ?? def.value"
    :items="items"
    class="h-9 w-full bg-we-btn text-[12px] text-we-text hover:bg-we-btn-hover"
    @update:model-value="onCombo"
  />
</template>
