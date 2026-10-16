<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import { computed } from 'vue';
import ArrowClockwise from '~icons/ph/arrow-clockwise-duotone';
import Gauge from '~icons/ph/gauge-duotone';
import Timer from '~icons/ph/timer-duotone';
import Warning from '~icons/ph/warning-duotone';
import { performanceState } from '../performance';

defineEmits<{
  reset: [];
}>();

const snapshot = computed(() => performanceState.value);
const isMeasuring = computed(() => snapshot.value.status === 'monitoring');

function formatMilliseconds(value: number | null): string {
  if (value === null)
    return '—';
  const precision = value < 10 ? 1 : 0;
  return `${value.toFixed(precision)} ms`;
}

function formatFps(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)} FPS`;
}

function formatBytes(value: number): string {
  if (value === 0)
    return 'unavailable / cache';
  if (value < 1024)
    return `${value} B`;
  if (value < 1024 * 1024)
    return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}
</script>

<template>
  <div class="space-y-4">
    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">
            Runtime performance
          </h2>
          <p class="we-card-description">
            Measured in the wallpaper document. Development tooling can affect timings.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="we-callback-status"
            :class="isMeasuring ? 'text-emerald-300' : snapshot.status === 'hidden' ? 'text-amber-300' : 'text-we-faint'"
          >
            <span
              class="size-1.5 rounded-full"
              :class="isMeasuring ? 'bg-emerald-400' : snapshot.status === 'hidden' ? 'bg-amber-300' : 'bg-we-border-strong'"
              aria-hidden="true"
            />
            {{ isMeasuring ? 'Measuring host' : snapshot.status === 'hidden' ? 'Paused while hidden' : 'Waiting for host' }}
          </span>
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            :disabled="snapshot.status === 'idle'"
            @click="$emit('reset')"
          >
            <ArrowClockwise class="size-3.5" aria-hidden="true" />
            Reset
          </UButton>
        </div>
      </div>

      <div class="grid grid-cols-3 divide-x divide-we-border/70 border-y border-we-border/70">
        <div class="min-w-0 py-3 pr-3">
          <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-we-faint">
            <Gauge class="size-3" aria-hidden="true" />
            Frame rate
          </div>
          <output class="mt-1 block font-mono text-[16px] font-semibold tabular-nums text-we-text">
            {{ formatFps(snapshot.fps) }}
          </output>
          <p class="mt-1 text-[10px] text-we-faint">
            {{ snapshot.frameSamples }} recent frames
          </p>
        </div>
        <div class="min-w-0 px-3 py-3">
          <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-we-faint">
            <Timer class="size-3" aria-hidden="true" />
            Average frame
          </div>
          <output class="mt-1 block font-mono text-[16px] font-semibold tabular-nums text-we-text">
            {{ formatMilliseconds(snapshot.averageFrameMs) }}
          </output>
          <p class="mt-1 text-[10px] text-we-faint">
            P95 {{ formatMilliseconds(snapshot.p95FrameMs) }}
          </p>
        </div>
        <div class="min-w-0 py-3 pl-3">
          <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-we-faint">
            <Warning class="size-3" aria-hidden="true" />
            Long tasks
          </div>
          <output class="mt-1 block font-mono text-[16px] font-semibold tabular-nums text-we-text">
            {{ snapshot.longTasks.supported ? snapshot.longTasks.count : '—' }}
          </output>
          <p class="mt-1 text-[10px] text-we-faint">
            <template v-if="snapshot.longTasks.supported">
              {{ formatMilliseconds(snapshot.longTasks.maxDuration) }} longest
            </template>
            <template v-else>
              Not supported here
            </template>
          </p>
        </div>
      </div>
    </section>

    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">
            Page timing
          </h2>
          <p class="we-card-description">
            Browser navigation marks from the wallpaper page.
          </p>
        </div>
      </div>
      <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-we-border bg-we-border">
        <div class="bg-we-surface px-3 py-2.5">
          <dt class="text-[10px] uppercase tracking-[0.08em] text-we-faint">
            DOM ready
          </dt>
          <dd class="mt-1 font-mono text-[12px] tabular-nums text-we-muted">
            {{ formatMilliseconds(snapshot.navigation.domContentLoaded) }}
          </dd>
        </div>
        <div class="bg-we-surface px-3 py-2.5">
          <dt class="text-[10px] uppercase tracking-[0.08em] text-we-faint">
            Load complete
          </dt>
          <dd class="mt-1 font-mono text-[12px] tabular-nums text-we-muted">
            {{ formatMilliseconds(snapshot.navigation.load) }}
          </dd>
        </div>
      </dl>
      <p v-if="!snapshot.navigation.supported" class="mt-2 text-[11px] text-we-faint">
        Navigation timing is unavailable in this host.
      </p>
    </section>

    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">
            Resource cost
          </h2>
          <p class="we-card-description">
            The ten heaviest observed resources. A zero transfer value can mean cache or unavailable timing data.
          </p>
        </div>
      </div>
      <div v-if="snapshot.resources.length === 0" class="rounded-lg border border-dashed border-we-border px-3 py-4 text-[11px] text-we-faint">
        No resource timing entries are available yet.
      </div>
      <ol v-else class="divide-y divide-we-border/70 border-y border-we-border/70">
        <li v-for="resource in snapshot.resources" :key="`${resource.name}-${resource.initiatorType}`" class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2.5">
          <div class="min-w-0">
            <p class="truncate font-mono text-[11px] text-we-muted" :title="resource.name">
              {{ resource.name }}
            </p>
            <p class="mt-0.5 text-[10px] text-we-faint">
              {{ resource.initiatorType }} · {{ formatMilliseconds(resource.duration) }}
            </p>
          </div>
          <div class="text-right font-mono text-[10px] tabular-nums text-we-faint">
            <p>{{ formatBytes(resource.transferSize) }}</p>
            <p class="mt-0.5">
              {{ formatBytes(resource.decodedBodySize) }} decoded
            </p>
          </div>
        </li>
      </ol>
    </section>

    <section v-if="snapshot.audits.length > 0" class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">
            Observed checks
          </h2>
          <p class="we-card-description">
            Findings are based only on data observed in this page.
          </p>
        </div>
      </div>
      <ul class="space-y-2">
        <li v-for="audit in snapshot.audits" :key="audit.title" class="rounded-lg border px-3 py-2.5" :class="audit.severity === 'warning' ? 'border-amber-400/30 bg-amber-400/5' : 'border-we-border bg-we-surface'">
          <p class="text-[12px] font-medium" :class="audit.severity === 'warning' ? 'text-amber-200' : 'text-we-muted'">
            {{ audit.title }}
          </p>
          <p class="mt-0.5 text-[11px] leading-4 text-we-faint">
            {{ audit.detail }}
          </p>
        </li>
      </ul>
    </section>
  </div>
</template>
