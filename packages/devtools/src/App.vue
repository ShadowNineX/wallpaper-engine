<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from "vue";
import {
  useDebounceFn,
  useDraggable,
  useEventListener,
  useResizeObserver,
  useWindowSize,
} from "@vueuse/core";
import AudioLines from "~icons/ph/waveform-duotone";
import Maximize2 from "~icons/ph/arrows-out-simple";
import Minus from "~icons/ph/minus";
import Music2 from "~icons/ph/music-notes-duotone";
import Settings2 from "~icons/ph/gear-six-duotone";
import SlidersHorizontal from "~icons/ph/sliders-horizontal-duotone";
import { audioState } from "./audio";
import "vue-sonner/style.css";
import type { ToasterProps } from "vue-sonner";
import { cfg } from "./config";
import { useDevtoolsStore } from "./store";
import { storeToRefs } from "pinia";

import PropertiesTab from "./tabs/PropertiesTab.vue";
import GeneralTab from "./tabs/GeneralTab.vue";
import AudioTab from "./tabs/AudioTab.vue";
import MediaTab from "./tabs/MediaTab.vue";
import { Toaster } from "@/components/ui/sonner";
import StatusBar from "./components/StatusBar.vue";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

const store = useDevtoolsStore();
const { mediaActive } = storeToRefs(store);

type TabId = "properties" | "general" | "audio" | "media";

const tabs = [
  { id: "properties", label: "Properties", icon: SlidersHorizontal },
  { id: "general", label: "Runtime", icon: Settings2 },
  { id: "audio", label: "Audio", icon: AudioLines },
  { id: "media", label: "Media", icon: Music2 },
] as const;

const tabComponents = {
  properties: PropertiesTab,
  general: GeneralTab,
  audio: AudioTab,
  media: MediaTab,
} as const;

const toastOptions = {
  unstyled: true,
  classes: {
    toast: "we-toast",
    content: "we-toast-content",
    title: "we-toast-title",
    description: "we-toast-description",
    icon: "we-toast-icon",
    closeButton: "we-toast-close",
    actionButton: "we-toast-action",
    cancelButton: "we-toast-cancel",
    default: "we-toast-default",
    success: "we-toast-success",
    error: "we-toast-error",
    info: "we-toast-info",
    warning: "we-toast-warning",
    loading: "we-toast-loading",
  },
} satisfies NonNullable<ToasterProps["toastOptions"]>;

const active = ref<TabId>("properties");
const collapsed = ref(false);
const panel = shallowRef<HTMLElement | null>(null);
const header = shallowRef<HTMLElement | null>(null);
const panelWidth = Math.min(440, Math.max(280, window.innerWidth - 24));
const {
  style: dragStyle,
  x: panelX,
  y: panelY,
  isDragging,
} = useDraggable(panel, {
  handle: header,
  initialValue: () => ({
    x: Math.max(12, window.innerWidth - 12 - panelWidth),
    y: 12,
  }),
  containerElement: document.documentElement,
});

const { width: viewportWidth } = useWindowSize();
const isViewportResizing = ref(false);
const toastPosition = computed<NonNullable<ToasterProps["position"]>>(() => {
  const width = panel.value?.offsetWidth ?? panelWidth;
  return panelX.value + width / 2 > viewportWidth.value / 2
    ? "bottom-left"
    : "bottom-right";
});

const VIEWPORT_MARGIN = 12;
let panelSizeAnimation: Animation | undefined;
let pendingPanelHeight: number | undefined;

function cancelPanelSizeAnimation(): void {
  const animation = panelSizeAnimation;
  panelSizeAnimation = undefined;
  animation?.cancel();
}

