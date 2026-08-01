import { createPinia, setActivePinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WallpaperPropertyDefinition } from "../../../wallpaper-engine/src/types/project";

vi.mock("vue-sonner", () => ({ toast: vi.fn() }));

const {
  pickDevDirectoryMock,
  pickDevFileMock,
  releaseDevDirectoryMock,
  releaseDevFileMock,
} = vi.hoisted(() => ({
  pickDevDirectoryMock: vi.fn(),
  pickDevFileMock: vi.fn(),
  releaseDevDirectoryMock: vi.fn(),
  releaseDevFileMock: vi.fn(),
}));

vi.mock("../../src/dev-files", () => ({
  devFilePickerAvailable: true,
  pickDevDirectory: pickDevDirectoryMock,
  pickDevFile: pickDevFileMock,
  releaseDevDirectory: releaseDevDirectoryMock,
  releaseDevFile: releaseDevFileMock,
}));

const definitions = {
  accent: { type: "color", text: "Accent", value: "0 0 0" },
  speed: {
    type: "slider",
    text: "Speed",
    value: 2,
    min: 0,
    max: 10,
    fraction: true,
    precision: 2,
    step: 0.25,
  },
  enabled: { type: "bool", text: "Enabled", value: true },
  mode: {
    type: "combo",
    text: "Mode",
    value: "bars",
    options: [
      { label: "Bars", value: "bars" },
      { label: "Silk wave", value: "wave" },
    ],
  },
  greeting: { type: "textinput", text: "Greeting", value: "Hello" },
  artwork: { type: "file", text: "Artwork", value: "" },
  random: {
    type: "directory",
    text: "Random pool",
    value: "",
    mode: "ondemand",
    fileType: "image",
  },
  gallery: {
    type: "directory",
    text: "Gallery",
    value: "",
    mode: "fetchall",
  },
} satisfies Record<string, WallpaperPropertyDefinition>;

beforeEach(() => {
  pickDevDirectoryMock.mockReset();
  pickDevFileMock.mockReset();
  releaseDevDirectoryMock.mockReset();
  releaseDevFileMock.mockReset();
  vi.resetModules();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = {
    properties: definitions,
    localization: {},
  };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
});

// PropertyRow captures config and its Pinia module at evaluation time.
async function loadPropertyRow() {
  const [{ default: PropertyRow }, storeModule] = await Promise.all([
    import("../../src/components/PropertyRow.vue"),
    import("../../src/store"),
  ]);
  return { PropertyRow, ...storeModule };
}

