import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

vi.mock('vue-sonner', () => ({
  Toaster: { template: '<div data-testid=\'toaster\' />' },
  toast: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('__WE_DEVTOOLS_VERSION__', '1.2.3');
  vi.stubGlobal('__WE_DEVTOOLS_GIT_VERSION__', 'abc1234-dirty');
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = {
    title: 'Aether test wallpaper',
    properties: {
      enabled: { type: 'bool', text: 'Enabled', value: true },
    },
    localization: {},
  };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('devtools app shell', () => {
  it('renders all simulator tabs, switches content, and collapses in place', async () => {
    const { default: App } = await import('../src/App.vue');
    const wrapper = mount(App);

    expect(wrapper.text()).toContain('Wallpaper Engine Devtools');
    expect(wrapper.text()).toContain('Aether test wallpaper');
    const version = wrapper.get('[data-devtools-version]');
    expect(version.text()).toBe('v1.2.3 · abc1234-dirty');
    expect(version.attributes('title')).toBe(
      'Devtools 1.2.3 (git abc1234-dirty)',
    );
    expect(
      wrapper
        .findAll('[role="tab"]')
        .map(tab => tab.attributes('aria-label')),
    ).toEqual([
      'Properties: No listener',
      'Runtime: Running',
      'Audio: Off',
      'Media: Disabled',
    ]);
    expect(wrapper.text()).toContain('User properties');

    const runtimeTab = wrapper
      .findAll('[role="tab"]')
      .find(tab => tab.text().includes('Runtime'));
    await runtimeTab?.trigger('mousedown', { button: 0, ctrlKey: false });
    expect(wrapper.text()).toContain('Wallpaper runtime');

    const mediaTab = wrapper
      .findAll('[role="tab"]')
      .find(tab => tab.text().includes('Media'));
    await mediaTab?.trigger('mousedown', { button: 0, ctrlKey: false });
    expect(wrapper.text()).toContain('Media integration');

    const panel = wrapper.get('.fixed');
    const collapse = wrapper.get('button[aria-label="Collapse devtools"]');
    await collapse.trigger('click');
    expect(panel.classes()).toContain('w-[320px]');
    const collapsedHeader = wrapper.get('header');
    const collapsedTitle = wrapper.get('header .font-semibold');
    expect(collapsedHeader.classes()).not.toContain('border-b');
    expect(collapsedTitle.classes()).toContain('whitespace-normal');
    expect(collapsedTitle.classes()).not.toContain('truncate');
    expect(
      wrapper.get('button[aria-label="Expand devtools"]').attributes('aria-label'),
    ).toBe('Expand devtools');
    await wrapper.get('button[aria-label="Expand devtools"]').trigger('click');
    expect(panel.classes()).toContain('w-110');
    expect(collapsedHeader.classes()).toContain('border-b');
    expect(collapsedTitle.classes()).toContain('truncate');
  });

  it('shows each simulator\'s live state inside its tab', async () => {
    const [{ default: App }, { audioState }, { useDevtoolsStore }]
      = await Promise.all([
        import('../src/App.vue'),
        import('../src/audio'),
        import('../src/store'),
      ]);
    const wrapper = mount(App);
    const store = useDevtoolsStore();
    const status = (label: string) => {
      const tab = wrapper
        .findAll('[role="tab"]')
        .find(candidate => candidate.text().includes(label));
      return tab?.get('[data-tab-status]').text();
    };

    expect(status('Properties')).toBe('No listener');
    expect(status('Runtime')).toBe('Running');
    expect(status('Audio')).toBe('Off');
    expect(status('Media')).toBe('Disabled');

    store.listenerCounts.property = true;
    store.general.paused = true;
    audioState.mode = 'stereo';
    store.mediaActive = true;
    await nextTick();

    expect(status('Properties')).toBe('Ready');
    expect(status('Runtime')).toBe('Paused');
    expect(status('Audio')).toBe('Stereo pan');
    expect(status('Media')).toBe('Enabled');
    audioState.mode = 'off';
  });

  it('keeps the panel right edge anchored throughout collapse and expansion', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1200);
    let resizeCallback: ResizeObserverCallback | undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }

        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );

    const { default: App } = await import('../src/App.vue');
    const wrapper = mount(App);
    await nextTick();
    expect(resizeCallback).toBeDefined();

    const panel = wrapper.get<HTMLElement>('.fixed').element;
    let renderedWidth = 440;
    Object.defineProperty(panel, 'offsetWidth', {
      configurable: true,
      get: () => renderedWidth,
    });
    Object.defineProperty(panel, 'offsetHeight', {
      configurable: true,
      get: () => 600,
    });
    const left = () => Number.parseFloat(panel.style.left);
    const initialRightEdge = left() + renderedWidth;
    expect(initialRightEdge).toBe(1188);

    await wrapper.get('button[aria-label="Collapse devtools"]').trigger('click');
    expect(left()).toBe(868);

    renderedWidth = 360;
    resizeCallback?.([], {} as ResizeObserver);
    await nextTick();
    expect(left()).toBe(868);

    renderedWidth = 320;
    resizeCallback?.([], {} as ResizeObserver);
    await nextTick();
    expect(left() + renderedWidth).toBe(initialRightEdge);

    await wrapper.get('button[aria-label="Expand devtools"]').trigger('click');
    expect(left()).toBe(748);

    renderedWidth = 360;
    resizeCallback?.([], {} as ResizeObserver);
    await nextTick();
    expect(left()).toBe(748);

    renderedWidth = 440;
    resizeCallback?.([], {} as ResizeObserver);
    await nextTick();
    expect(left() + renderedWidth).toBe(initialRightEdge);
  });
});
