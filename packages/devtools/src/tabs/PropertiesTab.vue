<script setup lang="ts">
import type {
  WallpaperGroupProperty,
  WallpaperPropertyDefinition,
} from '../../../wallpaper-engine/src/types/project';
import { storeToRefs } from 'pinia';
import { computed, reactive } from 'vue';
import ArrowCounterClockwise from '~icons/ph/arrow-counter-clockwise';
import RefreshCw from '~icons/ph/arrows-clockwise';
import CaretRight from '~icons/ph/caret-right';
import { Button } from '@/components/ui/button';
import CallbackStatus from '../components/CallbackStatus.vue';
import PropertyRow from '../components/PropertyRow.vue';
import { propDefs, tr } from '../config';
import { useDevtoolsStore } from '../store';

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
const { listenerCounts } = storeToRefs(store);
const openGroups = reactive(new Set<string>());

function toggleGroup(key: string): void {
  if (openGroups.has(key)) {
    openGroups.delete(key);
  }
  else {
    openGroups.add(key);
  }
}
const layout = computed(() => {
  const sorted = Object.entries(propDefs).sort(
    ([, left], [, right]) => (left.order ?? 0) - (right.order ?? 0),
  );
  const ungrouped: PropertyEntry[] = [];
  const groups: PropertyGroup[] = [];
  let currentGroup: PropertyGroup | undefined;

  for (const [key, definition] of sorted) {
    if (definition.type === 'group') {
      currentGroup = { key, label: tr(definition.text), entries: [] };
      groups.push(currentGroup);
    }
    else if (currentGroup) {
      currentGroup.entries.push([key, definition]);
    }
    else {
      ungrouped.push([key, definition]);
    }
  }

  return { groups, ungrouped };
});
</script>

<template>
  <div>
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <h2 class="text-[15px] font-semibold tracking-[-0.01em] text-we-text">
          User properties
        </h2>
        <CallbackStatus
          class="mt-1"
          :ready="listenerCounts.property"
          ready-label="Property listener registered"
          missing-label="No property listener; changes cannot be delivered"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          class="h-9 gap-1.5 px-3 text-[12px]"
          title="Restore every user property to its configured default"
          @click="store.resetPropertiesToDefaults()"
        >
          <ArrowCounterClockwise class="size-3" />
          Reset defaults
        </Button>
        <Button
          size="sm"
          variant="outline"
          class="h-9 gap-1.5 px-3 text-[12px]"
          title="Replay all initial property and runtime values"
          @click="store.deliverAllProperties()"
        >
          <RefreshCw class="size-3" />
          Replay all
        </Button>
      </div>
    </div>

    <div
      v-if="layout.ungrouped.length === 0 && layout.groups.length === 0"
      class="rounded-lg border border-dashed border-we-border p-6 text-center text-[12px] text-we-faint"
    >
      No user properties are configured for this wallpaper.
    </div>

    <div
      v-if="layout.ungrouped.length > 0"
      class="border-t border-we-border"
      data-ungrouped-properties
    >
      <PropertyRow
        v-for="[key, definition] in layout.ungrouped"
        :key="key"
        :prop-key="key"
        :def="definition"
      />
    </div>

    <section
      v-for="(group, groupIndex) in layout.groups"
      :key="group.key"
      :data-property-group="group.key"
      class="border-t border-we-border"
    >
      <button
        type="button"
        :aria-controls="`we-property-group-${groupIndex}`"
        :aria-expanded="openGroups.has(group.key)"
        data-property-group-toggle
        class="flex w-full cursor-pointer select-none items-center gap-2 border-0 bg-transparent py-3 text-left text-[12px] font-semibold text-we-text transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-we-primary"
        @click="toggleGroup(group.key)"
      >
        <CaretRight
          class="size-3 shrink-0 text-we-faint transition-transform duration-260 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          :class="{ 'rotate-90': openGroups.has(group.key) }"
        />
        <span>{{ group.label }}</span>
      </button>
      <div
        :id="`we-property-group-${groupIndex}`"
        :data-property-group-content="group.key"
        :aria-hidden="!openGroups.has(group.key)"
        :inert="!openGroups.has(group.key)"
        class="grid transition-[grid-template-rows,opacity] duration-260 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        :class="
          openGroups.has(group.key)
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        "
      >
        <div class="min-h-0 overflow-hidden">
          <div class="border-t border-we-border/70 pl-5">
            <PropertyRow
              v-for="[key, definition] in group.entries"
              :key="key"
              :prop-key="key"
              :def="definition"
            />
            <p
              v-if="group.entries.length === 0"
              class="py-3 text-[12px] text-we-faint"
            >
              No properties in this group.
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
