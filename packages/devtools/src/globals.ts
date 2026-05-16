// Bring in the `declare global` Window augmentation so this file (excluded
// from the root tsconfig along with the rest of devtools) still types every
// `window.wallpaper*` assignment correctly.
import "../../wallpaper-engine/src/types/window";
import type {
  WallpaperPluginListener,
  WallpaperPropertyListener,
} from "../../wallpaper-engine/src/types/listeners";
import {
  deliverAllProperties,
  directoryFiles,
  listenerCounts,
  listenerFns,
} from "./state";

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
      listenerFns.property = v;
      listenerCounts.property = v !== undefined;
      Promise.resolve().then(deliverAllProperties);
    },
  });

  Object.defineProperty(globalThis.window, "wallpaperPluginListener", {
    configurable: true,
    get: () => listenerFns.plugin,
    set: (v: WallpaperPluginListener | undefined) => {
      listenerFns.plugin = v;
      listenerCounts.plugin = v !== undefined;
    },
  });

  globalThis.window.wallpaperRegisterAudioListener = (cb) => {
    listenerFns.audio.push(cb);
    listenerCounts.audio = listenerFns.audio.length;
  };
  globalThis.window.wallpaperRegisterMediaStatusListener = (cb) => {
    listenerFns.mediaStatus.push(cb);
    listenerCounts.mediaStatus = listenerFns.mediaStatus.length;
  };
  globalThis.window.wallpaperRegisterMediaPropertiesListener = (cb) => {
    listenerFns.mediaProps.push(cb);
    listenerCounts.mediaProps = listenerFns.mediaProps.length;
  };
  globalThis.window.wallpaperRegisterMediaThumbnailListener = (cb) => {
    listenerFns.mediaThumb.push(cb);
    listenerCounts.mediaThumb = listenerFns.mediaThumb.length;
  };
  globalThis.window.wallpaperRegisterMediaPlaybackListener = (cb) => {
    listenerFns.mediaPlayback.push(cb);
    listenerCounts.mediaPlayback = listenerFns.mediaPlayback.length;
  };
  globalThis.window.wallpaperRegisterMediaTimelineListener = (cb) => {
    listenerFns.mediaTimeline.push(cb);
    listenerCounts.mediaTimeline = listenerFns.mediaTimeline.length;
  };

  globalThis.window.wallpaperRequestRandomFileForProperty = (name, cb) => {
    const list = directoryFiles[name] ?? [];
    if (list.length === 0) {
      console.warn(
        `[WE Dev] wallpaperRequestRandomFileForProperty('${name}'): no files configured. Add some in the Directories tab.`,
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
