import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = {
    properties: {
      speed: { type: "slider", text: "Speed", value: 2, min: 0, max: 5 },
      gallery: {
        type: "directory",
        text: "Gallery",
        value: "C:/gallery",
        mode: "fetchall",
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
    import("../src/globals"),
    import("../src/store"),
  ]);
  installGlobals();
  return storeModule;
}

describe("Wallpaper Engine host globals", () => {
  it("captures a property listener and replays documented initial state", async () => {
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
    expect(applyUserProperties).toHaveBeenCalledWith({ speed: { value: 2 } });
    expect(applyGeneralProperties).toHaveBeenCalledWith({ fps: 60 });
    expect(setPaused).toHaveBeenCalledWith(false);
  });

  it("tracks property and plugin listener replacement", async () => {
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

  it("registers every audio and media listener and reports counts", async () => {
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

  it("delivers the current media snapshot to listeners registered while active", async () => {
    const { useDevtoolsStore } = await installFreshGlobals();
    const store = useDevtoolsStore();
    store.mediaActive = true;
    store.lastPlaybackState = 1;
    store.mediaProps.title = "Current track";
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
      expect.objectContaining({ title: "Current track" }),
    );
    expect(thumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ thumbnail: expect.stringMatching(/^data:image\//) }),
    );
    expect(playback).toHaveBeenCalledWith({ state: 1 });
    expect(timeline).toHaveBeenCalledWith({ position: 75, duration: 180 });
  });

  it("returns a deterministic random file from an on-demand directory", async () => {
    const { useDevtoolsStore } = await installFreshGlobals();
    useDevtoolsStore().directoryFiles.random = ["C:/one.jpg", "C:/two.jpg"];
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    const callback = vi.fn();

    window.wallpaperRequestRandomFileForProperty("random", callback);

    expect(callback).toHaveBeenCalledWith("random", "C:/two.jpg");
  });

  it("warns instead of calling back when an on-demand directory is empty", async () => {
    await installFreshGlobals();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const callback = vi.fn();

    window.wallpaperRequestRandomFileForProperty("empty", callback);

    expect(callback).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no files configured"));
  });

  it("exposes documented media constants and safe LED/iCUE stubs", async () => {
    await installFreshGlobals();
    const protocol = vi.fn();
    const count = vi.fn();
    const info = vi.fn();
    const positions = vi.fn();

    expect(window.wallpaperMediaIntegration).toEqual({
      PLAYBACK_PLAYING: 0,
      PLAYBACK_PAUSED: 1,
      PLAYBACK_STOPPED: 2,
    });
    expect(() => window.wpPlugins.led.setAllDevicesByImageData("data")).not.toThrow();
    window.cue.getProtocolDetails(protocol);
    window.cue.getDeviceCount(count);
    window.cue.getDeviceInfo(0, info);
    window.cue.getLedPositionsByDeviceIndex(positions);
    expect(() => window.cue.setLedsColorsAsync([])).not.toThrow();
    expect(() => window.cue.setAllLedsColorsAsync([])).not.toThrow();
    expect(() => window.cue.setLedColorsByImageData("data")).not.toThrow();

    expect(protocol).toHaveBeenCalledWith(
      expect.objectContaining({ sdkVersion: "0.0.0-dev", breakingChanges: false }),
    );
    expect(count).toHaveBeenCalledWith(0);
    expect(info).toHaveBeenCalledWith(expect.objectContaining({ model: "dev" }));
    expect(positions).toHaveBeenCalledWith([]);
  });
});
