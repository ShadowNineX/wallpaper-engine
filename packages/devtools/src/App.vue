<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from "vue";
import { storeToRefs } from "pinia";
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
import "vue-sonner/style.css";
import type { ToasterProps } from "vue-sonner";
import { cfg } from "./config";
import { AUDIO_MODE_LABELS, audioState } from "./audio";
import { useDevtoolsStore } from "./store";

import PropertiesTab from "./tabs/PropertiesTab.vue";
import GeneralTab from "./tabs/GeneralTab.vue";
import AudioTab from "./tabs/AudioTab.vue";
import MediaTab from "./tabs/MediaTab.vue";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

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

type TabStatusTone = "positive" | "neutral" | "warning";
interface TabStatus {
  label: string;
  tone: TabStatusTone;
}

const statusToneClasses = {
  positive: {
    dot: "bg-emerald-400",
    text: "text-emerald-300/90",
  },
  neutral: {
    dot: "bg-we-border-strong",
    text: "text-we-faint",
  },
  warning: {
    dot: "bg-amber-400",
    text: "text-amber-300/90",
  },
} as const satisfies Record<TabStatusTone, { dot: string; text: string }>;

const store = useDevtoolsStore();
const { listenerCounts, mediaActive } = storeToRefs(store);
const tabStatuses = computed<Record<TabId, TabStatus>>(() => ({
  properties: listenerCounts.value.property
    ? { label: "Ready", tone: "positive" }
    : { label: "No listener", tone: "warning" },
  general: store.general.paused
    ? { label: "Paused", tone: "warning" }
    : { label: "Running", tone: "positive" },
  audio: {
    label: AUDIO_MODE_LABELS[audioState.mode],
    tone: audioState.mode === "off" ? "neutral" : "positive",
  },
  media: mediaActive.value
    ? { label: "Enabled", tone: "positive" }
    : { label: "Disabled", tone: "neutral" },
}));

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
const EXPANDED_PANEL_WIDTH = 440;
const COLLAPSED_PANEL_WIDTH = 320;
const VIEWPORT_MARGIN = 12;
const panelWidth = Math.min(
  EXPANDED_PANEL_WIDTH,
  Math.max(COLLAPSED_PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2),
);
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

let panelSizeAnimation: Animation | undefined;
let pendingPanelHeight: number | undefined;
let panelWidthTarget = panelWidth;
let panelWidthTransitioning = false;

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

function clampPanelAxis(
  position: number,
  size: number,
  viewportSize: number,
): number {
  const maximum = Math.max(
    VIEWPORT_MARGIN,
    viewportSize - VIEWPORT_MARGIN - size,
  );
  return Math.min(maximum, Math.max(VIEWPORT_MARGIN, position));
}

function constrainPanelToViewport(): void {
  const element = panel.value;
  if (!element) return;

  const width = element.offsetWidth;
  const reachedWidthTarget = Math.abs(width - panelWidthTarget) < 1;
  if (!panelWidthTransitioning || reachedWidthTarget) {
    panelWidthTransitioning = false;
    panelX.value = clampPanelAxis(panelX.value, width, window.innerWidth);
  }
  panelY.value = clampPanelAxis(
    panelY.value,
    element.offsetHeight,
    window.innerHeight,
  );
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

function toggleCollapsed(): void {
  cancelPanelSizeAnimation();
  const viewportWidth = window.innerWidth;
  const maxPanelWidth = Math.max(0, viewportWidth - VIEWPORT_MARGIN * 2);
  const currentWidth =
    panel.value?.offsetWidth ||
    Math.min(
      collapsed.value ? COLLAPSED_PANEL_WIDTH : EXPANDED_PANEL_WIDTH,
      maxPanelWidth,
    );
  const renderedRightEdge = panel.value?.getBoundingClientRect().right;
  const rightEdge =
    renderedRightEdge !== undefined && renderedRightEdge > 0
      ? renderedRightEdge
      : panelX.value + currentWidth;

  panelWidthTarget = Math.min(
    collapsed.value ? EXPANDED_PANEL_WIDTH : COLLAPSED_PANEL_WIDTH,
    maxPanelWidth,
  );
  panelWidthTransitioning = Math.abs(currentWidth - panelWidthTarget) >= 1;
  panelX.value = clampPanelAxis(
    rightEdge - panelWidthTarget,
    panelWidthTarget,
    viewportWidth,
  );
  collapsed.value = !collapsed.value;
  void nextTick(constrainPanelToViewport);
}
</script>

<template>
  <div
    ref="panel"
    :style="dragStyle"
    class="fixed z-2147483647 flex max-h-[calc(100dvh-24px)] max-w-[calc(100dvw-24px)] flex-col overflow-hidden rounded-xl border border-[#4b5570] bg-we-panel text-xs text-we-text shadow-[0_24px_80px_rgba(3,7,18,0.72),0_0_42px_rgba(91,134,237,0.1)]"
    :class="[
      collapsed ? 'w-[320px]' : 'w-110',
      isDragging || isViewportResizing
        ? 'transition-none'
        : 'transition-[width,left,top] duration-250 ease-in-out',
    ]"
  >
    <header
      ref="header"
      class="flex shrink-0 cursor-move items-center gap-3 border-[#49516a] bg-[linear-gradient(120deg,#121b31_0%,#241638_58%,#151726_100%)] px-3 py-2.5 select-none"
      :class="{ 'border-b': !collapsed }"
    >
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(91,134,237,0.3),rgba(139,92,246,0.24))] text-[#92b2ff] ring-1 ring-white/10 shadow-[0_0_20px_rgba(91,134,237,0.16)]"
      >
        <SlidersHorizontal class="size-4.5" />
      </div>
      <div class="min-w-0 flex-1">
        <div
          class="text-[13px] font-semibold leading-4 tracking-[-0.01em] text-we-text"
          :class="collapsed ? 'whitespace-normal' : 'truncate'"
        >
          Wallpaper Engine Devtools
        </div>
        <div
          v-if="cfg.title"
          class="text-[11px] leading-4 text-we-faint"
          :class="collapsed ? 'whitespace-normal' : 'truncate'"
        >
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
              :aria-label="`${tab.label}: ${tabStatuses[tab.id].label}`"
              :title="`${tab.label}: ${tabStatuses[tab.id].label}`"
              class="group relative flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border border-transparent bg-transparent px-1 text-[11px] font-medium text-we-faint shadow-none transition-all hover:bg-we-btn/70 hover:text-we-text data-[state=active]:border-we-primary/40 data-[state=active]:bg-[linear-gradient(145deg,rgba(91,134,237,0.18),rgba(139,92,246,0.1))] data-[state=active]:text-white data-[state=active]:shadow-[inset_0_-2px_0_rgba(91,134,237,0.75)]"
            >
              <component :is="tab.icon" class="mb-0.5 size-4" />
              <span class="max-w-full truncate leading-4">{{ tab.label }}</span>
              <span
                data-tab-status
                class="flex max-w-full items-center gap-1 text-[9px] leading-3 font-normal"
                :class="statusToneClasses[tabStatuses[tab.id].tone].text"
              >
                <span
                  class="size-1.5 shrink-0 rounded-full"
                  :class="statusToneClasses[tabStatuses[tab.id].tone].dot"
                />
                <span class="truncate">{{ tabStatuses[tab.id].label }}</span>
              </span>
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
