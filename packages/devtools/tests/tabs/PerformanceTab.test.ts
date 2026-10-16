import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(() => {
  window.__WE_DEVTOOLS_CONFIG__ = { properties: {}, localization: {} };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
});

describe('performanceTab', () => {
  it('renders measured host data without inventing unavailable transfer sizes', async () => {
    const [{ default: PerformanceTab }, { performanceState }] = await Promise.all([
      import('../../src/tabs/PerformanceTab.vue'),
      import('../../src/performance'),
    ]);
    performanceState.value = {
      status: 'monitoring',
      collectedAt: 500,
      frameSamples: 60,
      fps: 59.7,
      averageFrameMs: 16.75,
      p95FrameMs: 22,
      longTasks: { supported: true, count: 2, totalDuration: 150, maxDuration: 90 },
      navigation: { supported: true, domContentLoaded: 120, load: 350 },
      resources: [{ name: 'https://wallpaper.test/hero.png', initiatorType: 'img', transferSize: 0, decodedBodySize: 3 * 1024 * 1024, duration: 45 }],
      audits: [{ severity: 'warning', title: 'Large decoded images', detail: '1 image uses over 2 MiB decoded memory.' }],
    };
    const wrapper = mount(PerformanceTab);

    expect(wrapper.text()).toContain('60 FPS');
    expect(wrapper.text()).toContain('17 ms');
    expect(wrapper.text()).toContain('unavailable / cache');
    expect(wrapper.text()).toContain('Large decoded images');
    wrapper.unmount();
  });

  it('shows unsupported and hidden states, and emits reset only when active', async () => {
    const [{ default: PerformanceTab }, { performanceState }] = await Promise.all([
      import('../../src/tabs/PerformanceTab.vue'),
      import('../../src/performance'),
    ]);
    performanceState.value = {
      status: 'hidden',
      collectedAt: 1,
      frameSamples: 0,
      fps: null,
      averageFrameMs: null,
      p95FrameMs: null,
      longTasks: { supported: false, count: 0, totalDuration: 0, maxDuration: 0 },
      navigation: { supported: false, domContentLoaded: null, load: null },
      resources: [],
      audits: [],
    };
    const wrapper = mount(PerformanceTab);
    expect(wrapper.text()).toContain('Paused while hidden');
    expect(wrapper.text()).toContain('Not supported here');
    expect(wrapper.text()).toContain('Navigation timing is unavailable');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('reset')).toEqual([[]]);

    performanceState.value = { ...performanceState.value, status: 'idle' };
    await wrapper.vm.$nextTick();
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });
});
