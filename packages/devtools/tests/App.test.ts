import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

const savedTabs = new Map<string, string>();
const originalLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('__WE_DEVTOOLS_VERSION__', '1.2.3');
  vi.stubGlobal('__WE_DEVTOOLS_GIT_VERSION__', 'abc1234-dirty');
  setActivePinia(createPinia());
  savedTabs.clear();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => savedTabs.clear(),
      getItem: (key: string) => savedTabs.get(key) ?? null,
      key: (index: number) => [...savedTabs.keys()][index] ?? null,
      get length() { return savedTabs.size; },
      removeItem: (key: string) => savedTabs.delete(key),
      setItem: (key: string, value: string) => savedTabs.set(key, value),
    } satisfies Storage,
  });
  window.__WE_DEVTOOLS_CONFIG__ = {
    title: 'Aether test wallpaper',
    properties: {
      enabled: { type: 'bool', text: 'Enabled', value: true },
    },
    localization: {},
  };
});

afterEach(async () => {
  const { setAudioMode } = await import('../src/audio');
  setAudioMode('off');
  delete window.__WE_DEVTOOLS_CONFIG__;
  if (originalLocalStorage)
    Object.defineProperty(window, 'localStorage', originalLocalStorage);
  else
    Reflect.deleteProperty(window, 'localStorage');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function findTab(wrapper: ReturnType<typeof mount>, label: string) {
  const tab = wrapper
    .findAll<HTMLButtonElement>('[role="tab"]')
    .find(candidate => candidate.text().includes(label));
  if (!tab)
    throw new Error(`Missing ${label} tab`);
  return tab;
}

describe('devtools app shell', () => {
  it('disables controls while disconnected and prevents duplicate popup requests while opening', async () => {
    const { default: App } = await import('../src/App.vue');
    const wrapper = mount(App, {
      props: {
        embedded: true,
        connected: false,
        opening: true,
        placement: 'right',
      },
    });

    expect(wrapper.get('[role="status"]').text()).toContain('Waiting for the wallpaper connection');
    expect(wrapper.get('#we-devtools-content').attributes('inert')).toBeDefined();
    const opening = wrapper.get('button[aria-label="Opening devtools in separate window"]');
    expect(opening.attributes('disabled')).toBeDefined();
    await opening.trigger('click');
    expect(wrapper.emitted('detach')).toBeUndefined();

    await wrapper.setProps({ connected: true, detached: true, opening: false, placement: 'bottom' });
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.get('#we-devtools-content').attributes('inert')).toBeUndefined();
    expect(wrapper.get('[aria-label="Dock devtools bottom"]').attributes('aria-pressed')).toBe('false');
    await wrapper.get('[aria-label="Dock devtools right"]').trigger('click');
    await wrapper.get('[aria-label="Return devtools to wallpaper"]').trigger('click');
    await wrapper.get('[aria-label="Hide devtools"]').trigger('click');
    expect(wrapper.emitted('dock')).toEqual([['right']]);
    expect(wrapper.emitted('detach')).toHaveLength(1);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('emits pointer and keyboard drag phases only from an active embedded header', async () => {
    const { default: App } = await import('../src/App.vue');
    const wrapper = mount(App, { props: { embedded: true, connected: true } });
    const header = wrapper.get('.we-command-bar');

    await header.trigger('pointerdown', { button: 0, pointerId: 4, clientX: 12, clientY: 24 });
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 4, clientX: 20, clientY: 32 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 4, clientX: 28, clientY: 40 }));
    await header.trigger('keydown', { key: 'ArrowLeft' });

    expect(wrapper.emitted('drag')).toEqual([
      ['start', 12, 24],
      ['move', 20, 32],
      ['end', 28, 40],
      ['start', 0, 0],
      ['move', -20, 0],
      ['end', -20, 0],
    ]);

    await wrapper.get('[aria-label="Hide devtools"]').trigger('pointerdown', { button: 0, pointerId: 5, clientX: 1, clientY: 1 });
    await wrapper.setProps({ connected: false });
    await header.trigger('pointerdown', { button: 0, pointerId: 6, clientX: 1, clientY: 1 });
    await wrapper.setProps({ connected: true, detached: true });
    await header.trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('drag')).toHaveLength(6);
  });

  it('renders semantic Nuxt tabs and persists navigation between frontend views', async () => {
    const { default: App } = await import('../src/App.vue');
    const wrapper = mount(App, { props: { embedded: true } });
    await nextTick();

    expect(wrapper.text()).toContain('Wallpaper Engine Devtools');
    expect(wrapper.text()).toContain('Aether test wallpaper');
    const version = wrapper.get('[data-devtools-version]');
    expect(version.text()).toBe('v1.2.3');
    expect(version.attributes('title')).toBe('Devtools 1.2.3 (git abc1234-dirty)');
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(5);
    expect(wrapper.findAll('[data-tab-status]').map(status => status.text())).toEqual([
      'Running',
      'Off',
      'Disabled',
    ]);

    const selected = wrapper.get('[role="tab"][aria-selected="true"]');
    const panel = wrapper.get('[role="tabpanel"]');
    expect(panel.attributes('id')).toBe(selected.attributes('aria-controls'));
    expect(panel.attributes('aria-labelledby')).toBe(selected.attributes('id'));

    const runtime = findTab(wrapper, 'Runtime');
    await runtime.trigger('mousedown', { button: 0, ctrlKey: false });
    await flushPromises();
    expect(wrapper.text()).toContain('Wallpaper runtime');
    expect(savedTabs.get('we-devtools:active-tab:Aether test wallpaper')).toBe('general');

    savedTabs.set('we-devtools:active-tab:Aether test wallpaper', 'performance');
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'we-devtools:active-tab:Aether test wallpaper',
    }));
    await flushPromises();
    expect(wrapper.text()).toContain('Runtime performance');
    expect(findTab(wrapper, 'Performance').attributes('aria-selected')).toBe('true');
  });

  it('shows changing tab states without adding Properties or Performance indicators', async () => {
    const [{ default: App }, { audioState }, { useDevtoolsStore }]
      = await Promise.all([
        import('../src/App.vue'),
        import('../src/audio'),
        import('../src/store'),
      ]);
    const wrapper = mount(App);
    const store = useDevtoolsStore();
    const status = (label: string) => findTab(wrapper, label).get('[data-tab-status]').text();

    expect(findTab(wrapper, 'Properties').find('[data-tab-status]').exists()).toBe(false);
    expect(status('Runtime')).toBe('Running');
    expect(status('Audio')).toBe('Off');
    expect(status('Media')).toBe('Disabled');
    expect(findTab(wrapper, 'Performance').find('[data-tab-status]').exists()).toBe(false);

    store.listenerCounts.property = true;
    store.general.paused = true;
    audioState.mode = 'stereo';
    store.mediaActive = true;
    await nextTick();

    expect(findTab(wrapper, 'Properties').find('[data-tab-status]').exists()).toBe(false);
    expect(status('Runtime')).toBe('Paused');
    expect(status('Audio')).toBe('No listener');
    expect(status('Media')).toBe('Enabled');

    store.listenerCounts.audio = 1;
    await nextTick();
    expect(status('Audio')).toBe('Stereo pan');
    expect(findTab(wrapper, 'Performance').find('[data-tab-status]').exists()).toBe(false);
  });

  it('slides new panels in the direction of the selected tab order', async () => {
    const { default: App } = await import('../src/App.vue');
    const wrapper = mount(App);
    await flushPromises();

    expect(wrapper.get('.we-tabs-root').attributes('data-navigation-direction')).toBeUndefined();
    for (const [label, direction] of [
      ['Runtime', 'forward'],
      ['Audio', 'forward'],
      ['Media', 'forward'],
      ['Performance', 'forward'],
      ['Audio', 'backward'],
      ['Properties', 'backward'],
      ['Media', 'forward'],
      ['Runtime', 'backward'],
    ] as const) {
      const previousContent = wrapper.get('.we-tab-content').element;
      await findTab(wrapper, label).trigger('mousedown', { button: 0, ctrlKey: false });
      await flushPromises();

      expect(wrapper.get('.we-tabs-root').attributes('data-navigation-direction')).toBe(direction);
      const selected = findTab(wrapper, label);
      expect(selected.attributes('aria-selected')).toBe('true');
      const activePanel = wrapper.get('[role="tabpanel"][data-state="active"]');
      expect(activePanel.attributes('id')).toBe(selected.attributes('aria-controls'));
      expect(wrapper.findAll('.we-tab-content')).toHaveLength(1);
      expect(wrapper.get('.we-tab-content').element).not.toBe(previousContent);
      expect(wrapper.element.contains(previousContent)).toBe(false);
    }
    wrapper.unmount();
  });

  it('follows keyboard and synchronized navigation without replaying the selected tab', async () => {
    const { default: App } = await import('../src/App.vue');
    const wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
    try {
      findTab(wrapper, 'Properties').element.focus();
      await findTab(wrapper, 'Properties').trigger('keydown', { key: 'ArrowRight' });
      await flushPromises();
      expect(document.activeElement).toBe(findTab(wrapper, 'Runtime').element);
      expect(findTab(wrapper, 'Runtime').attributes('aria-selected')).toBe('true');
      expect(wrapper.get('.we-tabs-root').attributes('data-navigation-direction')).toBe('forward');

      await findTab(wrapper, 'Runtime').trigger('keydown', { key: 'ArrowLeft' });
      await flushPromises();
      expect(document.activeElement).toBe(findTab(wrapper, 'Properties').element);
      expect(wrapper.get('.we-tabs-root').attributes('data-navigation-direction')).toBe('backward');

      savedTabs.set('we-devtools:active-tab:Aether test wallpaper', 'media');
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'we-devtools:active-tab:Aether test wallpaper',
      }));
      await flushPromises();
      expect(findTab(wrapper, 'Media').attributes('aria-selected')).toBe('true');
      expect(wrapper.get('.we-tabs-root').attributes('data-navigation-direction')).toBe('forward');

      const currentContent = wrapper.get('.we-tab-content').element;
      await findTab(wrapper, 'Media').trigger('mousedown', { button: 0, ctrlKey: false });
      await flushPromises();
      expect(wrapper.get('.we-tab-content').element).toBe(currentContent);
      expect(wrapper.findAll('.we-tab-content')).toHaveLength(1);
    }
    finally {
      wrapper.unmount();
    }
  });

  it('keeps only the final panel after rapid tab changes', async () => {
    const { default: App } = await import('../src/App.vue');
    const wrapper = mount(App);
    await flushPromises();

    // Dispatch before the next render: direction follows the panel actually left.
    const select = (label: string) => findTab(wrapper, label).element.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, button: 0, ctrlKey: false }),
    );
    select('Performance');
    select('Media');
    select('Runtime');
    await flushPromises();
    expect(findTab(wrapper, 'Runtime').attributes('aria-selected')).toBe('true');
    expect(wrapper.get('.we-tabs-root').attributes('data-navigation-direction')).toBe('forward');
    expect(wrapper.findAll('.we-tab-content')).toHaveLength(1);
    expect(wrapper.get('.we-tab-content').text()).toContain('Wallpaper runtime');
    expect(savedTabs.get('we-devtools:active-tab:Aether test wallpaper')).toBe('general');

    select('Properties');
    await nextTick();
    select('Audio');
    await flushPromises();
    expect(findTab(wrapper, 'Audio').attributes('aria-selected')).toBe('true');
    expect(wrapper.findAll('.we-tab-content')).toHaveLength(1);
    expect(wrapper.get('.we-tabs-root').attributes('data-navigation-direction')).toBe('forward');
    expect(wrapper.text()).not.toContain('Wallpaper runtime');
    wrapper.unmount();
  });
});
