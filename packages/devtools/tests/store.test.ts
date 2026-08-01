import type { WallpaperPropertyDefinition } from '../../wallpaper-engine/src/types/project';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'vue-sonner';

vi.mock('vue-sonner', () => ({ toast: vi.fn() }));

const properties = {
  appearance: { type: 'group', text: 'Appearance', value: '' },
  color: { type: 'color', text: 'Color', value: '0.1 0.2 0.3' },
  speed: { type: 'slider', text: 'Speed', value: 2, min: 0, max: 5 },
  enabled: { type: 'bool', text: 'Enabled', value: true },
  mode: {
    type: 'combo',
    text: 'Mode',
    value: 'bars',
    options: [{ label: 'ui_bars', value: 'bars' }],
  },
  label: { type: 'textinput', text: 'Label', value: 'hello' },
  file: { type: 'file', text: 'File', value: 'C:/image.png' },
  random: {
    type: 'directory',
    text: 'Random',
    value: 'C:/random',
    mode: 'ondemand',
  },
  gallery: {
    type: 'directory',
    text: 'Gallery',
    value: 'C:/gallery',
    mode: 'fetchall',
  },
} satisfies Record<string, WallpaperPropertyDefinition>;

beforeEach(() => {
  vi.resetModules();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = {
    properties,
    localization: { 'en-us': { ui_bars: 'Spectrum bars' } },
  };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
});

// These modules snapshot plugin config at evaluation time, so each test imports
// a fresh instance after installing its own injected configuration.
async function loadStore() {
  return import('../src/store');
}

describe('devtools property state', () => {
  it('creates host-shaped runtime values for every supported property', async () => {
    const { useDevtoolsStore } = await loadStore();
    const store = useDevtoolsStore();

    expect(store.currentValues).not.toHaveProperty('appearance');
    expect(store.currentValues).toEqual({
      color: { value: '0.1 0.2 0.3' },
      speed: { value: 2 },
      enabled: { value: true },
      mode: { value: 'bars', text: 'Spectrum bars' },
      label: { value: 'hello' },
      file: { value: 'C:/image.png' },
      random: { value: 'C:/random' },
      gallery: { value: 'C:/gallery' },
    });
  });

  it('delivers initial properties, general FPS, and pause state together', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const applyUserProperties = vi.fn();
    const applyGeneralProperties = vi.fn();
    const setPaused = vi.fn();
    listenerFns.property = {
      applyUserProperties,
      applyGeneralProperties,
      setPaused,
    };
    const store = useDevtoolsStore();
    store.general.fps = 30;
    store.general.paused = true;

    store.deliverAllProperties();

    expect(applyUserProperties).toHaveBeenCalledOnce();
    expect(applyUserProperties.mock.calls[0]?.[0]).not.toHaveProperty(
      'appearance',
    );
    expect(applyUserProperties.mock.calls[0]?.[0]).not.toHaveProperty('gallery');
    expect(applyUserProperties.mock.calls[0]?.[0]).toMatchObject({
      color: { value: '0.1 0.2 0.3' },
      random: { value: 'C:/random' },
    });
    expect(applyGeneralProperties).toHaveBeenCalledWith({ fps: 30 });
    expect(setPaused).toHaveBeenCalledWith(true);
    expect(toast).toHaveBeenCalledWith('Startup state replayed.');
  });

  it('replays fetch-all directory files through their dedicated callback', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const applyUserProperties = vi.fn();
    const addedOrChanged = vi.fn();
    listenerFns.property = {
      applyUserProperties,
      userDirectoryFilesAddedOrChanged: addedOrChanged,
    };
    const store = useDevtoolsStore();
    store.setDirectorySelection('gallery', {
      id: 'directory-1',
      path: 'Gallery',
      files: [
        {
          id: 'file-1',
          name: 'image.png',
          path: 'Gallery/image.png',
          relativePath: 'image.png',
          url: 'blob:http://localhost/file-1',
          size: 10,
          mtimeMs: 20,
        },
      ],
    });
    applyUserProperties.mockClear();
    addedOrChanged.mockClear();

    store.deliverAllProperties(false);

    expect(applyUserProperties.mock.calls[0]?.[0]).not.toHaveProperty('gallery');
    expect(addedOrChanged).toHaveBeenCalledWith('gallery', [
      'blob:http://localhost/file-1',
    ]);
  });

  it('delivers one changed property and ignores fetch-all directory properties', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };
    const store = useDevtoolsStore();

    store.currentValues.speed = { value: 4 };
    store.deliverProperty('speed');
    store.deliverProperty('gallery');
    store.deliverProperty('missing');

    expect(applyUserProperties).toHaveBeenCalledOnce();
    expect(applyUserProperties).toHaveBeenCalledWith({ speed: { value: 4 } });
  });

  it('delivers detached property snapshots', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };
    const store = useDevtoolsStore();
    store.currentValues.speed = { value: 4 };

    store.deliverProperty('speed');
    const changed = applyUserProperties.mock.calls[0]?.[0];
    store.currentValues.speed.value = 5;

    expect(changed).toEqual({ speed: { value: 4 } });
    changed!.speed!.value = 9;
    expect(store.currentValues.speed).toEqual({ value: 5 });

    applyUserProperties.mockClear();
    store.deliverAllProperties(false);
    const replay = applyUserProperties.mock.calls[0]?.[0];
    store.currentValues.color!.value = '1 1 1';

    expect(replay?.color).toEqual({ value: '0.1 0.2 0.3' });
  });

  it('reports replay attempts when no property listener is registered', async () => {
    const { useDevtoolsStore } = await loadStore();

    useDevtoolsStore().deliverAllProperties();

    expect(toast).toHaveBeenCalledWith('No property listener registered.');
  });

  it('does not share mutable property values between Pinia instances', async () => {
    const { useDevtoolsStore } = await loadStore();
    const first = useDevtoolsStore();
    first.currentValues.speed = { value: 5 };

    setActivePinia(createPinia());
    const second = useDevtoolsStore();

    expect(second.currentValues.speed).toEqual({ value: 2 });
  });
});

