<script setup lang="ts">
import type { ToasterProps } from 'vue-sonner';
import {
  useDebounceFn,
  useDraggable,
  useEventListener,
  useResizeObserver,
  useWindowSize,
} from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import Maximize2 from '~icons/ph/arrows-out-simple';
import Settings2 from '~icons/ph/gear-six-duotone';
import Minus from '~icons/ph/minus';
import Music2 from '~icons/ph/music-notes-duotone';
import SlidersHorizontal from '~icons/ph/sliders-horizontal-duotone';
import AudioLines from '~icons/ph/waveform-duotone';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from '@/components/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AUDIO_MODE_LABELS, audioState } from './audio';

import { cfg } from './config';
import { useDevtoolsStore } from './store';
import AudioTab from './tabs/AudioTab.vue';
import GeneralTab from './tabs/GeneralTab.vue';
import MediaTab from './tabs/MediaTab.vue';
import PropertiesTab from './tabs/PropertiesTab.vue';
import 'vue-sonner/style.css';

type TabId = 'properties' | 'general' | 'audio' | 'media';

const devtoolsBuildLabel = `v${__WE_DEVTOOLS_VERSION__}`;
const devtoolsBuildTitle = `Devtools ${__WE_DEVTOOLS_VERSION__} (git ${__WE_DEVTOOLS_GIT_VERSION__})`;

const tabs = [
  { id: 'properties', label: 'Properties', icon: SlidersHorizontal },
  { id: 'general', label: 'Runtime', icon: Settings2 },
  { id: 'audio', label: 'Audio', icon: AudioLines },
  { id: 'media', label: 'Media', icon: Music2 },
] as const;

const tabComponents = {
  properties: PropertiesTab,
  general: GeneralTab,
  audio: AudioTab,
  media: MediaTab,
} as const;

interface TabStatus {
  label: string;
  tone: 'positive' | 'neutral' | 'warning';
}

const statusColors = {
  positive: 'text-emerald-300',
  neutral: 'text-we-faint',
  warning: 'text-amber-300',
};

const store = useDevtoolsStore();
const { listenerCounts, mediaActive } = storeToRefs(store);
const tabStatuses = computed<Record<TabId, TabStatus>>(() => ({
  properties: listenerCounts.value.property
    ? { label: 'Ready', tone: 'positive' }
    : { label: 'No listener', tone: 'warning' },
  general: store.general.paused
    ? { label: 'Paused', tone: 'warning' }
    : { label: 'Running', tone: 'positive' },
  audio: {
    label: AUDIO_MODE_LABELS[audioState.mode],
    tone: audioState.mode === 'off' ? 'neutral' : 'positive',
  },
  media: mediaActive.value
    ? { label: 'Enabled', tone: 'positive' }
    : { label: 'Disabled', tone: 'neutral' },
}));

const toastOptions = {
  unstyled: true,
  classes: {
    toast: 'we-toast',
    content: 'we-toast-content',
    title: 'we-toast-title',
    description: 'we-toast-description',
    icon: 'we-toast-icon',
    closeButton: 'we-toast-close',
    actionButton: 'we-toast-action',
    cancelButton: 'we-toast-cancel',
    default: 'we-toast-default',
    success: 'we-toast-success',
    error: 'we-toast-error',
    info: 'we-toast-info',
    warning: 'we-toast-warning',
    loading: 'we-toast-loading',
  },
} satisfies NonNullable<ToasterProps['toastOptions']>;

