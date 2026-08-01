<script setup lang="ts">
import type {
  WallpaperBoolProperty,
  WallpaperColorProperty,
  WallpaperComboProperty,
  WallpaperSliderProperty,
  WallpaperTextInputProperty,
} from '../../../wallpaper-engine/src/types/project';
import BoolPropertyControl from './BoolPropertyControl.vue';
import ColorPropertyControl from './ColorPropertyControl.vue';
import ComboPropertyControl from './ComboPropertyControl.vue';
import SliderPropertyControl from './SliderPropertyControl.vue';
import TextPropertyControl from './TextPropertyControl.vue';

type ValuePropertyDefinition
  = | WallpaperBoolProperty
    | WallpaperColorProperty
    | WallpaperComboProperty
    | WallpaperSliderProperty
    | WallpaperTextInputProperty;

defineProps<{
  propKey: string;
  def: ValuePropertyDefinition;
}>();
</script>

<template>
  <ColorPropertyControl
    v-if="def.type === 'color'"
    :prop-key="propKey"
    :def="def"
  />
  <SliderPropertyControl
    v-else-if="def.type === 'slider'"
    :prop-key="propKey"
    :def="def"
  />
  <BoolPropertyControl
    v-else-if="def.type === 'bool'"
    :prop-key="propKey"
    :def="def"
  />
  <ComboPropertyControl
    v-else-if="def.type === 'combo'"
    :prop-key="propKey"
    :def="def"
  />
  <TextPropertyControl v-else :prop-key="propKey" :def="def" />
</template>
