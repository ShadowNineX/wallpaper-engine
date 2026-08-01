<script setup lang="ts">
import { computed } from "vue";
import type {
  WallpaperDirectoryProperty,
  WallpaperFileProperty,
  WallpaperGroupProperty,
  WallpaperPropertyDefinition,
} from "../../../wallpaper-engine/src/types/project";
import { tr } from "../config";
import PropertyPathControl from "./PropertyPathControl.vue";
import PropertyValueControl from "./PropertyValueControl.vue";
import { Label } from "@/components/ui/label";

type RuntimePropertyDefinition = Exclude<
  WallpaperPropertyDefinition,
  WallpaperGroupProperty
>;
type PathPropertyDefinition =
  | WallpaperDirectoryProperty
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
  props.def.type === "file" || props.def.type === "directory"
    ? props.def
    : undefined,
);
const valueDefinition = computed<ValuePropertyDefinition | undefined>(() =>
  props.def.type !== "file" && props.def.type !== "directory"
    ? props.def
    : undefined,
);
</script>

<template>
  <article
    class="rounded-lg border border-we-border/70 bg-[linear-gradient(135deg,rgba(32,35,43,0.94),rgba(24,26,32,0.94))] px-3 py-2.5 shadow-[inset_2px_0_0_rgba(91,134,237,0.18)] transition-colors hover:border-we-primary/35"
    :class="{ 'select-none': def.type === 'bool' }"
  >
    <div class="mb-2 flex items-start justify-between gap-3">
      <Label
        :for="propKey"
        class="min-w-0 truncate text-[11px] font-medium text-we-text"
      >
        {{ label }}
      </Label>
      <span
        class="shrink-0 font-mono text-[11px] text-we-faint"
        :title="propKey"
      >
        {{ propKey }} · {{ def.type }}
      </span>
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