describe('devtools media state', () => {
  it('only delivers media status while integration is disabled', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const status = vi.fn();
    const propertiesListener = vi.fn();
    listenerFns.mediaStatus.push(status);
    listenerFns.mediaProps.push(propertiesListener);

    useDevtoolsStore().deliverAllMedia();

    expect(status).toHaveBeenCalledWith({ enabled: false });
    expect(propertiesListener).not.toHaveBeenCalled();
  });

  it('fans out a snapshot of every active media event', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const status = vi.fn();
    const props = vi.fn();
    const thumbnail = vi.fn();
    const playback = vi.fn();
    const timeline = vi.fn();
    listenerFns.mediaStatus.push(status);
    listenerFns.mediaProps.push(props);
    listenerFns.mediaThumb.push(thumbnail);
    listenerFns.mediaPlayback.push(playback);
    listenerFns.mediaTimeline.push(timeline);
    const store = useDevtoolsStore();
    store.mediaActive = true;
    store.lastPlaybackState = 1;
    store.mediaProps.title = 'Changed';
    store.mediaTimeline.position = 45;

    store.deliverAllMedia();

    expect(status).toHaveBeenCalledWith({ enabled: true });
    expect(props).toHaveBeenCalledWith(expect.objectContaining({ title: 'Changed' }));
    expect(thumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ primaryColor: '#202020' }),
    );
    expect(playback).toHaveBeenCalledWith({ state: 1 });
    expect(timeline).toHaveBeenCalledWith({ position: 45, duration: 180 });
  });

  it('isolates listener failures so remaining callbacks still run', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const second = vi.fn();
    listenerFns.mediaStatus.push(
      () => {
        throw new Error('listener failed');
      },
      second,
    );

    useDevtoolsStore().deliverAllMedia();

    expect(second).toHaveBeenCalledWith({ enabled: false });
    expect(consoleError).toHaveBeenCalledWith(
      '[WE Dev] listener threw',
      expect.any(Error),
    );
  });
});
