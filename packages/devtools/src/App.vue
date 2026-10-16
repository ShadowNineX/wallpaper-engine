<script setup lang="ts">
import UAlert from '@nuxt/ui/components/Alert.vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UTabs from '@nuxt/ui/components/Tabs.vue';
import { useEventListener } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import AlignBottom from '~icons/ph/align-bottom';
import ArrowSquareOut from '~icons/ph/arrow-square-out';
import Gauge from '~icons/ph/gauge-duotone';
import Settings2 from '~icons/ph/gear-six-duotone';
import Music2 from '~icons/ph/music-notes-duotone';
import Sidebar from '~icons/ph/sidebar-simple';
import SlidersHorizontal from '~icons/ph/sliders-horizontal-duotone';
import AudioLines from '~icons/ph/waveform-duotone';
import X from '~icons/ph/x';
import { AUDIO_MODE_LABELS, audioState } from './audio';
import { cfg } from './config';
import { useDevtoolsStore } from './store';
import AudioTab from './tabs/AudioTab.vue';
import GeneralTab from './tabs/GeneralTab.vue';
import MediaTab from './tabs/MediaTab.vue';
import PerformanceTab from './tabs/PerformanceTab.vue';
import PropertiesTab from './tabs/PropertiesTab.vue';

const appProps = withDefaults(defineProps<{
  embedded?: boolean;
  connected?: boolean;
  detached?: boolean;
  opening?: boolean;
  placement?: 'right' | 'bottom' | 'floating';
}>(), {
  embedded: false,
  connected: true,
  detached: false,
  opening: false,
  placement: 'right',
});

const emit = defineEmits<{
  detach: [];
  dock: [placement: 'right' | 'bottom'];
  close: [];
  resetPerformance: [];
  drag: [phase: 'start' | 'move' | 'end', x: number, y: number];
}>();

type TabId = 'properties' | 'general' | 'audio' | 'media' | 'performance';
type StatusTone = 'positive' | 'neutral' | 'warning';

interface TabStatus {
  label: string;
  tone: StatusTone;
}

const devtoolsBuildLabel = `v${__WE_DEVTOOLS_VERSION__}`;
const devtoolsBuildTitle
  = `Devtools ${__WE_DEVTOOLS_VERSION__} (git ${__WE_DEVTOOLS_GIT_VERSION__})`;

const tabs: Array<{ value: TabId; label: string }> = [
  { value: 'properties', label: 'Properties' },
  { value: 'general', label: 'Runtime' },
  { value: 'audio', label: 'Audio' },
  { value: 'media', label: 'Media' },
  { value: 'performance', label: 'Performance' },
];

const tabIcons = {
  properties: SlidersHorizontal,
  general: Settings2,
  audio: AudioLines,
  media: Music2,
  performance: Gauge,
} as const;

const tabComponents = {
  properties: PropertiesTab,
  general: GeneralTab,
  audio: AudioTab,
  media: MediaTab,
  performance: PerformanceTab,
} as const;

const store = useDevtoolsStore();
const { listenerCounts, mediaActive } = storeToRefs(store);
const tabStatuses = computed<Record<TabId, TabStatus>>(() => ({
  properties: listenerCounts.value.property
    ? { label: 'Ready', tone: 'positive' }
    : { label: 'No listener', tone: 'warning' },
  general: store.general.paused
    ? { label: 'Paused', tone: 'warning' }
    : { label: 'Running', tone: 'positive' },
  audio: audioState.mode === 'off'
    ? { label: 'Off', tone: 'neutral' }
    : listenerCounts.value.audio === 0
      ? { label: 'No listener', tone: 'warning' }
      : { label: AUDIO_MODE_LABELS[audioState.mode], tone: 'positive' },
  media: mediaActive.value
    ? { label: 'Enabled', tone: 'positive' }
    : { label: 'Disabled', tone: 'neutral' },
  performance: { label: 'Host metrics', tone: 'neutral' },
}));

const statusColors: Record<StatusTone, string> = {
  positive: 'we-status-positive',
  neutral: 'we-status-neutral',
  warning: 'we-status-warning',
};

const activeTabKey = `we-devtools:active-tab:${cfg.title ?? 'wallpaper'}`;

function readActiveTab(): TabId {
  try {
    const saved = window.localStorage.getItem(activeTabKey);
    return saved && Object.hasOwn(tabComponents, saved)
      ? saved as TabId
      : 'properties';
  }
  catch {
    return 'properties';
  }
}

const active = ref<TabId>(readActiveTab());
const dragPointer = ref<number>();

function startDrag(event: PointerEvent): void {
  if (!appProps.embedded || !appProps.connected || appProps.detached || event.button !== 0
    || dragPointer.value !== undefined
    || (event.target instanceof Element && event.target.closest('button, a, input, select'))) {
    return;
  }
  event.preventDefault();
  dragPointer.value = event.pointerId;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  emit('drag', 'start', event.clientX, event.clientY);
}

useEventListener(window, 'pointermove', (event) => {
  if (dragPointer.value === event.pointerId)
    emit('drag', 'move', event.clientX, event.clientY);
});
function stopDrag(event: PointerEvent): void {
  if (dragPointer.value !== event.pointerId)
    return;
  dragPointer.value = undefined;
  emit('drag', 'end', event.clientX, event.clientY);
}
useEventListener(window, 'pointerup', stopDrag);
useEventListener(window, 'pointercancel', stopDrag);

