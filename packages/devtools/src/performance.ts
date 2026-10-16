import { shallowRef } from 'vue';

const MAX_FRAME_SAMPLES = 120;
const MAX_RESOURCE_ENTRIES = 10;
const PUBLISH_INTERVAL = 500;
const LONG_TASK_THRESHOLD = 50;
const LARGE_IMAGE_BYTES = 2 * 1024 * 1024;

export type PerformanceAuditSeverity = 'info' | 'warning';

export interface PerformanceAudit {
  severity: PerformanceAuditSeverity;
  title: string;
  detail: string;
}

export interface PerformanceResource {
  name: string;
  initiatorType: string;
  transferSize: number;
  decodedBodySize: number;
  duration: number;
}

export interface PerformanceSnapshot {
  status: 'idle' | 'monitoring' | 'hidden' | 'unsupported';
  collectedAt: number | null;
  frameSamples: number;
  fps: number | null;
  averageFrameMs: number | null;
  p95FrameMs: number | null;
  longTasks: {
    supported: boolean;
    count: number;
    totalDuration: number;
    maxDuration: number;
  };
  navigation: {
    supported: boolean;
    domContentLoaded: number | null;
    load: number | null;
  };
  resources: PerformanceResource[];
  audits: PerformanceAudit[];
}

interface NavigationEntry extends PerformanceEntry {
  domContentLoadedEventEnd: number;
  loadEventEnd: number;
}

interface ResourceEntry extends PerformanceEntry {
  initiatorType: string;
  transferSize: number;
  decodedBodySize: number;
}

interface LongTaskEntry extends PerformanceEntry {}

function emptySnapshot(): PerformanceSnapshot {
  return {
    status: 'idle',
    collectedAt: null,
    frameSamples: 0,
    fps: null,
    averageFrameMs: null,
    p95FrameMs: null,
    longTasks: {
      supported: typeof PerformanceObserver !== 'undefined',
      count: 0,
      totalDuration: 0,
      maxDuration: 0,
    },
    navigation: {
      supported: false,
      domContentLoaded: null,
      load: null,
    },
    resources: [],
    audits: [],
  };
}

export const performanceState = shallowRef<PerformanceSnapshot>(emptySnapshot());

let activeStop: (() => void) | undefined;
let resetActiveMeasurements: (() => void) | undefined;

function finite(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function getNavigation(): PerformanceSnapshot['navigation'] {
  if (typeof performance?.getEntriesByType !== 'function') {
    return { supported: false, domContentLoaded: null, load: null };
  }
  const entry = performance.getEntriesByType('navigation')[0] as NavigationEntry | undefined;
  if (!entry) {
    return { supported: false, domContentLoaded: null, load: null };
  }
  return {
    supported: true,
    domContentLoaded: entry.domContentLoadedEventEnd > 0 ? finite(entry.domContentLoadedEventEnd) : null,
    load: entry.loadEventEnd > 0 ? finite(entry.loadEventEnd) : null,
  };
}

function isDevtoolsResource(name: string): boolean {
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  }
  catch {
    // Keep malformed resource names visible instead of hiding arbitrary URLs.
  }
  return decoded.includes('virtual:wallpaper-engine/devtools')
    || decoded.includes('/__wallpaper-engine-devtools__/');
}

function getResources(): PerformanceResource[] {
  if (typeof performance?.getEntriesByType !== 'function')
    return [];
  return performance
    .getEntriesByType('resource')
    .map(entry => entry as ResourceEntry)
    .filter(entry => !isDevtoolsResource(entry.name))
    .sort((left, right) => (
      (right.transferSize + right.decodedBodySize + right.duration)
      - (left.transferSize + left.decodedBodySize + left.duration)
    ))
    .slice(0, MAX_RESOURCE_ENTRIES)
    .map(entry => ({
      name: entry.name,
      initiatorType: entry.initiatorType || 'other',
      transferSize: Math.max(0, entry.transferSize || 0),
      decodedBodySize: Math.max(0, entry.decodedBodySize || 0),
      duration: Math.max(0, entry.duration || 0),
    }));
}

function getMissingAltCount(): number {
  if (typeof document === 'undefined')
    return 0;
  return [...document.querySelectorAll('img:not([alt])')]
    .filter(image => !image.closest('wallpaper-engine-devtools'))
    .length;
}

function percentile95(samples: readonly number[]): number | null {
  if (samples.length === 0)
    return null;
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null;
}