const active = ref<TabId>('properties');
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
const toastPosition = computed<NonNullable<ToasterProps['position']>>(() => {
  const width = panel.value?.offsetWidth ?? panelWidth;
  return panelX.value + width / 2 > viewportWidth.value / 2
    ? 'bottom-left'
    : 'bottom-right';
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

onBeforeUnmount(cancelPanelSizeAnimation);

function animatePanelHeight(fromHeight: number): void {
  const element = panel.value;
  if (
    !element
    || collapsed.value
    || typeof element.animate !== 'function'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    },
  );
  panelSizeAnimation = animation;
  animation.addEventListener(
    'finish',
    () => {
      if (panelSizeAnimation !== animation)
        return;
      panelSizeAnimation = undefined;
      constrainPanelToViewport();
    },
    { once: true },
  );
}

function changeTab(value: unknown): void {
  if (
    typeof value !== 'string'
    || !Object.hasOwn(tabComponents, value)
    || value === active.value
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
  if (fromHeight !== undefined)
    animatePanelHeight(fromHeight);
}

watch(() => audioState.mode, async (_mode, _previousMode, onCleanup) => {
  if (active.value !== 'audio' || collapsed.value)
    return;

  // Capture the visible height before Vue replaces the preset's controls.
  const fromHeight = panel.value?.getBoundingClientRect().height;
  cancelPanelSizeAnimation();
  let cancelled = false;
  onCleanup(() => {
    cancelled = true;
  });
  await nextTick();
  if (
    !cancelled
    && fromHeight !== undefined
    && active.value === 'audio'
    && !collapsed.value
    && !isViewportResizing.value
  ) {
    animatePanelHeight(fromHeight);
  }
});

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
  if (!element)
    return;

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

useEventListener(window, 'resize', () => {
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
  const currentWidth
    = panel.value?.offsetWidth
      || Math.min(
        collapsed.value ? COLLAPSED_PANEL_WIDTH : EXPANDED_PANEL_WIDTH,
        maxPanelWidth,
      );
  const renderedRightEdge = panel.value?.getBoundingClientRect().right;
  const rightEdge
    = renderedRightEdge !== undefined && renderedRightEdge > 0
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
    role="region"
    aria-label="Wallpaper Engine Devtools"
    class="we-devtools-panel fixed z-2147483647 flex max-h-[calc(100dvh-24px)] max-w-[calc(100dvw-24px)] flex-col overflow-hidden rounded-xl border border-we-border bg-we-panel text-[13px] text-we-text shadow-[0_18px_54px_rgba(3,7,18,0.64)] motion-reduce:transition-none"
    :class="[
      collapsed ? 'w-[320px]' : 'w-110',
      isDragging || isViewportResizing
        ? 'transition-none'
        : 'transition-[width,left,top] duration-250 ease-in-out',
    ]"
  >
    <header
      ref="header"
      class="flex shrink-0 cursor-move items-center gap-2.5 border-we-border bg-we-surface px-3.5 py-3 select-none"
      :class="{ 'border-b': !collapsed }"
    >
      <SlidersHorizontal class="size-4 shrink-0 text-we-primary" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <div
          class="text-[13px] font-semibold leading-5 tracking-[-0.01em] text-we-text"
          :class="collapsed ? 'whitespace-normal' : 'truncate'"
        >
          Wallpaper Engine Devtools
        </div>
        <div
          class="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-we-faint"
        >
          <span v-if="cfg.title" class="min-w-0 truncate">
            {{ cfg.title }}
          </span>
          <span v-if="cfg.title" aria-hidden="true" class="shrink-0">·</span>
          <span
            data-devtools-version
            class="shrink-0 font-mono text-[10px] tracking-tight"
            :aria-label="devtoolsBuildTitle"
            :title="devtoolsBuildTitle"
          >
            {{ devtoolsBuildLabel }}
          </span>
        </div>
      </div>
      <button
        type="button"
        class="we-icon-button shrink-0"
        :aria-label="collapsed ? 'Expand devtools' : 'Collapse devtools'"
        :aria-expanded="!collapsed"
        aria-controls="we-devtools-content"
        :title="collapsed ? 'Expand' : 'Collapse'"
        @pointerdown.stop
        @click="toggleCollapsed"
      >
        <Maximize2 v-if="collapsed" class="size-3.5" />
        <Minus v-else class="size-3.5" />
      </button>
    </header>

    <div
      id="we-devtools-content"
      :inert="collapsed"
      :aria-hidden="collapsed"
      class="grid min-h-0 flex-1 transition-[grid-template-rows] duration-250 ease-in-out motion-reduce:transition-none"
      :class="collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
    >
      <div class="flex h-full min-h-0 flex-col overflow-hidden">
        <Tabs
          :model-value="active"
          class="flex min-h-0 flex-1 flex-col overflow-hidden"
          @update:model-value="changeTab"
        >
          <TabsList
            aria-label="Simulator controls"
            class="grid h-auto w-full shrink-0 grid-cols-4 gap-1 rounded-none border-b border-we-border bg-we-surface p-2"
          >
            <TabsTrigger
              v-for="tab in tabs"
              :key="tab.id"
              :value="tab.id"
              :aria-label="`${tab.label}: ${tabStatuses[tab.id].label}`"
              :title="`${tab.label}: ${tabStatuses[tab.id].label}`"
              class="group relative flex h-16 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent bg-transparent px-1 text-[12px] font-medium text-we-faint shadow-none transition-colors hover:bg-we-btn/40 hover:text-we-text focus-visible:z-10 data-[state=active]:border-we-primary/30 data-[state=active]:bg-we-primary/10 data-[state=active]:text-we-text"
            >
              <component :is="tab.icon" class="size-4" aria-hidden="true" />
              <span class="max-w-full truncate leading-4">{{ tab.label }}</span>
              <span
                data-tab-status
                class="flex max-w-full items-center gap-1 text-[10px] leading-3 font-normal"
                :class="statusColors[tabStatuses[tab.id].tone]"
              >
                <span class="size-1 shrink-0 rounded-full bg-current" aria-hidden="true" />
                <span class="truncate">{{ tabStatuses[tab.id].label }}</span>
              </span>
            </TabsTrigger>
          </TabsList>

          <ScrollArea type="hover" class="min-h-0 flex-1">
            <Transition
              name="we-tab-content"
              mode="out-in"
              @enter="onTabEnter"
            >
              <TabsContent
                :key="active"
                :value="active"
                class="p-4 pr-5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-we-primary"
              >
                <component :is="tabComponents[active]" />
              </TabsContent>
            </Transition>
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
