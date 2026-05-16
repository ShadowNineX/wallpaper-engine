<script setup lang="ts">
import { computed } from "vue";
import { propDefs } from "../config";
import { useDevtoolsStore } from "../store";

const store = useDevtoolsStore();
const { deliverAllProperties } = store;
import PropertyRow from "../components/PropertyRow.vue";
import { Button } from "@/components/ui/button";

const entries = computed(() =>
  Object.entries(propDefs).sort(
    ([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0),
  ),
);
</script>

<template>
  <div>
    <p v-if="entries.length === 0" class="text-[11px] italic text-we-faint">
      No properties configured.
    </p>
    <PropertyRow
      v-for="[key, def] in entries"
      :key="key"
      :prop-key="key"
      :def="def"
    />
    <div class="mt-2">
      <Button size="sm" class="w-full" @click="deliverAllProperties"
        >Re-deliver all</Button
      >
    </div>
  </div>
</template>