function moveWithKeyboard(event: KeyboardEvent): void {
  if (event.target !== event.currentTarget || !appProps.embedded || !appProps.connected || appProps.detached)
    return;
  const directions: Record<string, readonly [number, number]> = {
    ArrowLeft: [-20, 0],
    ArrowRight: [20, 0],
    ArrowUp: [0, -20],
    ArrowDown: [0, 20],
  };
  const direction = directions[event.key];
  if (!direction)
    return;
  event.preventDefault();
  emit('drag', 'start', 0, 0);
  emit('drag', 'move', direction[0], direction[1]);
  emit('drag', 'end', direction[0], direction[1]);
}

watch(active, (value) => {
  try {
    window.localStorage.setItem(activeTabKey, value);
  }
  catch {
    // Navigation remains available when storage is blocked.
  }
});

useEventListener(window, 'storage', (event) => {
  if (event.key === activeTabKey)
    active.value = readActiveTab();
});

function changeTab(value: string | number): void {
  if (typeof value === 'string' && Object.hasOwn(tabComponents, value))
    active.value = value as TabId;
}

function tabStatus(tab: TabId): TabStatus {
  return tabStatuses.value[tab];
}

function getTabId(value: unknown): TabId {
  return typeof value === 'string' && Object.hasOwn(tabComponents, value)
    ? value as TabId
    : 'properties';
}
</script>

<template>
  <section
    role="region"
    aria-label="Wallpaper Engine Devtools"
    class="we-devtools-panel dark"
    :class="appProps.embedded ? 'we-devtools-panel--embedded' : 'we-devtools-panel--standalone'"
  >
    <header
      class="we-command-bar"
      :class="{ 'cursor-grab': appProps.embedded && !appProps.detached, 'cursor-grabbing': dragPointer !== undefined }"
      :tabindex="appProps.embedded && !appProps.detached ? 0 : undefined"
      :aria-label="appProps.embedded && !appProps.detached ? 'Move devtools: drag the header or use arrow keys' : undefined"
      @pointerdown="startDrag"
      @keydown="moveWithKeyboard"
    >
      <div class="we-brand-mark" aria-hidden="true">
        <SlidersHorizontal class="size-4" />
      </div>

      <div class="we-brand-copy">
        <h1>Wallpaper Engine Devtools</h1>
        <div class="we-brand-meta">
          <span v-if="cfg.title" class="we-project-title">{{ cfg.title }}</span>
          <span v-if="cfg.title" aria-hidden="true">/</span>
          <UBadge
            data-devtools-version
            color="neutral"
            variant="subtle"
            size="sm"
            :aria-label="devtoolsBuildTitle"
            :title="devtoolsBuildTitle"
          >
            {{ devtoolsBuildLabel }}
          </UBadge>
        </div>
      </div>

      <div v-if="appProps.embedded" class="we-window-actions" aria-label="Devtools window controls">
        <UButton type="button" color="neutral" :variant="!appProps.detached && appProps.placement === 'right' ? 'soft' : 'ghost'" size="sm" square aria-label="Dock devtools right" title="Dock right" :aria-pressed="!appProps.detached && appProps.placement === 'right'" @click="emit('dock', 'right')">
          <Sidebar class="size-4" aria-hidden="true" />
        </UButton>
        <UButton type="button" color="neutral" :variant="!appProps.detached && appProps.placement === 'bottom' ? 'soft' : 'ghost'" size="sm" square aria-label="Dock devtools bottom" title="Dock bottom" :aria-pressed="!appProps.detached && appProps.placement === 'bottom'" @click="emit('dock', 'bottom')">
          <AlignBottom class="size-4" aria-hidden="true" />
        </UButton>
        <UButton type="button" color="neutral" variant="ghost" size="sm" square :loading="appProps.opening" :disabled="appProps.opening" :aria-label="appProps.opening ? 'Opening devtools in separate window' : appProps.detached ? 'Return devtools to wallpaper' : 'Open devtools in separate window'" :title="appProps.opening ? 'Opening separate window' : appProps.detached ? 'Return to wallpaper' : 'Separate window'" @click="emit('detach')">
          <ArrowSquareOut class="size-4" aria-hidden="true" />
        </UButton>
        <UButton type="button" color="neutral" variant="ghost" size="sm" square aria-label="Hide devtools" title="Hide devtools" @click="emit('close')">
          <X class="size-4" aria-hidden="true" />
        </UButton>
      </div>
    </header>

    <UAlert
      v-if="appProps.embedded && !appProps.connected"
      role="status"
      color="warning"
      variant="subtle"
      title="Waiting for the wallpaper connection"
      description="Controls will reconnect automatically."
      class="we-connection-alert"
    />

    <main id="we-devtools-content" :inert="appProps.embedded && !appProps.connected" class="we-workbench">
      <UTabs
        :items="tabs"
        :model-value="active"
        :content="true"
        :unmount-on-hide="true"
        activation-mode="automatic"
        aria-label="Simulator controls"
        class="we-tabs"
        :ui="{
          root: 'we-tabs-root',
          list: 'we-tabs-list',
          indicator: 'we-tabs-indicator',
          trigger: 'we-tab-trigger',
          content: 'we-tab-panel',
        }"
        @update:model-value="changeTab"
      >
        <template #leading="{ item }">
          <component :is="tabIcons[getTabId(item.value)]" class="we-tab-icon" aria-hidden="true" />
        </template>

        <template #default="{ item }">
          <span class="we-tab-label">{{ item.label }}</span>
          <span data-tab-status class="we-tab-status" :class="statusColors[tabStatus(getTabId(item.value)).tone]">
            <span class="we-status-dot" aria-hidden="true" />
            <span class="we-status-label">{{ tabStatus(getTabId(item.value)).label }}</span>
          </span>
        </template>

        <template #content="{ item }">
          <div class="we-tab-scroll-region">
            <component :is="tabComponents[getTabId(item.value)]" @reset="emit('resetPerformance')" />
          </div>
        </template>
      </UTabs>
    </main>
  </section>
</template>
