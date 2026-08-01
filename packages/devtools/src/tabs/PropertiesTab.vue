<script setup lang="ts">
import { computed } from "vue";
import RefreshCw from "~icons/ph/arrows-clockwise";
import { propDefs } from "../config";
import { useDevtoolsStore } from "../store";
import PropertyRow from "../components/PropertyRow.vue";
import { Button } from "@/components/ui/button";

const store = useDevtoolsStore();
const entries = computed(() =>
  Object.entries(propDefs).sort(
    ([, left], [, right]) => (left.order ?? 0) - (right.order ?? 0),
  ),
);
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
      v-if="entries.length === 0"
      class="rounded-lg border border-dashed border-we-border p-5 text-center text-[11px] text-we-faint"
    >
      No user properties are configured for this wallpaper.
    </div>

    <PropertyRow
      v-for="[key, definition] in entries"
      :key="key"
      :prop-key="key"
      :def="definition"
    />
  </div>
</template>
