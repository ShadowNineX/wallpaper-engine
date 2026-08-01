import { createPinia, setActivePinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vue-sonner", () => ({ toast: vi.fn() }));
vi.mock("../../../wallpaper-engine/src/helpers", () => ({
  createAverageColorExtractor: () => ({
    getColorAsync: () => Promise.resolve({ hex: "#000000" }),
    destroy: () => undefined,
  }),
}));

beforeEach(() => {
  vi.resetModules();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = { properties: {}, localization: {} };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  it("associates artwork file and palette inputs with labels", async () => {
    const { default: MediaTab } = await import("../../src/tabs/MediaTab.vue");
    const wrapper = mount(MediaTab);

    expect(
      wrapper.get('label[for="media-thumbnail-input"]').text(),
    ).toBe("Artwork image");
    expect(wrapper.get("#media-thumbnail-input").attributes("type")).toBe("file");
    expect(wrapper.get('label[for="thumb-primaryColor"]').text()).toBe(
      "Primary",
    );
    expect(
      wrapper.get('label[for="thumb-primaryColor-value"]').text(),
    ).toBe("Primary color value");
    expect(
      wrapper.get<HTMLInputElement>("#thumb-primaryColor-value").element.value,
    ).toBe("#202020");
  });

  it("accepts browser-decodable artwork and emits a PNG callback", async () => {
    const [{ default: MediaTab }, { listenerFns }] = await Promise.all([
      import("../../src/tabs/MediaTab.vue"),
      import("../../src/store"),
    ]);
    const thumbnail = vi.fn();
    listenerFns.mediaThumb.push(thumbnail);
    const wrapper = mount(MediaTab);
    const button = (label: string) =>
      wrapper.findAll("button").find((candidate) => candidate.text().includes(label));

    await button("Enabled")?.trigger("click");
    thumbnail.mockClear();

    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,converted",
    );
    const createObjectURL = vi.fn(() => "blob:artwork-source");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 2;
        naturalHeight = 2;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );

    const input = wrapper.get<HTMLInputElement>('input[type="file"]');
    const jpeg = new File(["jpeg"], "cover.jpg", { type: "image/jpeg" });
    Object.defineProperty(input.element, "files", {
      configurable: true,
      value: [jpeg],
    });

    expect(input.attributes("accept")).toBe("image/*");
    expect(button("Choose image")).toBeDefined();
    await input.trigger("change");
    await flushPromises();
    await button("Send artwork")?.trigger("click");

    expect(drawImage).toHaveBeenCalledOnce();
    expect(thumbnail).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnail: "data:image/png;base64,converted",
      }),
    );
    expect(createObjectURL).toHaveBeenCalledWith(jpeg);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:artwork-source");
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