/** Starts bounded performance sampling for the wallpaper document. */
export function startPerformanceMonitor(): () => void {
  activeStop?.();

  const frameSamples: number[] = [];
  let longTaskCount = 0;
  let longTaskTotal = 0;
  let longTaskMax = 0;
  let frameHandle: number | undefined;
  let previousFrame: number | undefined;
  let lastPublishedAt = -Infinity;
  let stopped = false;
  let observer: PerformanceObserver | undefined;
  let longTaskSupported = false;

  function reset(): void {
    frameSamples.length = 0;
    longTaskCount = 0;
    longTaskTotal = 0;
    longTaskMax = 0;
    previousFrame = undefined;
    lastPublishedAt = -Infinity;
    publish(performance.now());
  }

  const audits = (resources: readonly PerformanceResource[]): PerformanceAudit[] => {
    const result: PerformanceAudit[] = [];
    if (longTaskCount > 0) {
      result.push({
        severity: 'warning',
        title: 'Long main-thread work observed',
        detail: `${longTaskCount} task${longTaskCount === 1 ? '' : 's'} exceeded ${LONG_TASK_THRESHOLD} ms; longest ${Math.round(longTaskMax)} ms.`,
      });
    }
    const largeImages = resources.filter(resource => resource.initiatorType === 'img' && resource.decodedBodySize > LARGE_IMAGE_BYTES);
    if (largeImages.length > 0) {
      result.push({
        severity: 'warning',
        title: 'Large image responses',
        detail: `${largeImages.length} image response${largeImages.length === 1 ? '' : 's'} exceeds 2 MiB after HTTP decompression.`,
      });
    }
    const missingAlt = getMissingAltCount();
    if (missingAlt > 0) {
      result.push({
        severity: 'info',
        title: 'Images without alternative text',
        detail: `${missingAlt} wallpaper image${missingAlt === 1 ? '' : 's'} has no alt attribute.`,
      });
    }
    return result;
  };

  function publish(now: number, status: PerformanceSnapshot['status'] = document.visibilityState === 'hidden' ? 'hidden' : 'monitoring'): void {
    const averageFrameMs = frameSamples.length === 0
      ? null
      : frameSamples.reduce((total, sample) => total + sample, 0) / frameSamples.length;
    const resources = getResources();
    performanceState.value = {
      status,
      collectedAt: now,
      frameSamples: frameSamples.length,
      fps: averageFrameMs && averageFrameMs > 0 ? 1000 / averageFrameMs : null,
      averageFrameMs,
      p95FrameMs: percentile95(frameSamples),
      longTasks: {
        supported: longTaskSupported,
        count: longTaskCount,
        totalDuration: longTaskTotal,
        maxDuration: longTaskMax,
      },
      navigation: getNavigation(),
      resources,
      audits: audits(resources),
    };
    lastPublishedAt = now;
  }

  const scheduleFrame = () => {
    frameHandle = requestAnimationFrame((frame) => {
      if (stopped)
        return;
      if (document.visibilityState === 'hidden') {
        previousFrame = undefined;
        if (frame - lastPublishedAt >= PUBLISH_INTERVAL)
          publish(frame, 'hidden');
        return;
      }
      if (previousFrame !== undefined) {
        const duration = frame - previousFrame;
        if (duration >= 0 && duration < 1000) {
          frameSamples.push(duration);
          if (frameSamples.length > MAX_FRAME_SAMPLES)
            frameSamples.splice(0, frameSamples.length - MAX_FRAME_SAMPLES);
        }
      }
      previousFrame = frame;
      if (frame - lastPublishedAt >= PUBLISH_INTERVAL)
        publish(frame);
      scheduleFrame();
    });
  };

  const onVisibilityChange = () => {
    previousFrame = undefined;
    if (document.visibilityState === 'hidden') {
      if (frameHandle !== undefined)
        cancelAnimationFrame(frameHandle);
      frameHandle = undefined;
      publish(performance.now(), 'hidden');
      return;
    }
    publish(performance.now());
    scheduleFrame();
  };

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      observer = new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries() as LongTaskEntry[]) {
          longTaskCount += 1;
          longTaskTotal += entry.duration;
          longTaskMax = Math.max(longTaskMax, entry.duration);
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
      longTaskSupported = true;
    }
    catch {
      observer = undefined;
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  publish(performance.now());
  if (document.visibilityState !== 'hidden')
    scheduleFrame();

  const stop = () => {
    if (stopped)
      return;
    stopped = true;
    if (frameHandle !== undefined)
      cancelAnimationFrame(frameHandle);
    observer?.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (activeStop === stop)
      activeStop = undefined;
    if (resetActiveMeasurements === reset)
      resetActiveMeasurements = undefined;
    performanceState.value = { ...emptySnapshot(), status: 'idle' };
  };
  activeStop = stop;
  resetActiveMeasurements = reset;
  return stop;
}

/** Clears samples collected by the currently running monitor. */
export function resetPerformanceMeasurements(): void {
  resetActiveMeasurements?.();
}
