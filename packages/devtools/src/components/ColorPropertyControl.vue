<script setup lang="ts">
import { computed } from "vue";
import type { WallpaperColorValue } from "../../../wallpaper-engine/src/types/listeners";
import type { WallpaperColorProperty } from "../../../wallpaper-engine/src/types/project";
import { hexToWeColor, weColorToHex } from "../color";
import { useDevtoolsStore } from "../store";

const props = defineProps<{
  propKey: string;
  def: WallpaperColorProperty;
}>();

const store = useDevtoolsStore();
const runtimeValue = computed(
  () => store.currentValues[props.propKey] as WallpaperColorValue | undefined,
);

function onColor(event: Event): void {
  const current = runtimeValue.value;
  if (!current) return;
  current.value = hexToWeColor((event.target as HTMLInputElement).value);
  store.deliverProperty(props.propKey);
}
</script>

<template>
  <div class="flex items-center gap-2">
    <input
      :id="propKey"
      type="color"
      :value="weColorToHex(runtimeValue?.value ?? def.value)"
      class="h-8 w-12 shrink-0 cursor-pointer rounded-md border border-we-border bg-we-btn p-1"
      @input="onColor"
    />
    <code class="min-w-0 truncate text-[10px] text-we-muted">
      {{ runtimeValue?.value ?? def.value }}
    </code>
  </div>
</template>
