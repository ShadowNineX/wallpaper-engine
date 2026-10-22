import type { WallpaperPropertyDefinition } from '../../wallpaper-engine/src/types/project';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { builtInValues } from './fixtures/properties';

const {
  releaseDevDirectoryMock,
  releaseDevFileMock,
} = vi.hoisted(() => ({
  releaseDevDirectoryMock: vi.fn(),
  releaseDevFileMock: vi.fn(),
}));

vi.mock('../src/dev-files', () => ({
  releaseDevDirectory: releaseDevDirectoryMock,
  releaseDevFile: releaseDevFileMock,
}));
const properties = {
  appearance: { type: 'group', text: 'Appearance', value: '' },
  separator: { type: 'divider' },
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

let messages: string[] = [];
let releaseNotifications: (() => void) | undefined;

beforeEach(async () => {
  vi.resetModules();
  releaseDevDirectoryMock.mockReset();
  releaseDevFileMock.mockReset();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = {
    properties,
    localization: { 'en-us': { ui_bars: 'Spectrum bars' } },
  };
  messages = [];
  const { setNotificationHandler } = await import('../src/notifications');
  releaseNotifications = setNotificationHandler(message => messages.push(message));
});

afterEach(() => {
  releaseNotifications?.();
  releaseNotifications = undefined;
  delete window.__WE_DEVTOOLS_CONFIG__;
});

// These modules snapshot plugin config at evaluation time, so each test imports
// a fresh instance after installing its own injected configuration.
async function loadStore() {
  return import('../src/store');
}

describe('devtools property state', () => {
  it('retains reserved property names through initial, partial, file, directory, and reset flows', async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    window.__WE_DEVTOOLS_CONFIG__ = {
      properties: Object.fromEntries([
        ['__proto__', { type: 'slider', value: 2, min: 0, max: 5, step: 1, text: 'Prototype' }],
        ['constructor', { type: 'file', value: 'C:/cover.png', text: 'Cover' }],
        ['toString', { type: 'directory', value: 'C:/gallery', mode: 'ondemand', text: 'Gallery' }],
      ]),
      localization: {},
    };
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };
    const store = useDevtoolsStore();

    for (const key of ['__proto__', 'constructor', 'toString']) {
      expect(Object.hasOwn(store.currentValues, key)).toBe(true);
    }
    expect(Object.hasOwn(store.propertyDisplayPaths, 'constructor')).toBe(true);
    expect(Object.hasOwn(store.propertyDisplayPaths, 'toString')).toBe(true);

    store.deliverAllProperties(false);
    const initialPayload = (applyUserProperties.mock.calls.at(-1)?.[0] ?? {}) as Record<string, unknown>;
    const protoKey = '__proto__';
    expect(Object.hasOwn(initialPayload, '__proto__')).toBe(true);
    expect(initialPayload).toMatchObject({
      constructor: { value: 'C:/cover.png' },
      toString: { value: 'C:/gallery' },
    });
    expect(initialPayload[protoKey]).toEqual({ value: 2 });
    store.deliverProperty('__proto__');
    expect(Object.hasOwn(applyUserProperties.mock.calls.at(-1)?.[0] ?? {}, '__proto__')).toBe(true);

    store.setFileSelection('constructor', {
      id: 'cover',
      name: 'cover.png',
      path: 'cover.png',
      relativePath: 'cover.png',
      url: 'blob:cover',
      size: 1,
      mtimeMs: 1,
    });
    store.setDirectorySelection('toString', {
      id: 'gallery',
      path: 'Gallery',
      files: [],
    });
    expect(Object.hasOwn(store.directoryFiles, 'toString')).toBe(true);
    expect(Object.hasOwn(store.directorySelections, 'toString')).toBe(true);

    store.resetPropertiesToDefaults();

    expect(store.currentValues[protoKey]).toEqual({ value: 2 });
    expect(store.currentValues).toMatchObject({
      constructor: { value: 'C:/cover.png' },
      toString: { value: 'C:/gallery' },
    });
    expect(Object.hasOwn(store.propertyDisplayPaths, 'constructor')).toBe(true);
    expect(Object.hasOwn(store.propertyDisplayPaths, 'toString')).toBe(true);
  });

  it('continues startup delivery and reports callback failures without throwing', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const error = new Error('broken wallpaper');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const applyGeneralProperties = vi.fn(() => {
      throw error;
    });
    const setPaused = vi.fn();
    listenerFns.property = {
      applyUserProperties: () => { throw error; },
      applyGeneralProperties,
      setPaused,
    };
    const store = useDevtoolsStore();

    expect(() => store.deliverAllProperties()).not.toThrow();
    expect(applyGeneralProperties).toHaveBeenCalledWith({ fps: 60 });
    expect(setPaused).toHaveBeenCalledWith(false);
    expect(log).toHaveBeenCalledTimes(2);
    expect(messages).toContain('Some wallpaper callbacks failed. Check the browser console for details.');
    expect(() => store.deliverProperty('speed')).not.toThrow();
    expect(messages).toContain('Wallpaper callback failed. Check the browser console for details.');
  });

  it('creates host-shaped runtime values for every supported property', async () => {
    const { useDevtoolsStore } = await loadStore();
    const store = useDevtoolsStore();

    expect(store.currentValues).not.toHaveProperty('appearance');
    expect(store.currentValues).not.toHaveProperty('separator');
    expect(store.currentValues).toEqual({
      audioprocessing: { value: true },
      schemecolor: { value: '0.5 0.5 0.5' },
      alignmentfliph: { value: false },
      wec_e: { value: false },
      wec_brs: { value: 50 },
      wec_con: { value: 50 },
      wec_sa: { value: 50 },
      wec_hue: { value: 50 },
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
      audioprocessing: { value: true },
      schemecolor: { value: '0.5 0.5 0.5' },
      alignmentfliph: { value: false },
      wec_e: { value: false },
      wec_brs: { value: 50 },
      wec_con: { value: 50 },
      wec_sa: { value: 50 },
      wec_hue: { value: 50 },
      color: { value: '0.1 0.2 0.3' },
      random: { value: 'C:/random' },
    });
    expect(applyGeneralProperties).toHaveBeenCalledWith({ fps: 30 });
    expect(setPaused).toHaveBeenCalledWith(true);
    expect(messages).toContain('Startup state replayed.');
  });

  it('delivers and resets built-in changes through the normal property flow', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };
    const store = useDevtoolsStore();
    store.currentValues.audioprocessing = { value: false };
    store.deliverProperty('audioprocessing');
    expect(applyUserProperties).toHaveBeenLastCalledWith({ audioprocessing: { value: false } });
    store.currentValues.wec_brs = { value: 75 };
    store.deliverProperty('wec_brs');
    expect(applyUserProperties).toHaveBeenLastCalledWith({ wec_brs: { value: 75 } });
    store.resetPropertiesToDefaults();
    expect(applyUserProperties).toHaveBeenLastCalledWith(expect.objectContaining({
      audioprocessing: { value: true },
      wec_brs: { value: 50 },
    }));
  });

  it('never delivers divider values during replay changes or reset', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };
    const store = useDevtoolsStore();
    store.deliverAllProperties(false);
    expect(applyUserProperties).toHaveBeenCalledOnce();
    expect(applyUserProperties.mock.calls[0]?.[0]).not.toHaveProperty('separator');
    applyUserProperties.mockClear();
    store.deliverProperty('separator');
    expect(applyUserProperties).not.toHaveBeenCalled();
    store.resetPropertiesToDefaults();
    expect(applyUserProperties).toHaveBeenCalledOnce();
    expect(applyUserProperties.mock.calls[0]?.[0]).not.toHaveProperty('separator');
    expect(store.currentValues).not.toHaveProperty('separator');
  });

  it('does not deliver audio recording when audio support is disabled', async () => {
    window.__WE_DEVTOOLS_CONFIG__!.supportsAudioProcessing = false;
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };
    const store = useDevtoolsStore();
    store.deliverAllProperties(false);
    store.deliverProperty('audioprocessing');
    expect(applyUserProperties).toHaveBeenCalledOnce();
    expect(applyUserProperties.mock.calls[0]?.[0]).not.toHaveProperty('audioprocessing');
    expect(applyUserProperties.mock.calls[0]?.[0]).toHaveProperty('schemecolor', { value: '0.5 0.5 0.5' });
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

    expect(messages).toContain('No property listener registered.');
  });

  it('does not share mutable property values between Pinia instances', async () => {
    const { useDevtoolsStore } = await loadStore();
    const first = useDevtoolsStore();
    first.currentValues.speed = { value: 5 };

    setActivePinia(createPinia());
    const second = useDevtoolsStore();

    expect(second.currentValues.speed).toEqual({ value: 2 });
  });

  it('restores property defaults without resetting runtime state', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const applyUserProperties = vi.fn();
    const applyGeneralProperties = vi.fn();
    const setPaused = vi.fn();
    const removed = vi.fn();
    listenerFns.property = {
      applyUserProperties,
      applyGeneralProperties,
      setPaused,
      userDirectoryFilesRemoved: removed,
    };
    const store = useDevtoolsStore();
    store.currentValues.speed = { value: 5 };
    store.currentValues.mode = { value: 'custom', text: 'Custom' };
    store.setFileSelection('file', {
      id: 'file-1',
      name: 'picked.png',
      path: 'picked.png',
      relativePath: 'picked.png',
      url: 'blob:http://localhost/picked',
      size: 10,
      mtimeMs: 20,
    });
    store.setDirectorySelection('random', {
      id: 'random-directory',
      path: 'Random',
      files: [],
    });
    store.setDirectorySelection('gallery', {
      id: 'gallery-directory',
      path: 'Gallery',
      files: [
        {
          id: 'gallery-file',
          name: 'gallery.png',
          path: 'Gallery/gallery.png',
          relativePath: 'gallery.png',
          url: 'blob:http://localhost/gallery',
          size: 30,
          mtimeMs: 40,
        },
      ],
    });
    store.general.fps = 30;
    store.general.paused = true;
    applyUserProperties.mockClear();
    applyGeneralProperties.mockClear();
    setPaused.mockClear();
    removed.mockClear();

    store.resetPropertiesToDefaults();

    expect(store.currentValues).toEqual({
      audioprocessing: { value: true },
      schemecolor: { value: '0.5 0.5 0.5' },
      alignmentfliph: { value: false },
      wec_e: { value: false },
      wec_brs: { value: 50 },
      wec_con: { value: 50 },
      wec_sa: { value: 50 },
      wec_hue: { value: 50 },
      color: { value: '0.1 0.2 0.3' },
      speed: { value: 2 },
      enabled: { value: true },
      mode: { value: 'bars', text: 'Spectrum bars' },
      label: { value: 'hello' },
      file: { value: 'C:/image.png' },
      random: { value: 'C:/random' },
      gallery: { value: 'C:/gallery' },
    });
    expect(store.propertyDisplayPaths).toEqual({
      file: 'C:/image.png',
      random: 'C:/random',
      gallery: 'C:/gallery',
    });
    expect(store.directoryFiles).toEqual({});
    expect(store.directorySelections).toEqual({});
    expect(applyUserProperties).toHaveBeenCalledOnce();
    expect(applyUserProperties.mock.calls[0]?.[0]).toEqual({
      ...builtInValues,
      color: { value: '0.1 0.2 0.3' },
      speed: { value: 2 },
      enabled: { value: true },
      mode: { value: 'bars', text: 'Spectrum bars' },
      label: { value: 'hello' },
      file: { value: 'C:/image.png' },
      random: { value: 'C:/random' },
    });
    expect(removed).toHaveBeenCalledWith('gallery', [
      'blob:http://localhost/gallery',
    ]);
    expect(applyGeneralProperties).not.toHaveBeenCalled();
    expect(setPaused).not.toHaveBeenCalled();
    expect(store.general).toEqual({ fps: 30, paused: true });
    expect(releaseDevFileMock).toHaveBeenCalledWith(
      'blob:http://localhost/picked',
    );
    expect(releaseDevDirectoryMock).toHaveBeenCalledWith('random-directory');
    expect(releaseDevDirectoryMock).toHaveBeenCalledWith('gallery-directory');
    expect(messages).toContain('Properties reset to defaults.');
  });
});

