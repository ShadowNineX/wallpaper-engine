<script setup lang="ts">
import type {
  WallpaperDirectoryProperty,
  WallpaperFileProperty,
  WallpaperGroupProperty,
  WallpaperPropertyDefinition,
} from '../../../wallpaper-engine/src/types/project';
import { computed } from 'vue';
import { Label } from '@/components/ui/label';
import { tr } from '../config';
import PropertyPathControl from './PropertyPathControl.vue';
import PropertyValueControl from './PropertyValueControl.vue';

type RuntimePropertyDefinition = Exclude<
  WallpaperPropertyDefinition,
  WallpaperGroupProperty
>;
type PathPropertyDefinition
  = | WallpaperDirectoryProperty
    | WallpaperFileProperty;
type ValuePropertyDefinition = Exclude<
  RuntimePropertyDefinition,
  PathPropertyDefinition
>;

const props = defineProps<{
  propKey: string;
  def: RuntimePropertyDefinition;
}>();

const label = computed(() => tr(props.def.text || props.propKey));
const pathDefinition = computed<PathPropertyDefinition | undefined>(() =>
  props.def.type === 'file' || props.def.type === 'directory'
    ? props.def
    : undefined,
);
const valueDefinition = computed<ValuePropertyDefinition | undefined>(() =>
  props.def.type !== 'file' && props.def.type !== 'directory'
    ? props.def
    : undefined,
);
</script>

<template>
  <article
    class="border-b border-we-border/70 py-3.5 last:border-b-0"
    :class="{ 'select-none': def.type === 'bool' }"
    :title="`${propKey} · ${def.type}`"
  >
    <div class="mb-2.5 flex min-w-0 items-center">
      <Label
        :for="propKey"
        class="min-w-0 break-words text-[12px] font-medium text-we-text"
      >
        {{ label }}
      </Label>
    </div>

    <PropertyPathControl
      v-if="pathDefinition"
      :prop-key="propKey"
      :def="pathDefinition"
      :label="label"
    />
    <PropertyValueControl
      v-else-if="valueDefinition"
      :prop-key="propKey"
      :def="valueDefinition"
    />
  </article>
</template>
