import type { Pinia } from 'pinia';
import type {
  WallpaperPluginListener,
  WallpaperPropertyListener,
} from '../../wallpaper-engine/src/types/listeners';
import { getActivePinia, setActivePinia } from 'pinia';
import { withCallbackPinia } from './callbacks';
import { createVirtualRgbPlugins, resetVirtualRgbState } from './rgb';
import { listenerFns, useDevtoolsStore } from './store';
// Bring in the `declare global` Window augmentation so this file (excluded
// from the root tsconfig along with the rest of devtools) still types every
// `window.wallpaper*` assignment correctly.
import '../../wallpaper-engine/src/types/window';

const HOST_GLOBALS = [
  'wallpaperPropertyListener',
  'wallpaperPluginListener',
  'wallpaperRegisterAudioListener',
  'wallpaperRegisterMediaStatusListener',
  'wallpaperRegisterMediaPropertiesListener',
  'wallpaperRegisterMediaThumbnailListener',
  'wallpaperRegisterMediaPlaybackListener',
  'wallpaperRegisterMediaTimelineListener',
  'wallpaperRequestRandomFileForProperty',
  'wallpaperMediaIntegration',
  'wpPlugins',
  'cue',
] as const;
let currentInstallation: symbol | undefined;
let originalGlobals: Map<(typeof HOST_GLOBALS)[number], PropertyDescriptor | undefined> | undefined;
let installedGlobals: typeof originalGlobals;

function sameDescriptor(current: PropertyDescriptor | undefined, expected: PropertyDescriptor | undefined): boolean {
  if (!current || !expected)
    return current === expected;
  return current.value === expected.value && current.get === expected.get
    && current.set === expected.set && current.writable === expected.writable
    && current.enumerable === expected.enumerable && current.configurable === expected.configurable;
}

function deliverOnRegistration(action: () => void): void {
  queueMicrotask(() => {
    try {
      action();
    }
    catch (error) {
      console.error('[WE Dev] listener threw during registration', error);
    }
  });
}

/**
 * Stub every `window.wallpaper*` host global. Listener assignments are
 * intercepted via accessors so the dev panel knows when user code wires up,
 * mirroring real Wallpaper Engine behavior (initial values are delivered on
 * the next microtask).
 */