describe('devtools media state', () => {
  it('delivers general and plugin actions through the typed host facade', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const applyGeneralProperties = vi.fn();
    const setPaused = vi.fn();
    const onPluginLoaded = vi.fn();
    listenerFns.property = { applyGeneralProperties, setPaused };
    listenerFns.plugin = { onPluginLoaded };
    const store = useDevtoolsStore();
    store.general.fps = 30;

    store.applyFps();
    store.applyPaused(true);
    store.firePluginLoaded('cue');

    expect(applyGeneralProperties).toHaveBeenCalledWith({ fps: 30 });
    expect(setPaused).toHaveBeenCalledWith(true);
    expect(onPluginLoaded).toHaveBeenCalledWith('cue', '0.0.0-dev');
    expect(store.general.paused).toBe(true);
    expect(messages).toContain('FPS limit sent: 30');
    expect(messages).toContain('Wallpaper paused.');
    expect(messages).toContain('iCUE plugin loaded.');
  });

  it('guards inactive media and fans out every typed media action', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const status = vi.fn();
    const properties = vi.fn();
    const thumbnail = vi.fn();
    const playback = vi.fn();
    const timeline = vi.fn();
    listenerFns.mediaStatus.push(status);
    listenerFns.mediaProps.push(properties);
    listenerFns.mediaThumb.push(thumbnail);
    listenerFns.mediaPlayback.push(playback);
    listenerFns.mediaTimeline.push(timeline);
    const store = useDevtoolsStore();

    store.sendMediaProperties();
    expect(messages).toContain('Enable media integration before sending media events.');
    expect(properties).not.toHaveBeenCalled();

    store.setMediaEnabled(true);
    status.mockClear();
    properties.mockClear();
    thumbnail.mockClear();
    playback.mockClear();
    timeline.mockClear();
    store.mediaProps.title = 'Typed action track';
    store.mediaTimeline.position = 45;
    store.sendMediaProperties();
    store.sendMediaPlayback(1);
    store.sendMediaTimeline();
    store.sendMediaArtwork();
    store.setMediaEnabled(false);

    expect(properties).toHaveBeenCalledWith(expect.objectContaining({ title: 'Typed action track' }));
    expect(playback).toHaveBeenCalledWith({ state: 1 });
    expect(timeline).toHaveBeenCalledWith({ position: 45, duration: 180 });
    expect(thumbnail).toHaveBeenCalledWith(expect.objectContaining({ primaryColor: '#202020' }));
    expect(status).toHaveBeenCalledWith({ enabled: false });
    expect(properties).toHaveBeenCalledTimes(1);
    expect(thumbnail).toHaveBeenCalledTimes(1);
    expect(playback).toHaveBeenCalledTimes(1);
    expect(timeline).toHaveBeenCalledTimes(1);
  });

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

    expect(store.deliverAllMedia()).toBe(true);

    expect(status).toHaveBeenCalledWith({ enabled: true });
    expect(props).toHaveBeenCalledWith(expect.objectContaining({ title: 'Changed' }));
    expect(thumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ primaryColor: '#202020' }),
    );
    expect(playback).toHaveBeenCalledWith({ state: 1 });
    expect(timeline).toHaveBeenCalledWith({ position: 45, duration: 180 });
  });

  it('defers media listeners registered during delivery to their queued startup callback', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    const { installGlobals } = await import('../src/globals');
    const removeGlobals = installGlobals();
    try {
      const later = vi.fn();
      listenerFns.mediaProps.push(() => {
        window.wallpaperRegisterMediaPropertiesListener(later);
      });
      const store = useDevtoolsStore();
      store.mediaActive = true;

      store.deliverAllMedia();

      expect(later).not.toHaveBeenCalled();
      await Promise.resolve();
      expect(later).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ title: 'Test Track' }),
      );
    }
    finally {
      removeGlobals();
    }
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

    expect(useDevtoolsStore().deliverAllMedia()).toBe(false);

    expect(second).toHaveBeenCalledWith({ enabled: false });
    expect(consoleError).toHaveBeenCalledWith(
      '[WE Dev] listener threw',
      expect.any(Error),
    );
  });

  it('reports failed manual media sends without skipping later listeners', async () => {
    const { useDevtoolsStore } = await loadStore();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const receivingListener = vi.fn();
    const delivered = useDevtoolsStore().fanout([
      () => { throw new Error('broken wallpaper'); },
      receivingListener,
    ], { title: 'New track' }, 'media properties');

    expect(delivered).toBe(false);
    expect(receivingListener).toHaveBeenCalledWith({ title: 'New track' });
    expect(messages).toContain('Some media properties callbacks failed. Check the browser console for details.');
    expect(messages).not.toContain('Sent media properties.');
  });

  it('continues all media streams after a failed enabled-status callback', async () => {
    const { listenerFns, useDevtoolsStore } = await loadStore();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    listenerFns.mediaStatus.push(() => {
      throw new Error('broken status');
    });
    const propertiesListener = vi.fn();
    const thumbnailListener = vi.fn();
    listenerFns.mediaProps.push(propertiesListener);
    listenerFns.mediaThumb.push(thumbnailListener);
    const store = useDevtoolsStore();
    store.mediaActive = true;

    expect(store.deliverAllMedia()).toBe(false);
    expect(propertiesListener).toHaveBeenCalledWith(expect.objectContaining({ title: 'Test Track' }));
    expect(thumbnailListener).toHaveBeenCalledOnce();
  });
});
