<script setup lang="ts">
import { ref, shallowRef } from "vue";
import { useDraggable } from "@vueuse/core";
import { audioState } from "./audio";
import "vue-sonner/style.css";
import { cfg } from "./config";
import { useDevtoolsStore } from "./store";
import { storeToRefs } from "pinia";

import PropertiesTab from "./tabs/PropertiesTab.vue";
import GeneralTab from "./tabs/GeneralTab.vue";
import AudioTab from "./tabs/AudioTab.vue";
import MediaTab from "./tabs/MediaTab.vue";
import DirectoriesTab from "./tabs/DirectoriesTab.vue";
import { Toaster } from "@/components/ui/sonner";
import StatusBar from "./components/StatusBar.vue";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const { mediaActive } = storeToRefs(useDevtoolsStore());

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
const {
  style: dragStyle,
  x: panelX,
  y: panelY,
} = useDraggable(panel, {
  handle: header,
  initialValue: () => ({ x: window.innerWidth - 16 - 380, y: 16 }),
  containerElement: document.documentElement,
});

let lastExpandedWidth = 0;
let lastExpandedHeight = 0;

function toggleCollapsed(): void {
  const expanding = collapsed.value;
  if (!expanding) {
    // Store dimensions now, before the collapse animation removes them
    lastExpandedWidth = panel.value?.offsetWidth ?? lastExpandedWidth;
    lastExpandedHeight = panel.value?.offsetHeight ?? lastExpandedHeight;
  }
  collapsed.value = !collapsed.value;
  if (expanding) {
    if (lastExpandedWidth > 0) {
      panelX.value = Math.max(
        0,
        Math.min(panelX.value, window.innerWidth - lastExpandedWidth),
      );
    }
    if (lastExpandedHeight > 0) {
      panelY.value = Math.max(
        0,
        Math.min(panelY.value, window.innerHeight - lastExpandedHeight),
      );
    }
  }
}

function tabDot(id: TabId): string | null {
  if (id === "audio" && audioState.mode !== "off") return "bg-amber-400";
  if (id === "media" && mediaActive.value === true) return "bg-emerald-400";
  return null;
}
</script>

<template>
  <div
    ref="panel"
    :style="dragStyle"
    class="fixed z-2147483647 flex flex-col overflow-hidden rounded-lg border border-we-border bg-we-panel text-we-text shadow-[0_8px_24px_rgba(0,0,0,0.4)] text-xs transition-[width] duration-200 ease-in-out"
    :class="collapsed ? 'w-64' : 'w-95'"
  >
    <div
      ref="header"
      class="flex cursor-move items-center gap-2 bg-we-surface px-2.5 py-2 select-none"
      :class="collapsed ? '' : 'border-b border-we-border'"
    >
      <span class="text-xs font-semibold whitespace-nowrap"
        >Wallpaper Engine Dev</span
      >
      <span
        v-if="cfg.title"
        class="text-xs text-we-muted whitespace-nowrap truncate"
        >{{ cfg.title }}</span
      >
      <div class="flex-1" />
      <button
        class="flex h-5.5 w-5.5 items-center justify-center rounded border border-we-border bg-transparent text-we-text cursor-pointer hover:bg-we-btn leading-none"
        @click="toggleCollapsed"
      >
        {{ collapsed ? "▢" : "—" }}
      </button>
    </div>
    <!-- Collapsible body: grid-row trick animates height without knowing it -->
    <div
      class="grid transition-[grid-template-rows] duration-200 ease-in-out"
      :class="collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
    >
      <div class="overflow-hidden">
        <StatusBar />
        <Tabs
          :model-value="active"
          @update:model-value="(v) => (active = v as TabId)"
        >
          <div
            class="border-b border-we-border bg-we-surface px-1.5 pt-1.5 pb-0"
          >
            <TabsList
              class="h-auto w-full flex-wrap justify-start gap-0.5 rounded-none bg-transparent p-0"
            >
              <TabsTrigger
                v-for="t in tabs"
                :key="t.id"
                :value="t.id"
                class="h-auto flex-none rounded-t rounded-b-none border border-b-0 px-2.5 py-1 text-[11px] transition-colors shadow-none bg-transparent data-[state=active]:bg-we-panel data-[state=active]:text-we-text data-[state=active]:border-we-border data-[state=active]:shadow-none data-[state=inactive]:border-transparent data-[state=inactive]:text-we-muted hover:text-we-text"
              >
                <span class="flex items-center gap-1">
                  <span
                    v-if="tabDot(t.id)"
                    class="size-1.5 shrink-0 rounded-full"
                    :class="tabDot(t.id)"
                  />
                  {{ t.label }}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>
          <div class="overflow-auto p-2.5 max-h-[70vh]">
            <component :is="tabComponents[active]" />
          </div>
        </Tabs>
      </div>
    </div>
    <Toaster />
  </div>
</template>
