// Bring in the `declare global` Window augmentation so this file (excluded
// from the root tsconfig along with the rest of devtools) still types every
// `window.wallpaper*` assignment correctly.
import "../../wallpaper-engine/src/types/window";
import type {
  WallpaperPluginListener,
  WallpaperPropertyListener,
} from "../../wallpaper-engine/src/types/listeners";
import { listenerFns, useDevtoolsStore } from "./store";
function deliverOnRegistration(action: () => void): void {
  queueMicrotask(() => {
    try {
      action();
    } catch (error) {
      console.error("[WE Dev] listener threw during registration", error);
    }
  });
}


/**
 * Stub every `window.wallpaper*` host global. Listener assignments are
 * intercepted via accessors so the dev panel knows when user code wires up,
 * mirroring real Wallpaper Engine behavior (initial values are delivered on
 * the next microtask).
 */
export function installGlobals(): void {
  Object.defineProperty(globalThis.window, "wallpaperPropertyListener", {
    configurable: true,
    get: () => listenerFns.property,
    set: (v: WallpaperPropertyListener | undefined) => {
      const store = useDevtoolsStore();
      listenerFns.property = v;
      store.listenerCounts.property = v !== undefined;
      deliverOnRegistration(() => store.deliverAllProperties(false));
    },
  });

  Object.defineProperty(globalThis.window, "wallpaperPluginListener", {
    configurable: true,
    get: () => listenerFns.plugin,
    set: (v: WallpaperPluginListener | undefined) => {
      const store = useDevtoolsStore();
      listenerFns.plugin = v;
      store.listenerCounts.plugin = v !== undefined;
    },
  });

  globalThis.window.wallpaperRegisterAudioListener = (cb) => {
    const store = useDevtoolsStore();
    listenerFns.audio.push(cb);
    store.listenerCounts.audio = listenerFns.audio.length;
  };
  globalThis.window.wallpaperRegisterMediaStatusListener = (cb) => {
    const store = useDevtoolsStore();
    listenerFns.mediaStatus.push(cb);
    store.listenerCounts.mediaStatus = listenerFns.mediaStatus.length;
    deliverOnRegistration(() => cb({ enabled: store.mediaActive }));
  };
  globalThis.window.wallpaperRegisterMediaPropertiesListener = (cb) => {
    const store = useDevtoolsStore();
    listenerFns.mediaProps.push(cb);
    store.listenerCounts.mediaProps = listenerFns.mediaProps.length;
    if (store.mediaActive) {
      deliverOnRegistration(() => cb({ ...store.mediaProps }));
    }
  };
  globalThis.window.wallpaperRegisterMediaThumbnailListener = (cb) => {
    const store = useDevtoolsStore();
    listenerFns.mediaThumb.push(cb);
    store.listenerCounts.mediaThumb = listenerFns.mediaThumb.length;
    if (store.mediaActive) {
      deliverOnRegistration(() => cb({ ...store.mediaThumb }));
    }
  };
  globalThis.window.wallpaperRegisterMediaPlaybackListener = (cb) => {
    const store = useDevtoolsStore();
    listenerFns.mediaPlayback.push(cb);
    store.listenerCounts.mediaPlayback = listenerFns.mediaPlayback.length;
    if (store.mediaActive) {
      deliverOnRegistration(() => cb({ state: store.lastPlaybackState }));
    }
  };
  globalThis.window.wallpaperRegisterMediaTimelineListener = (cb) => {
    const store = useDevtoolsStore();
    listenerFns.mediaTimeline.push(cb);
    store.listenerCounts.mediaTimeline = listenerFns.mediaTimeline.length;
    if (store.mediaActive) {
      deliverOnRegistration(() => cb({ ...store.mediaTimeline }));
    }
  };

  globalThis.window.wallpaperRequestRandomFileForProperty = (name, cb) => {
    const store = useDevtoolsStore();
    const list = store.directoryFiles[name] ?? [];
    if (list.length === 0) {
      console.warn(
        `[WE Dev] wallpaperRequestRandomFileForProperty('${name}'): no files configured. Select a folder for this property in the Properties tab.`,
      );
      return;
    }
    const pick = list[Math.floor(Math.random() * list.length)];
    if (pick === undefined) return;
    try {
      cb(name, pick);
    } catch (e) {
      console.error("[WE Dev] random file callback threw", e);
    }
  };

  globalThis.window.wallpaperMediaIntegration = {
    PLAYBACK_PLAYING: 0,
    PLAYBACK_PAUSED: 1,
    PLAYBACK_STOPPED: 2,
  };

  globalThis.window.wpPlugins = {
    led: {
      setAllDevicesByImageData: () => {
        /* dev no-op */
      },
    },
  };

  globalThis.window.cue = {
    getProtocolDetails: (cb) =>
      cb({
        sdkVersion: "0.0.0-dev",
        serverVersion: "0.0.0-dev",
        sdkProtocolVersion: 0,
        serverProtocolVersion: 0,
        breakingChanges: false,
      }),
    getDeviceCount: (cb) => cb(0),
    getDeviceInfo: (_i, cb) =>
      cb({
        type: 0,
        model: "dev",
        physicalLayout: 0,
        logicalLayout: 0,
        ledCount: 0,
        capsMask: 0,
      }),
    getLedPositionsByDeviceIndex: (cb) => cb([]),
    setLedsColorsAsync: () => {},
    setAllLedsColorsAsync: () => {},
    setLedColorsByImageData: () => {},
  };
}
