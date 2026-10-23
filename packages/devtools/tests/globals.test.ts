import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = {
    properties: {
      speed: { type: 'slider', text: 'Speed', value: 2, min: 0, max: 5 },
      gallery: {
        type: 'directory',
        text: 'Gallery',
        value: 'C:/gallery',
        mode: 'fetchall',
      },
    },
    localization: {},
  };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
});

// Global stubs close over the evaluation-time store module, so reset-importing
// is intentional test coverage of listener registration and initial delivery.
async function installFreshGlobals() {
  const [{ installGlobals }, storeModule] = await Promise.all([
    import('../src/globals'),
    import('../src/store'),
  ]);
  installGlobals();
  return storeModule;
}

const defaultProperties = {
  audioprocessing: { value: true },
  schemecolor: { value: '0.5 0.5 0.5' },
  alignmentfliph: { value: false },
  wec_e: { value: false },
  wec_brs: { value: 50 },
  wec_con: { value: 50 },
  wec_sa: { value: 50 },
  wec_hue: { value: 50 },
};

describe('wallpaper Engine host globals', () => {
  it('captures a property listener and replays documented initial state', async () => {
    const { useDevtoolsStore } = await installFreshGlobals();
    const applyUserProperties = vi.fn();
    const applyGeneralProperties = vi.fn();
    const setPaused = vi.fn();

    window.wallpaperPropertyListener = {
      applyUserProperties,
      applyGeneralProperties,
      setPaused,
    };
    await Promise.resolve();

    const store = useDevtoolsStore();
    expect(store.listenerCounts.property).toBe(true);
    expect(applyUserProperties).toHaveBeenCalledWith({ ...defaultProperties, speed: { value: 2 } });
    expect(applyGeneralProperties).toHaveBeenCalledWith({ fps: 60 });
    expect(setPaused).toHaveBeenCalledWith(false);
  });

  it('tracks property and plugin listener replacement', async () => {
    const { listenerFns, useDevtoolsStore } = await installFreshGlobals();
    const propertyListener = { applyUserProperties: vi.fn() };
    const pluginListener = { onPluginLoaded: vi.fn() };

    window.wallpaperPropertyListener = propertyListener;
    window.wallpaperPluginListener = pluginListener;
    expect(window.wallpaperPropertyListener).toBe(propertyListener);
    expect(window.wallpaperPluginListener).toBe(pluginListener);
    expect(listenerFns.property).toBe(propertyListener);
    expect(listenerFns.plugin).toBe(pluginListener);
    expect(useDevtoolsStore().listenerCounts).toMatchObject({
      property: true,
      plugin: true,
    });

    window.wallpaperPropertyListener = undefined;
    window.wallpaperPluginListener = undefined;
    expect(useDevtoolsStore().listenerCounts).toMatchObject({
      property: false,
      plugin: false,
    });
  });

  it('registers every audio and media listener and reports counts', async () => {
    const { useDevtoolsStore } = await installFreshGlobals();
    const audio = vi.fn();
    const status = vi.fn();
    const properties = vi.fn();
    const thumbnail = vi.fn();
    const playback = vi.fn();
    const timeline = vi.fn();

    window.wallpaperRegisterAudioListener(audio);
    window.wallpaperRegisterMediaStatusListener(status);
    window.wallpaperRegisterMediaPropertiesListener(properties);
    window.wallpaperRegisterMediaThumbnailListener(thumbnail);
    window.wallpaperRegisterMediaPlaybackListener(playback);
    window.wallpaperRegisterMediaTimelineListener(timeline);
    await Promise.resolve();

    expect(useDevtoolsStore().listenerCounts).toMatchObject({
      audio: 1,
      mediaStatus: 1,
      mediaProps: 1,
      mediaThumb: 1,
      mediaPlayback: 1,
      mediaTimeline: 1,
    });
    expect(status).toHaveBeenCalledWith({ enabled: false });
    expect(properties).not.toHaveBeenCalled();
    expect(thumbnail).not.toHaveBeenCalled();
    expect(playback).not.toHaveBeenCalled();
    expect(timeline).not.toHaveBeenCalled();
  });

  it.each([
    ['audio', 'audio', (callback: () => void) => window.wallpaperRegisterAudioListener(callback)],
    ['media status', 'mediaStatus', (callback: () => void) => window.wallpaperRegisterMediaStatusListener(callback)],
    ['media properties', 'mediaProps', (callback: () => void) => window.wallpaperRegisterMediaPropertiesListener(callback)],
    ['media thumbnail', 'mediaThumb', (callback: () => void) => window.wallpaperRegisterMediaThumbnailListener(callback)],
    ['media playback', 'mediaPlayback', (callback: () => void) => window.wallpaperRegisterMediaPlaybackListener(callback)],
    ['media timeline', 'mediaTimeline', (callback: () => void) => window.wallpaperRegisterMediaTimelineListener(callback)],
  ] as const)('replaces a prior %s registration before initial and later delivery', async (_name, countKey, register) => {
    const { listenerFns, useDevtoolsStore } = await installFreshGlobals();
    const store = useDevtoolsStore();
    store.mediaActive = true;
    const first = vi.fn();
    const latest = vi.fn();

    register(first);
    register(latest);
    await Promise.resolve();

    expect(first).not.toHaveBeenCalled();
    expect(store.listenerCounts[countKey]).toBe(1);
    if (countKey === 'audio') {
      expect(latest).not.toHaveBeenCalled();
      listenerFns.audio[0]?.([0]);
    }
    else {
      expect(latest).toHaveBeenCalledOnce();
      latest.mockClear();
      store.deliverAllMedia();
    }

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it.each([
    ['media status', (callback: () => void) => window.wallpaperRegisterMediaStatusListener(callback)],
    ['media properties', (callback: () => void) => window.wallpaperRegisterMediaPropertiesListener(callback)],
    ['media thumbnail', (callback: () => void) => window.wallpaperRegisterMediaThumbnailListener(callback)],
    ['media playback', (callback: () => void) => window.wallpaperRegisterMediaPlaybackListener(callback)],
    ['media timeline', (callback: () => void) => window.wallpaperRegisterMediaTimelineListener(callback)],
  ] as const)('replaces retained %s callbacks during immediate reinstallation', async (_name, register) => {
    const { useDevtoolsStore } = await installFreshGlobals();
    useDevtoolsStore().mediaActive = true;
    const retained = vi.fn();
    const latest = vi.fn();

    register(retained);
    await Promise.resolve();
    retained.mockClear();
    const { installGlobals } = await import('../src/globals');
    installGlobals();
    register(latest);
    await Promise.resolve();

    expect(retained).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it('replays startup state once to the latest synchronous registration', async () => {
    await installFreshGlobals();
    const first = { applyUserProperties: vi.fn() };
    const latest = {
      applyUserProperties: vi.fn(),
      applyGeneralProperties: vi.fn(),
      setPaused: vi.fn(),
    };

    window.wallpaperPropertyListener = first;
    window.wallpaperPropertyListener = latest;
    await Promise.resolve();

    expect(first.applyUserProperties).not.toHaveBeenCalled();
    expect(latest.applyUserProperties).toHaveBeenCalledExactlyOnceWith({ ...defaultProperties, speed: { value: 2 } });
    expect(latest.applyGeneralProperties).toHaveBeenCalledExactlyOnceWith({ fps: 60 });
    expect(latest.setPaused).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('cancels pending startup delivery when a property listener is cleared', async () => {
    const { useDevtoolsStore } = await installFreshGlobals();
    const listener = { applyUserProperties: vi.fn() };
    window.wallpaperPropertyListener = listener;
    window.wallpaperPropertyListener = undefined;
    await Promise.resolve();

    expect(listener.applyUserProperties).not.toHaveBeenCalled();
    expect(useDevtoolsStore().listenerCounts.property).toBe(false);
  });

  it('coalesces repeated assignments of the same property listener', async () => {
    await installFreshGlobals();
    const listener = { applyUserProperties: vi.fn() };
    window.wallpaperPropertyListener = listener;
    window.wallpaperPropertyListener = undefined;
    window.wallpaperPropertyListener = listener;
    await Promise.resolve();
    expect(listener.applyUserProperties).toHaveBeenCalledTimes(1);

    window.wallpaperPropertyListener = listener;
    await Promise.resolve();
    expect(listener.applyUserProperties).toHaveBeenCalledTimes(2);
  });

  it('keeps callbacks bound to the simulator Pinia when the wallpaper activates another', async () => {
    const { useDevtoolsStore } = await installFreshGlobals();
    const simulator = useDevtoolsStore();
    simulator.currentValues.speed = { value: 4 };
    const wallpaperPinia = createPinia();
    setActivePinia(wallpaperPinia);
    const applyUserProperties = vi.fn();
    window.wallpaperPropertyListener = { applyUserProperties };
    window.wallpaperRegisterAudioListener(vi.fn());
    await Promise.resolve();

    expect(simulator.listenerCounts).toMatchObject({ property: true, audio: 1 });
    expect(applyUserProperties).toHaveBeenCalledExactlyOnceWith({ ...defaultProperties, speed: { value: 4 } });
    expect(useDevtoolsStore(wallpaperPinia).listenerCounts).toMatchObject({ property: false, audio: 0 });
  });

  it('keeps startup and reinstalled property and media callbacks bound to the wallpaper Pinia', async () => {
    const simulatorPinia = createPinia();
    setActivePinia(simulatorPinia);
    const [{ installGlobals }, { useDevtoolsStore }] = await Promise.all([
      import('../src/globals'),
      import('../src/store'),
    ]);
    const removeFirst = installGlobals(simulatorPinia);
    const store = useDevtoolsStore(simulatorPinia);
    store.mediaActive = true;
    const wallpaperPinia = createPinia();
    const seenPinia = vi.fn(() => getActivePinia() === wallpaperPinia);
    setActivePinia(wallpaperPinia);
    window.wallpaperPropertyListener = {
      applyUserProperties: seenPinia,
      applyGeneralProperties: seenPinia,
      setPaused: seenPinia,
    };
    window.wallpaperRegisterMediaPropertiesListener(seenPinia);
    await Promise.resolve();

    expect(seenPinia).toHaveBeenCalledTimes(4);
    expect(seenPinia).toHaveReturnedWith(true);

    setActivePinia(wallpaperPinia);
    const removeLatest = installGlobals(simulatorPinia);
    await Promise.resolve();

    expect(seenPinia).toHaveBeenCalledTimes(8);
    expect(seenPinia).toHaveReturnedWith(true);
    expect(getActivePinia()).toBe(wallpaperPinia);
    removeLatest();
    removeFirst();
  });

  it('coalesces pending property delivery across global reinstallation', async () => {
    await installFreshGlobals();
    const { installGlobals } = await import('../src/globals');
    const first = { applyUserProperties: vi.fn() };
    const latest = { applyUserProperties: vi.fn() };
    window.wallpaperPropertyListener = first;
    installGlobals();
    window.wallpaperPropertyListener = latest;
    await Promise.resolve();

    expect(first.applyUserProperties).not.toHaveBeenCalled();
    expect(latest.applyUserProperties).toHaveBeenCalledExactlyOnceWith({ ...defaultProperties, speed: { value: 2 } });
  });

  it('restores original globals after multiple installations are cleaned up', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'wallpaperRegisterAudioListener');
    const { installGlobals } = await import('../src/globals');
    const removeFirst = installGlobals();
    const removeLatest = installGlobals();
    removeFirst();
    const listener = vi.fn();
    window.wallpaperPropertyListener = { applyUserProperties: listener };
    await Promise.resolve();
    expect(listener).toHaveBeenCalledExactlyOnceWith({ ...defaultProperties, speed: { value: 2 } });

    removeLatest();
    removeFirst();
    expect(Object.getOwnPropertyDescriptor(window, 'wallpaperRegisterAudioListener')).toEqual(original);
  });

  it('rolls back partial installation when a host global is read-only', async () => {
    const property = Object.getOwnPropertyDescriptor(window, 'wallpaperPropertyListener');
    const audio = Object.getOwnPropertyDescriptor(window, 'wallpaperRegisterAudioListener');
    const status = Object.getOwnPropertyDescriptor(window, 'wallpaperRegisterMediaStatusListener');
    Object.defineProperty(window, 'wallpaperRegisterMediaStatusListener', {
      configurable: true,
      writable: false,
      value: vi.fn(),
    });
    try {
      const { installGlobals } = await import('../src/globals');
      expect(() => installGlobals()).toThrow(TypeError);
      expect(Object.getOwnPropertyDescriptor(window, 'wallpaperPropertyListener')).toEqual(property);
      expect(Object.getOwnPropertyDescriptor(window, 'wallpaperRegisterAudioListener')).toEqual(audio);
    }
    finally {
      if (status)
        Object.defineProperty(window, 'wallpaperRegisterMediaStatusListener', status);
      else
        Reflect.deleteProperty(window, 'wallpaperRegisterMediaStatusListener');
    }
  });

  it('preserves wallpaper replacements made between global installations', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'wallpaperRegisterAudioListener');
    const { installGlobals } = await import('../src/globals');
    const removeFirst = installGlobals();
    const wallpaperRegister = vi.fn();
    window.wallpaperRegisterAudioListener = wallpaperRegister;
    const removeLatest = installGlobals();
    try {
      removeFirst();
      removeLatest();
      expect(window.wallpaperRegisterAudioListener).toBe(wallpaperRegister);
    }
    finally {
      removeLatest();
      if (original)
        Object.defineProperty(window, 'wallpaperRegisterAudioListener', original);
      else
        Reflect.deleteProperty(window, 'wallpaperRegisterAudioListener');
    }
  });

  it('cancels queued media snapshots when integration is disabled before delivery', async () => {
    const { useDevtoolsStore } = await installFreshGlobals();
    const store = useDevtoolsStore();
    store.mediaActive = true;
    const callbacks = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    window.wallpaperRegisterMediaPropertiesListener(callbacks[0]!);
    window.wallpaperRegisterMediaThumbnailListener(callbacks[1]!);
    window.wallpaperRegisterMediaPlaybackListener(callbacks[2]!);
    window.wallpaperRegisterMediaTimelineListener(callbacks[3]!);
    store.mediaActive = false;
    await Promise.resolve();

    for (const callback of callbacks)
      expect(callback).not.toHaveBeenCalled();
  });

  it.each([false, true])('replays retained media startup snapshots once after reinstallation when active is %s', async (active) => {
    const { useDevtoolsStore } = await installFreshGlobals();
    const { installGlobals } = await import('../src/globals');
    const store = useDevtoolsStore();
    store.mediaActive = active;
    store.mediaProps.title = 'Retained track';
    store.lastPlaybackState = 1;
    store.mediaTimeline.position = 42;
    const status = vi.fn();
    const properties = vi.fn();
    const thumbnail = vi.fn();
    const playback = vi.fn();
    const timeline = vi.fn();
    window.wallpaperRegisterMediaStatusListener(status);
    window.wallpaperRegisterMediaPropertiesListener(properties);
    window.wallpaperRegisterMediaThumbnailListener(thumbnail);
    window.wallpaperRegisterMediaPlaybackListener(playback);
    window.wallpaperRegisterMediaTimelineListener(timeline);
    const removeGlobals = installGlobals();
    await Promise.resolve();

    expect(status).toHaveBeenCalledExactlyOnceWith({ enabled: active });
    for (const callback of [properties, thumbnail, playback, timeline])
      expect(callback).toHaveBeenCalledTimes(active ? 1 : 0);
    if (active) {
      expect(properties).toHaveBeenCalledWith(expect.objectContaining({ title: 'Retained track' }));
      expect(thumbnail).toHaveBeenCalledWith(expect.objectContaining({ thumbnail: expect.stringMatching(/^data:image\//) }));
      expect(playback).toHaveBeenCalledWith({ state: 1 });
      expect(timeline).toHaveBeenCalledWith({ position: 42, duration: 180 });
    }
    removeGlobals();
  });

  it('delivers the current media snapshot to listeners registered while active', async () => {
    const { useDevtoolsStore } = await installFreshGlobals();
    const store = useDevtoolsStore();
    store.mediaActive = true;
    store.lastPlaybackState = 1;
    store.mediaProps.title = 'Current track';
    store.mediaTimeline.position = 75;
    const properties = vi.fn();
    const thumbnail = vi.fn();
    const playback = vi.fn();
    const timeline = vi.fn();

    window.wallpaperRegisterMediaPropertiesListener(properties);
    window.wallpaperRegisterMediaThumbnailListener(thumbnail);
    window.wallpaperRegisterMediaPlaybackListener(playback);
    window.wallpaperRegisterMediaTimelineListener(timeline);
    await Promise.resolve();

    expect(properties).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Current track' }),
    );
    expect(thumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ thumbnail: expect.stringMatching(/^data:image\//) }),
    );
    expect(playback).toHaveBeenCalledWith({ state: 1 });
    expect(timeline).toHaveBeenCalledWith({ position: 75, duration: 180 });
  });

  it('returns a deterministic random file from an on-demand directory', async () => {
    const { useDevtoolsStore } = await installFreshGlobals();
    useDevtoolsStore().directoryFiles.random = ['C:/one.jpg', 'C:/two.jpg'];
    vi.spyOn(Math, 'random').mockReturnValue(0.75);
    const callback = vi.fn();

    window.wallpaperRequestRandomFileForProperty('random', callback);

    expect(callback).toHaveBeenCalledWith('random', 'C:/two.jpg');
  });

  it.each([
    ['unknown property', 'missing', false],
    ['explicitly empty configured directory', 'empty', true],
  ] as const)('returns a blank random-file response for an %s', async (_label, name, hasConfiguredEmptyDirectory) => {
    const { useDevtoolsStore } = await installFreshGlobals();
    if (hasConfiguredEmptyDirectory)
      useDevtoolsStore().directoryFiles[name] = [];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const callback = vi.fn();

    window.wallpaperRequestRandomFileForProperty(name, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(name, '');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no files configured'));
  });

  it('contains random-file callback errors after selecting a configured file', async () => {
    const { useDevtoolsStore } = await installFreshGlobals();
    useDevtoolsStore().directoryFiles.random = ['C:/one.jpg'];
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const callback = () => {
      throw new Error('wallpaper callback');
    };

    expect(() => window.wallpaperRequestRandomFileForProperty('random', callback)).not.toThrow();

    expect(error).toHaveBeenCalledWith('[WE Dev] random file callback threw', expect.any(Error));
  });

  it('exposes documented media constants and a functional virtual RGB keyboard', async () => {
    await installFreshGlobals();
    const { virtualRgbState } = await import('../src/rgb');
    const protocol = vi.fn();
    const count = vi.fn();
    const info = vi.fn();
    const positions = vi.fn();

    expect(window.wallpaperMediaIntegration).toEqual({
      PLAYBACK_PLAYING: 1,
      PLAYBACK_PAUSED: 2,
      PLAYBACK_STOPPED: 0,
    });
    const image = String.fromCharCode(7, 8, 9).repeat(4);
    const led = window.wpPlugins?.led;
    const cue = window.cue;
    if (!led || !cue)
      throw new Error('Expected the virtual RGB plugins to be installed.');
    led.setAllDevicesByImageData(image, 2, 2);
    cue.getProtocolDetails(protocol);
    cue.getDeviceCount(count);
    cue.getDeviceInfo(0, info);
    cue.getLedPositionsByDeviceIndex(0, positions);
    cue.setLedsColorsAsync([{ ledId: 1, r: 255, g: 128, b: 0 }]);

    expect(protocol).toHaveBeenCalledWith(
      expect.objectContaining({ sdkVersion: '0.0.0-dev', breakingChanges: false }),
    );
    expect(count).toHaveBeenCalledWith(1);
    expect(info).toHaveBeenCalledWith(expect.objectContaining({
      model: 'Wallpaper Engine Dev Keyboard',
      ledCount: 12,
      capsMask: 1,
    }));
    expect(positions).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ ledId: 1, ledIdName: 'Escape' }),
      expect.objectContaining({ ledId: 12, ledIdName: 'F11' }),
    ]));
    expect(virtualRgbState.colors[1]).toEqual({ r: 255, g: 128, b: 0 });
    expect(virtualRgbState.colors[12]).toEqual({ r: 7, g: 8, b: 9 });
  });

  it('resets the virtual RGB keyboard when its globals are removed', async () => {
    const [{ installGlobals }, { virtualRgbState }] = await Promise.all([
      import('../src/globals'),
      import('../src/rgb'),
    ]);
    const remove = installGlobals();
    const cue = window.cue;
    if (!cue)
      throw new Error('Expected the virtual iCUE plugin to be installed.');
    cue.setLedsColorsAsync([{ ledId: 1, r: 1, g: 2, b: 3 }]);

    remove();

    expect(virtualRgbState.colors[1]).toEqual({ r: 0, g: 0, b: 0 });
    expect(virtualRgbState.frame).toBeUndefined();
  });
});