function animatePanelHeight(fromHeight: number): void {
  const element = panel.value;
  if (
    !element ||
    collapsed.value ||
    typeof element.animate !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    constrainPanelToViewport();
    return;
  }

  const toHeight = element.getBoundingClientRect().height;
  if (Math.abs(fromHeight - toHeight) < 1) {
    constrainPanelToViewport();
    return;
  }

  const animation = element.animate(
    [{ height: `${fromHeight}px` }, { height: `${toHeight}px` }],
    {
      duration: 260,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  );
  panelSizeAnimation = animation;
  animation.addEventListener(
    "finish",
    () => {
      if (panelSizeAnimation !== animation) return;
      panelSizeAnimation = undefined;
      constrainPanelToViewport();
    },
    { once: true },
  );
}

function changeTab(value: unknown): void {
  if (
    typeof value !== "string" ||
    !Object.hasOwn(tabComponents, value) ||
    value === active.value
  ) {
    return;
  }

  cancelPanelSizeAnimation();
  pendingPanelHeight = panel.value?.getBoundingClientRect().height;
  active.value = value as TabId;
}

function onTabEnter(): void {
  const fromHeight = pendingPanelHeight;
  pendingPanelHeight = undefined;
  if (fromHeight !== undefined) animatePanelHeight(fromHeight);
}


function constrainPanelToViewport(): void {
  const element = panel.value;
  if (!element) return;

  const maxX = Math.max(
    VIEWPORT_MARGIN,
    window.innerWidth - VIEWPORT_MARGIN - element.offsetWidth,
  );
  const maxY = Math.max(
    VIEWPORT_MARGIN,
    window.innerHeight - VIEWPORT_MARGIN - element.offsetHeight,
  );

  panelX.value = Math.min(maxX, Math.max(VIEWPORT_MARGIN, panelX.value));
  panelY.value = Math.min(maxY, Math.max(VIEWPORT_MARGIN, panelY.value));
}

const finishViewportResize = useDebounceFn(() => {
  isViewportResizing.value = false;
}, 120);

useEventListener(window, "resize", () => {
  cancelPanelSizeAnimation();
  isViewportResizing.value = true;
  void nextTick(constrainPanelToViewport);
  void finishViewportResize();
});
useResizeObserver(panel, constrainPanelToViewport);

let lastExpandedWidth = panelWidth;


function toggleCollapsed(): void {
  cancelPanelSizeAnimation();
  const viewportWidth = window.innerWidth;
  const maxPanelWidth = Math.max(0, viewportWidth - 24);
  const currentWidth = panel.value?.offsetWidth ?? panelWidth;
  const rightEdge = panelX.value + currentWidth;

  if (!collapsed.value) {
    lastExpandedWidth = currentWidth;
    void nextTick(constrainPanelToViewport);
    const collapsedWidth = Math.min(280, maxPanelWidth);
    panelX.value = Math.max(
      0,
      Math.min(rightEdge - collapsedWidth, viewportWidth - collapsedWidth),
    );
    collapsed.value = true;
    return;
  }

  const expandedWidth = Math.min(lastExpandedWidth, maxPanelWidth);
  panelX.value = Math.max(
    0,
    Math.min(rightEdge - expandedWidth, viewportWidth - expandedWidth),
  );
  void nextTick(constrainPanelToViewport);
  collapsed.value = false;
}

function tabActive(id: TabId): boolean {
  if (id === "audio") return audioState.mode !== "off";
  if (id === "media") return mediaActive.value;
  return false;
}
</script>

<template>
  <div
    ref="panel"
    :style="dragStyle"
    class="fixed z-2147483647 flex max-h-[calc(100dvh-24px)] max-w-[calc(100dvw-24px)] flex-col overflow-hidden rounded-xl border border-[#4b5570] bg-we-panel text-xs text-we-text shadow-[0_24px_80px_rgba(3,7,18,0.72),0_0_42px_rgba(91,134,237,0.1)]"
    :class="[
      collapsed ? 'w-[280px]' : 'w-[440px]',
      isDragging || isViewportResizing
        ? 'transition-none'
        : 'transition-[width,left,top] duration-250 ease-in-out',
    ]"
  >
    <header
      ref="header"
      class="flex shrink-0 cursor-move items-center gap-3 border-b border-[#49516a] bg-[linear-gradient(120deg,#121b31_0%,#241638_58%,#151726_100%)] px-3 py-2.5 select-none"
    >
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(91,134,237,0.3),rgba(139,92,246,0.24))] text-[#92b2ff] ring-1 ring-white/10 shadow-[0_0_20px_rgba(91,134,237,0.16)]"
      >
        <SlidersHorizontal class="size-4.5" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-[13px] font-semibold leading-4 tracking-[-0.01em] text-we-text">
          Wallpaper Engine Devtools
        </div>
        <div v-if="cfg.title" class="truncate text-[11px] leading-4 text-we-faint">
          {{ cfg.title }}
        </div>
      </div>
      <button
        type="button"
        class="we-icon-button shrink-0"
        :aria-label="collapsed ? 'Expand devtools' : 'Collapse devtools'"
        :title="collapsed ? 'Expand' : 'Collapse'"
        @click="toggleCollapsed"
      >
        <Maximize2 v-if="collapsed" class="size-3.5" />
        <Minus v-else class="size-3.5" />
      </button>
    </header>

    <div
      class="grid min-h-0 flex-1 transition-[grid-template-rows] duration-250 ease-in-out"
      :class="collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
    >
      <div class="flex h-full min-h-0 flex-col overflow-hidden">
        <StatusBar />
        <Tabs
          :model-value="active"
          class="flex min-h-0 flex-1 flex-col overflow-hidden"
          @update:model-value="changeTab"
        >
          <TabsList
            class="grid h-auto w-full shrink-0 grid-cols-4 gap-1 rounded-none border-b border-we-border bg-[#11141b]/95 px-2 py-2"
          >
            <TabsTrigger
              v-for="tab in tabs"
              :key="tab.id"
              :value="tab.id"
              class="group relative flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md border border-transparent bg-transparent px-1 text-[11px] font-medium text-we-faint shadow-none transition-all hover:bg-we-btn/70 hover:text-we-text data-[state=active]:border-we-primary/40 data-[state=active]:bg-[linear-gradient(145deg,rgba(91,134,237,0.18),rgba(139,92,246,0.1))] data-[state=active]:text-white data-[state=active]:shadow-[inset_0_-2px_0_rgba(91,134,237,0.75)]"
            >
              <component :is="tab.icon" class="size-4" />
              <span class="truncate">{{ tab.label }}</span>
              <span
                v-if="tabActive(tab.id)"
                class="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-emerald-400 ring-2 ring-we-surface"
              />
            </TabsTrigger>
          </TabsList>

          <ScrollArea type="hover" class="min-h-0 flex-1">
            <main class="p-3 pr-4">
              <Transition
                name="we-tab-content"
                mode="out-in"
                @enter="onTabEnter"
              >
                <component :is="tabComponents[active]" :key="active" />
              </Transition>
            </main>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
    <Toaster
      theme="dark"
      :position="toastPosition"
      close-button
      close-button-position="top-right"
      :duration="3600"
      :gap="8"
      :visible-toasts="4"
      :offset="12"
      :mobile-offset="12"
      :swipe-directions="['right']"
      :toast-options="toastOptions"
    />
  </div>
</template>
