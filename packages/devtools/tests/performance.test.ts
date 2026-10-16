import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface RafCallback {
  (time: number): void;
}

let rafCallbacks = new Map<number, RafCallback>();
let nextRaf = 1;
let originalVisibility: PropertyDescriptor | undefined;

function runFrame(time: number): void {
  const callback = rafCallbacks.get(nextRaf - 1);
  callback?.(time);
}

beforeEach(() => {
  vi.resetModules();
  rafCallbacks = new Map();
  nextRaf = 1;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: RafCallback) => {
    const id = nextRaf++;
    rafCallbacks.set(id, callback);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => rafCallbacks.delete(id)));
  vi.spyOn(performance, 'now').mockReturnValue(0);
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([]);
  originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalVisibility)
    Object.defineProperty(document, 'visibilityState', originalVisibility);
  else
    Reflect.deleteProperty(document, 'visibilityState');
  document.querySelectorAll('[data-performance-test]').forEach(node => node.remove());
});

describe('performance monitor', () => {
  it('publishes bounded RAF frame samples at most twice per second', async () => {
    const { performanceState, startPerformanceMonitor } = await import('../src/performance');
    const stop = startPerformanceMonitor();

    runFrame(0);
    for (let time = 16; time <= 3_000; time += 16)
      runFrame(time);

    expect(performanceState.value.status).toBe('monitoring');
    expect(performanceState.value.frameSamples).toBeLessThanOrEqual(120);
    expect(performanceState.value.frameSamples).toBe(120);
    expect(performanceState.value.fps).toBeCloseTo(62.5, 1);
    expect(performanceState.value.averageFrameMs).toBe(16);
    stop();
    expect(performanceState.value.status).toBe('idle');
  });

  it('reports observed long tasks, resource costs, and bounded audits', async () => {
    let observeCallback: PerformanceObserverCallback | undefined;
    class FakePerformanceObserver {
      constructor(callback: PerformanceObserverCallback) {
        observeCallback = callback;
      }

      disconnect = vi.fn();
      observe = vi.fn();
    }
    vi.stubGlobal('PerformanceObserver', FakePerformanceObserver);
    vi.mocked(performance.getEntriesByType).mockImplementation((type) => {
      if (type === 'navigation') {
        return [{ domContentLoadedEventEnd: 120, loadEventEnd: 360 }] as unknown as PerformanceEntryList;
      }
      if (type === 'resource') {
        return [{
          name: 'https://wallpaper.test/hero.png',
          initiatorType: 'img',
          transferSize: 0,
          decodedBodySize: 3 * 1024 * 1024,
          duration: 44,
        }] as unknown as PerformanceEntryList;
      }
      return [];
    });
    const image = document.createElement('img');
    image.dataset.performanceTest = '';
    document.body.append(image);
    const { performanceState, startPerformanceMonitor } = await import('../src/performance');
    const stop = startPerformanceMonitor();

    observeCallback?.({ getEntries: () => [{ duration: 72 }] } as PerformanceObserverEntryList, {} as PerformanceObserver);
    runFrame(500);

    expect(performanceState.value.longTasks).toMatchObject({ supported: true, count: 1, totalDuration: 72, maxDuration: 72 });
    expect(performanceState.value.resources).toEqual([expect.objectContaining({ transferSize: 0, decodedBodySize: 3 * 1024 * 1024 })]);
    expect(performanceState.value.navigation).toEqual({ supported: true, domContentLoaded: 120, load: 360 });
    expect(performanceState.value.audits.map(audit => audit.title)).toEqual([
      'Long main-thread work observed',
      'Large image responses',
      'Images without alternative text',
    ]);
    stop();
  });

  it('excludes injected devtools routes while keeping similarly named wallpaper resources', async () => {
    vi.mocked(performance.getEntriesByType).mockImplementation((type) => {
      if (type !== 'resource')
        return [];
      return [
        {
          name: 'https://wallpaper.test/@id/virtual:wallpaper-engine/devtools',
          initiatorType: 'script',
          transferSize: 20,
          decodedBodySize: 20,
          duration: 2,
        },
        {
          name: 'https://wallpaper.test/@id/__x00__virtual%3Awallpaper-engine%2Fdevtools-frontend',
          initiatorType: 'script',
          transferSize: 20,
          decodedBodySize: 20,
          duration: 2,
        },
        {
          name: 'https://wallpaper.test/dev/__wallpaper-engine-devtools__/',
          initiatorType: 'iframe',
          transferSize: 20,
          decodedBodySize: 20,
          duration: 2,
        },
        {
          name: 'https://wallpaper.test/assets/wallpaper-engine-devtools-logo.png',
          initiatorType: 'img',
          transferSize: 42,
          decodedBodySize: 84,
          duration: 4,
        },
      ] as unknown as PerformanceEntryList;
    });
    const { performanceState, startPerformanceMonitor } = await import('../src/performance');
    const stop = startPerformanceMonitor();

    expect(performanceState.value.resources).toEqual([
      expect.objectContaining({
        name: 'https://wallpaper.test/assets/wallpaper-engine-devtools-logo.png',
        transferSize: 42,
      }),
    ]);
    stop();
  });

  it('pauses while hidden and rebases frame timing on return', async () => {
    const { performanceState, startPerformanceMonitor } = await import('../src/performance');
    const stop = startPerformanceMonitor();
    runFrame(0);
    runFrame(16);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(performanceState.value.status).toBe('hidden');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    runFrame(10_000);
    runFrame(10_016);

    expect(performanceState.value.status).toBe('monitoring');
    expect(performanceState.value.p95FrameMs).toBe(16);
    stop();
  });

  it('clears measurements without stopping the active monitor', async () => {
    const { performanceState, resetPerformanceMeasurements, startPerformanceMonitor } = await import('../src/performance');
    const stop = startPerformanceMonitor();
    runFrame(0);
    runFrame(16);
    resetPerformanceMeasurements();

    expect(performanceState.value.status).toBe('monitoring');
    expect(performanceState.value.frameSamples).toBe(0);
    expect(performanceState.value.longTasks.count).toBe(0);
    stop();
  });

  it('marks long-task data unavailable when the browser rejects that entry type', async () => {
    class RejectingPerformanceObserver {
      constructor(_: PerformanceObserverCallback) {}

      disconnect = vi.fn();
      observe = vi.fn(() => {
        throw new Error('longtask is not supported');
      });
    }
    vi.stubGlobal('PerformanceObserver', RejectingPerformanceObserver);
    const { performanceState, startPerformanceMonitor } = await import('../src/performance');
    const stop = startPerformanceMonitor();

    expect(performanceState.value.longTasks.supported).toBe(false);
    stop();
  });
});
