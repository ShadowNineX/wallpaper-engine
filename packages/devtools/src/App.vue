<script setup lang="ts">
import { ref, shallowRef } from "vue";
import { useDraggable } from "@vueuse/core";
import PropertiesTab from "./tabs/PropertiesTab.vue";
import GeneralTab from "./tabs/GeneralTab.vue";
import AudioTab from "./tabs/AudioTab.vue";
import MediaTab from "./tabs/MediaTab.vue";
import DirectoriesTab from "./tabs/DirectoriesTab.vue";
import Toast from "./components/Toast.vue";
import StatusBar from "./components/StatusBar.vue";

type TabId = "properties" | "general" | "audio" | "media" | "directories";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "properties", label: "Properties" },
  { id: "general", label: "General" },
  { id: "audio", label: "Audio" },
  { id: "media", label: "Media" },
  { id: "directories", label: "Directories" },
];
const tabComponents = {
  properties: PropertiesTab,
  general: GeneralTab,
  audio: AudioTab,
  media: MediaTab,
  directories: DirectoriesTab,
} as const;

const active = ref<TabId>("properties");
const collapsed = ref(false);

const panel = shallowRef<HTMLElement | null>(null);
const header = shallowRef<HTMLElement | null>(null);
const { style: dragStyle } = useDraggable(panel, { handle: header });
</script>

<template>
  <div
    ref="panel"
    :style="dragStyle"
    class="fixed top-4 right-4 z-2147483647 flex flex-col overflow-hidden rounded-lg border border-we-border bg-we-panel text-we-text shadow-[0_8px_24px_rgba(0,0,0,0.4)] text-xs max-h-[calc(100vh-32px)]"
    :class="collapsed ? 'w-auto' : 'w-95'"
  >
    <div
      ref="header"
      class="flex cursor-move items-center gap-2 border-b border-we-border bg-we-surface px-2.5 py-2 select-none"
    >
      <span class="text-xs font-semibold">Wallpaper Engine Dev</span>
      <div class="flex-1" />
      <button
        class="flex h-5.5 w-5.5 items-center justify-center rounded border border-we-border bg-transparent text-we-text cursor-pointer hover:bg-we-btn leading-none"
        @click="collapsed = !collapsed"
      >
        {{ collapsed ? "▢" : "—" }}
      </button>
    </div>
    <template v-if="!collapsed">
      <StatusBar />
      <div
        class="flex flex-wrap gap-0.5 border-b border-we-border bg-we-surface px-1.5 pt-1.5"
      >
        <button
          v-for="t in tabs"
          :key="t.id"
          class="cursor-pointer rounded-t border border-b-0 px-2.5 py-1 text-[11px] transition-colors"
          :class="
            active === t.id
              ? 'border-we-border bg-we-panel text-we-text'
              : 'border-transparent text-we-muted hover:text-we-text'
          "
          @click="active = t.id"
        >
          {{ t.label }}
        </button>
      </div>
      <div class="overflow-auto p-2.5 max-h-[70vh]">
        <component :is="tabComponents[active]" />
      </div>
    </template>
    <Toast />
  </div>
</template>
