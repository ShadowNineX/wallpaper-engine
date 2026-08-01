import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vue-sonner", () => ({ toast: vi.fn() }));
vi.mock("fast-average-color", () => ({
  FastAverageColor: class {
    getColorAsync() {
      return Promise.resolve({ hex: "#000000" });
    }
  },
}));

beforeEach(() => {
  vi.resetModules();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = { properties: {}, localization: {} };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
});

describe("MediaTab", () => {
  it("edits content type through the native selector and sends metadata", async () => {
    const [{ default: MediaTab }, { listenerFns }] = await Promise.all([
      import("../../src/tabs/MediaTab.vue"),
      import("../../src/store"),
    ]);
    const mediaPropertiesListener = vi.fn();
    listenerFns.mediaProps.push(mediaPropertiesListener);
    const wrapper = mount(MediaTab);
    const buttons = wrapper.findAll("button");

    await buttons.find((button) => button.text().trim() === "Enabled")?.trigger("click");
    mediaPropertiesListener.mockClear();
    await wrapper.get("select#media-content-type").setValue("video");
    await buttons
      .find((button) => button.text().includes("Send metadata"))
      ?.trigger("click");

    expect(mediaPropertiesListener).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "video" }),
    );
    expect(
      wrapper.get('[data-slot="native-select-wrapper"]').attributes("data-slot"),
    ).toBe("native-select-wrapper");
  });

  it("delivers status, playback, timeline, artwork, and disabled transitions", async () => {
    const [{ default: MediaTab }, { listenerFns }] = await Promise.all([
      import("../../src/tabs/MediaTab.vue"),
      import("../../src/store"),
    ]);
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
    const wrapper = mount(MediaTab);
    const button = (label: string) =>
      wrapper.findAll("button").find((candidate) => candidate.text().includes(label));

    await button("Enabled")?.trigger("click");
    expect(status).toHaveBeenLastCalledWith({ enabled: true });
    expect(properties).toHaveBeenCalledOnce();
    expect(thumbnail).toHaveBeenCalledOnce();
    expect(playback).toHaveBeenCalledWith({ state: 0 });
    expect(timeline).toHaveBeenCalledWith({ position: 30, duration: 180 });

    playback.mockClear();
    timeline.mockClear();
    thumbnail.mockClear();
    await button("Paused")?.trigger("click");
    expect(playback).toHaveBeenCalledWith({ state: 1 });

    const increases = wrapper.findAll('button[aria-label="Increase"]');
    const decreases = wrapper.findAll('button[aria-label="Decrease"]');
    await increases[0]?.trigger("pointerdown", { button: 0 });
    await increases[0]?.trigger("pointerup", { button: 0 });
    await decreases[1]?.trigger("pointerdown", { button: 0 });
    await decreases[1]?.trigger("pointerup", { button: 0 });
    await button("Send timeline")?.trigger("click");
    expect(timeline).toHaveBeenCalledWith({ position: 31, duration: 179 });

    await button("Send artwork")?.trigger("click");
    expect(thumbnail).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnail: expect.stringMatching(/^data:image\/png;base64,/),
        textColor: "#ffffff",
      }),
    );

    properties.mockClear();
    thumbnail.mockClear();
    playback.mockClear();
    timeline.mockClear();
    await button("Disabled")?.trigger("click");
    expect(status).toHaveBeenLastCalledWith({ enabled: false });
    expect(properties).not.toHaveBeenCalled();
    expect(thumbnail).not.toHaveBeenCalled();
    expect(playback).not.toHaveBeenCalled();
    expect(timeline).not.toHaveBeenCalled();
  });
});
