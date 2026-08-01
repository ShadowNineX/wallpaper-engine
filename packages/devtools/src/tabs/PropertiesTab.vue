<script setup lang="ts">
import { computed } from "vue";
import CaretRight from "~icons/ph/caret-right";
import RefreshCw from "~icons/ph/arrows-clockwise";
import type {
  WallpaperGroupProperty,
  WallpaperPropertyDefinition,
} from "../../../wallpaper-engine/src/types/project";
import { propDefs, tr } from "../config";
import { useDevtoolsStore } from "../store";
import PropertyRow from "../components/PropertyRow.vue";
import { Button } from "@/components/ui/button";

type RuntimePropertyDefinition = Exclude<
  WallpaperPropertyDefinition,
  WallpaperGroupProperty
>;
type PropertyEntry = [string, RuntimePropertyDefinition];

interface PropertyGroup {
  key: string;
  label: string;
  entries: PropertyEntry[];
}

const store = useDevtoolsStore();
const layout = computed(() => {
  const sorted = Object.entries(propDefs).sort(
    ([, left], [, right]) => (left.order ?? 0) - (right.order ?? 0),
  );
  const ungrouped: PropertyEntry[] = [];
  const groups: PropertyGroup[] = [];
  let currentGroup: PropertyGroup | undefined;

  for (const [key, definition] of sorted) {
    if (definition.type === "group") {
      currentGroup = { key, label: tr(definition.text), entries: [] };
      groups.push(currentGroup);
    } else if (currentGroup) {
      currentGroup.entries.push([key, definition]);
    } else {
      ungrouped.push([key, definition]);
    }
  }

  return { groups, ungrouped };
});
</script>

<template>
  <div class="space-y-2.5">
    <div class="flex items-center justify-between gap-3 px-0.5">
      <div>
        <h2 class="text-[11px] font-semibold text-we-text">User properties</h2>
        <p class="mt-0.5 text-[11px] text-we-faint">
          Changes send only the edited property, just like Wallpaper Engine.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        class="h-8 shrink-0 gap-1.5 px-2.5 text-[11px]"
        title="Replay all initial property and runtime values"
        @click="store.deliverAllProperties()"
      >
        <RefreshCw class="size-3" />
        Replay all
      </Button>
    </div>

    <div
      v-if="layout.ungrouped.length === 0 && layout.groups.length === 0"
      class="rounded-lg border border-dashed border-we-border p-5 text-center text-[11px] text-we-faint"
    >
      No user properties are configured for this wallpaper.
    </div>

    <div
      v-if="layout.ungrouped.length > 0"
      class="space-y-2.5"
      data-ungrouped-properties
    >
      <PropertyRow
        v-for="[key, definition] in layout.ungrouped"
        :key="key"
        :prop-key="key"
        :def="definition"
      />
    </div>

    <details
      v-for="group in layout.groups"
      :key="group.key"
      :data-property-group="group.key"
      class="group overflow-hidden rounded-lg border border-we-border/80 bg-we-panel/45"
    >
      <summary
        class="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[11px] font-semibold text-we-text transition-colors hover:bg-we-button-hover/40 [&::-webkit-details-marker]:hidden"
      >
        <CaretRight
          class="size-3 shrink-0 text-we-faint transition-transform group-open:rotate-90"
        />
        <span>{{ group.label }}</span>
      </summary>
      <div class="space-y-2.5 border-t border-we-border/70 p-2.5">
        <PropertyRow
          v-for="[key, definition] in group.entries"
          :key="key"
          :prop-key="key"
          :def="definition"
        />
        <p
          v-if="group.entries.length === 0"
          class="px-1 py-2 text-[11px] text-we-faint"
        >
          No properties in this group.
        </p>
      </div>
    </details>
  </div>
</template>