describe("PropertyRow", () => {
  it("renders every Wallpaper Engine property with an appropriate control", async () => {
    const { PropertyRow } = await loadPropertyRow();

    for (const [propKey, def] of Object.entries(definitions)) {
      const wrapper = mount(PropertyRow, { props: { propKey, def } });
      expect(wrapper.text()).toContain(def.text);
      expect(wrapper.find(`#${propKey}`).exists()).toBe(true);
      wrapper.unmount();
    }
  });

  it("prevents text selection throughout boolean property rows", async () => {
    const { PropertyRow } = await loadPropertyRow();
    const wrapper = mount(PropertyRow, {
      props: { propKey: "enabled", def: definitions.enabled },
    });

    expect(wrapper.get("article").classes()).toContain("select-none");
  });

  it("delivers text properties on every input without waiting for blur", async () => {
    const { PropertyRow, listenerFns } = await loadPropertyRow();
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };
    const wrapper = mount(PropertyRow, {
      props: { propKey: "greeting", def: definitions.greeting },
    });
    const input = wrapper.get<HTMLInputElement>("input#greeting");

    input.element.value = "A";
    await input.trigger("input");
    expect(applyUserProperties).toHaveBeenNthCalledWith(1, {
      greeting: { value: "A" },
    });

    input.element.value = "Aether";
    await input.trigger("input");
    expect(applyUserProperties).toHaveBeenNthCalledWith(2, {
      greeting: { value: "Aether" },
    });
  });

  it("moves sliders by their explicit configured step", async () => {
    const { PropertyRow, listenerFns } = await loadPropertyRow();
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };
    const wrapper = mount(PropertyRow, {
      props: { propKey: "speed", def: definitions.speed },
    });

    await wrapper
      .get('[role="slider"]')
      .trigger("keydown", { key: "ArrowRight", code: "ArrowRight" });

    expect(applyUserProperties).toHaveBeenCalledWith({
      speed: { value: 2.25 },
    });
  });

  it("uses an inline native select and sends combo value plus display text", async () => {
    const { PropertyRow, listenerFns } = await loadPropertyRow();
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };
    const wrapper = mount(PropertyRow, {
      props: { propKey: "mode", def: definitions.mode },
    });

    const select = wrapper.get("select#mode");
    expect(select.findAll("option")).toHaveLength(2);
    await select.setValue("wave");

    expect(applyUserProperties).toHaveBeenCalledWith({
      mode: { value: "wave", text: "Silk wave" },
    });
    expect(
      wrapper.get('[data-slot="native-select-wrapper"]').attributes("data-slot"),
    ).toBe("native-select-wrapper");
  });

  it("delivers color, text, and browsed file values as partial property updates", async () => {
    const { PropertyRow, listenerFns } = await loadPropertyRow();
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };

    const color = mount(PropertyRow, {
      props: { propKey: "accent", def: definitions.accent },
    });
    await color.get("input#accent").setValue("#5b86ed");

    const text = mount(PropertyRow, {
      props: { propKey: "greeting", def: definitions.greeting },
    });
    await text.get("input#greeting").setValue("Aether live");

    pickDevFileMock.mockResolvedValue({
      id: "file-1",
      path: "cover.png",
      relativePath: "cover.png",
      url: "blob:http://localhost/file-1",
      size: 1024,
      mtimeMs: 10,
    });
    const file = mount(PropertyRow, {
      props: { propKey: "artwork", def: definitions.artwork },
    });
    await file.get("[data-browse-path]").trigger("click");
    await flushPromises();

    expect(applyUserProperties).toHaveBeenNthCalledWith(1, {
      accent: { value: expect.stringMatching(/^0\.35\d 0\.52\d 0\.92\d$/) },
    });
    expect(applyUserProperties).toHaveBeenNthCalledWith(2, {
      greeting: { value: "Aether live" },
    });
    expect(applyUserProperties).toHaveBeenNthCalledWith(3, {
      artwork: {
        value: "blob:http://localhost/file-1",
      },
    });
    expect(file.get<HTMLInputElement>("input#artwork").element.value).toBe(
      "cover.png",
    );
  });

  it("routes on-demand folders through applyUserProperties and the random pool", async () => {
    const { PropertyRow, listenerFns, useDevtoolsStore } =
      await loadPropertyRow();
    const applyUserProperties = vi.fn();
    const changed = vi.fn();
    listenerFns.property = {
      applyUserProperties,
      userDirectoryFilesAddedOrChanged: changed,
    };
    pickDevDirectoryMock.mockResolvedValue({
      id: "directory-1",
      path: "Random",
      files: [
        {
          id: "file-1",
          name: "pick.png",
          path: "Random/pick.png",
          relativePath: "pick.png",
          url: "blob:http://localhost/pick",
          size: 10,
          mtimeMs: 1,
        },
      ],
    });
    const wrapper = mount(PropertyRow, {
      props: { propKey: "random", def: definitions.random },
    });

    await wrapper.get("[data-browse-path]").trigger("click");
    await flushPromises();

    expect(pickDevDirectoryMock).toHaveBeenCalledWith("image", undefined);
    expect(applyUserProperties).toHaveBeenCalledWith({
      random: { value: "Random" },
    });
    expect(changed).not.toHaveBeenCalled();
    expect(useDevtoolsStore().directoryFiles.random).toEqual([
      "blob:http://localhost/pick",
    ]);
  });

  it("diffs and clears fetch-all folders through directory callbacks", async () => {
    const { PropertyRow, listenerFns } = await loadPropertyRow();
    const applyUserProperties = vi.fn();
    const changed = vi.fn();
    const removed = vi.fn();
    listenerFns.property = {
      applyUserProperties,
      userDirectoryFilesAddedOrChanged: changed,
      userDirectoryFilesRemoved: removed,
    };
    pickDevDirectoryMock
      .mockResolvedValueOnce({
        id: "directory-1",
        path: "Gallery",
        files: [
          {
            id: "file-1",
            name: "cover.png",
            path: "Gallery/cover.png",
            relativePath: "cover.png",
            url: "blob:http://localhost/file-1",
            size: 1024,
            mtimeMs: 10,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "directory-1",
        path: "Gallery",
        files: [
          {
            id: "file-1",
            name: "cover.png",
            path: "Gallery/cover.png",
            relativePath: "cover.png",
            url: "blob:http://localhost/file-2",
            size: 2048,
            mtimeMs: 20,
          },
        ],
      });
    const wrapper = mount(PropertyRow, {
      props: { propKey: "gallery", def: definitions.gallery },
    });

    await wrapper.get("[data-browse-path]").trigger("click");
    await flushPromises();
    await wrapper.get("[data-browse-path]").trigger("click");
    await flushPromises();

    expect(pickDevDirectoryMock).toHaveBeenNthCalledWith(
      2,
      undefined,
      "directory-1",
    );
    expect(applyUserProperties).not.toHaveBeenCalled();
    expect(changed).toHaveBeenNthCalledWith(1, "gallery", [
      "blob:http://localhost/file-1",
    ]);
    expect(changed).toHaveBeenNthCalledWith(2, "gallery", [
      "blob:http://localhost/file-2",
    ]);
    expect(removed).toHaveBeenNthCalledWith(1, "gallery", [
      "blob:http://localhost/file-1",
    ]);
    expect(wrapper.get<HTMLInputElement>("input#gallery").element.value).toBe(
      "Gallery",
    );

    await wrapper.get("[data-clear-path]").trigger("click");

    expect(removed).toHaveBeenNthCalledWith(2, "gallery", [
      "blob:http://localhost/file-2",
    ]);
    expect(releaseDevDirectoryMock).toHaveBeenCalledWith("directory-1");
  });
});