export function installGlobals(pinia?: Pinia): () => void {
  const simulatorPinia = pinia ?? getActivePinia();
  const callerPinia = getActivePinia();
  const store = (() => {
    try {
      return useDevtoolsStore(pinia);
    }
    finally {
      if (getActivePinia() === simulatorPinia)
        setActivePinia(callerPinia);
    }
  })();
  const installation = Symbol('host globals');
  const previousInstallation = currentInstallation;
  currentInstallation = installation;
  const previous = new Map(HOST_GLOBALS.map(name => [name, Object.getOwnPropertyDescriptor(window, name)]));
  // Keep the original baseline only while we still own each descriptor. If the
  // wallpaper replaced a global between installations, that becomes its baseline.
  const originals = new Map(HOST_GLOBALS.map(name => [name, originalGlobals?.has(name) && sameDescriptor(previous.get(name), installedGlobals?.get(name))
    ? originalGlobals.get(name)
    : previous.get(name)]));
  let propertyRegistration = 0;
  function onRegistration(action: () => void): void {
    const registrationPinia = getActivePinia();
    deliverOnRegistration(() => {
      if (currentInstallation !== installation)
        return;
      withCallbackPinia(store, simulatorPinia, registrationPinia, action);
    });
  }
  function whenMediaActive(action: () => void): void {
    if (store.mediaActive) {
      onRegistration(() => {
        if (store.mediaActive)
          action();
      });
    }
  }
  function applyGlobals(): void {
    Object.defineProperty(globalThis.window, 'wallpaperPropertyListener', {
      configurable: true,
      get: () => listenerFns.property,
      set: (v: WallpaperPropertyListener | undefined) => {
        listenerFns.property = v;
        store.listenerCounts.property = v !== undefined;
        const registration = ++propertyRegistration;
        if (v !== undefined) {
          onRegistration(() => {
            if (registration === propertyRegistration)
              store.deliverAllProperties(false);
          });
        }
      },
    });

    Object.defineProperty(globalThis.window, 'wallpaperPluginListener', {
      configurable: true,
      get: () => listenerFns.plugin,
      set: (v: WallpaperPluginListener | undefined) => {
        listenerFns.plugin = v;
        store.listenerCounts.plugin = v !== undefined;
      },
    });

    globalThis.window.wallpaperRegisterAudioListener = (cb) => {
      listenerFns.audio.push(cb);
      store.listenerCounts.audio = listenerFns.audio.length;
    };
    globalThis.window.wallpaperRegisterMediaStatusListener = (cb) => {
      listenerFns.mediaStatus.push(cb);
      store.listenerCounts.mediaStatus = listenerFns.mediaStatus.length;
      onRegistration(() => cb({ enabled: store.mediaActive }));
    };
    globalThis.window.wallpaperRegisterMediaPropertiesListener = (cb) => {
      listenerFns.mediaProps.push(cb);
      store.listenerCounts.mediaProps = listenerFns.mediaProps.length;
      whenMediaActive(() => cb({ ...store.mediaProps }));
    };
    globalThis.window.wallpaperRegisterMediaThumbnailListener = (cb) => {
      listenerFns.mediaThumb.push(cb);
      store.listenerCounts.mediaThumb = listenerFns.mediaThumb.length;
      whenMediaActive(() => cb({ ...store.mediaThumb }));
    };
    globalThis.window.wallpaperRegisterMediaPlaybackListener = (cb) => {
      listenerFns.mediaPlayback.push(cb);
      store.listenerCounts.mediaPlayback = listenerFns.mediaPlayback.length;
      whenMediaActive(() => cb({ state: store.lastPlaybackState }));
    };
    globalThis.window.wallpaperRegisterMediaTimelineListener = (cb) => {
      listenerFns.mediaTimeline.push(cb);
      store.listenerCounts.mediaTimeline = listenerFns.mediaTimeline.length;
      whenMediaActive(() => cb({ ...store.mediaTimeline }));
    };

    globalThis.window.wallpaperRequestRandomFileForProperty = (name, cb) => {
      const list = store.directoryFiles[name] ?? [];
      if (list.length === 0) {
        console.warn(
          `[WE Dev] wallpaperRequestRandomFileForProperty('${name}'): no files configured. Select a folder for this property in the Properties tab.`,
        );
        return;
      }
      const pick = list[Math.floor(Math.random() * list.length)];
      if (pick === undefined)
        return;
      try {
        cb(name, pick);
      }
      catch (e) {
        console.error('[WE Dev] random file callback threw', e);
      }
    };

    globalThis.window.wallpaperMediaIntegration = {
      PLAYBACK_PLAYING: 0,
      PLAYBACK_PAUSED: 1,
      PLAYBACK_STOPPED: 2,
    };

    const rgb = createVirtualRgbPlugins();
    globalThis.window.wpPlugins = { led: rgb.led };
    globalThis.window.cue = rgb.cue;
    // Reinstallation must invalidate pending work from the previous shim while
    // retaining listeners already registered by the wallpaper.
    store.listenerCounts.property = listenerFns.property !== undefined;
    store.listenerCounts.plugin = listenerFns.plugin !== undefined;
    store.listenerCounts.audio = listenerFns.audio.length;
    store.listenerCounts.mediaStatus = listenerFns.mediaStatus.length;
    store.listenerCounts.mediaProps = listenerFns.mediaProps.length;
    store.listenerCounts.mediaThumb = listenerFns.mediaThumb.length;
    store.listenerCounts.mediaPlayback = listenerFns.mediaPlayback.length;
    store.listenerCounts.mediaTimeline = listenerFns.mediaTimeline.length;
    for (const cb of listenerFns.mediaStatus)
      onRegistration(() => cb({ enabled: store.mediaActive }));
    for (const cb of listenerFns.mediaProps)
      whenMediaActive(() => cb({ ...store.mediaProps }));
    for (const cb of listenerFns.mediaThumb)
      whenMediaActive(() => cb({ ...store.mediaThumb }));
    for (const cb of listenerFns.mediaPlayback)
      whenMediaActive(() => cb({ state: store.lastPlaybackState }));
    for (const cb of listenerFns.mediaTimeline)
      whenMediaActive(() => cb({ ...store.mediaTimeline }));
    if (listenerFns.property !== undefined) {
      const registration = propertyRegistration;
      onRegistration(() => {
        if (registration === propertyRegistration)
          store.deliverAllProperties(false);
      });
    }
  }
  try {
    applyGlobals();
  }
  catch (error) {
    // A non-writable host global can reject installation partway through.
    // Restore the previous live shim as well as any globals already changed.
    currentInstallation = previousInstallation;
    for (const name of HOST_GLOBALS) {
      const descriptor = previous.get(name);
      if (descriptor)
        Object.defineProperty(window, name, descriptor);
      else
        Reflect.deleteProperty(window, name);
    }
    resetVirtualRgbState();
    throw error;
  }
  originalGlobals = originals;
  const installed = new Map(HOST_GLOBALS.map(name => [name, Object.getOwnPropertyDescriptor(window, name)!]));
  installedGlobals = installed;
  return () => {
    if (currentInstallation !== installation)
      return;
    currentInstallation = undefined;
    originalGlobals = undefined;
    installedGlobals = undefined;
    for (const name of HOST_GLOBALS) {
      const descriptor = Object.getOwnPropertyDescriptor(window, name);
      const owned = installed.get(name)!;
      if (!sameDescriptor(descriptor, owned))
        continue;
      const original = originals.get(name);
      if (original)
        Object.defineProperty(window, name, original);
      else
        Reflect.deleteProperty(window, name);
    }
    listenerFns.property = undefined;
    listenerFns.plugin = undefined;
    for (const listeners of Object.values(listenerFns)) {
      if (Array.isArray(listeners))
        listeners.length = 0;
    }
    Object.assign(store.listenerCounts, {
      property: false,
      plugin: false,
      audio: 0,
      mediaStatus: 0,
      mediaProps: 0,
      mediaThumb: 0,
      mediaPlayback: 0,
      mediaTimeline: 0,
    });
    resetVirtualRgbState();
  };
}
