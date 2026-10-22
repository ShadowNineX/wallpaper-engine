<script setup lang="ts">
import type {
  WallpaperDirectoryProperty,
  WallpaperDividerProperty,
  WallpaperFileProperty,
  WallpaperGroupProperty,
  WallpaperPropertyDefinition,
} from '../../../wallpaper-engine/src/types/project';
import { computed } from 'vue';
import { tr } from '../config';
import PropertyPathControl from './PropertyPathControl.vue';
import PropertyValueControl from './PropertyValueControl.vue';

type RuntimePropertyDefinition = Exclude<
  WallpaperPropertyDefinition,
  WallpaperGroupProperty | WallpaperDividerProperty
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
  def: RuntimePropertyDefinition | WallpaperDividerProperty;
}>();

const label = computed(() => tr(props.def.text || props.propKey));
const pathDefinition = computed<PathPropertyDefinition | undefined>(() =>
  props.def.type === 'file' || props.def.type === 'directory'
    ? props.def
    : undefined,
);
const valueDefinition = computed<ValuePropertyDefinition | undefined>(() =>
  props.def.type !== 'file' && props.def.type !== 'directory' && props.def.type !== 'divider'
    ? props.def
    : undefined,
);
</script>

<template>
  <div v-if="def.type === 'divider'" class="py-3" :data-property-divider="propKey">
    <p v-if="def.text" class="mb-2.5 text-[12px] font-medium text-we-text">
      {{ tr(def.text) }}
    </p>
    <hr class="border-0 border-t border-we-border" :aria-label="def.text ? tr(def.text) : undefined">
  </div>
  <article
    v-else
    class="border-b border-we-border/70 py-3.5 last:border-b-0"
    :class="{ 'select-none': def.type === 'bool' }"
    :title="`${propKey} · ${def.type}`"
  >
    <div class="mb-2.5 flex min-w-0 items-center">
      <label
        :for="propKey"
        class="min-w-0 break-words text-[12px] font-medium text-we-text"
      >
        {{ label }}
      </label>
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
