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
    .findAll('[role="tab"]')
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
      'No listener',
      'Running',
      'Off',
      'Disabled',
      'Host metrics',
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

  it('shows each simulator live state in its tab status', async () => {
    const [{ default: App }, { audioState }, { useDevtoolsStore }]
      = await Promise.all([
        import('../src/App.vue'),
        import('../src/audio'),
        import('../src/store'),
      ]);
    const wrapper = mount(App);
    const store = useDevtoolsStore();
    const status = (label: string) => findTab(wrapper, label).get('[data-tab-status]').text();

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
    expect(status('Audio')).toBe('No listener');
    expect(status('Media')).toBe('Enabled');

    store.listenerCounts.audio = 1;
    await nextTick();
    expect(status('Audio')).toBe('Stereo pan');
  });
});
