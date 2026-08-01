import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vue-sonner", () => ({ toast: vi.fn() }));

const definitions = {
  accent: { type: "color", text: "Accent", value: "0 0 0" },
  speed: { type: "slider", text: "Speed", value: 2, min: 0, max: 10 },
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
  gallery: {
    type: "directory",
    text: "Gallery",
    value: "",
    mode: "fetchall",
  },
} as const;

beforeEach(() => {
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

  it("delivers color, text, and file edits as partial property updates", async () => {
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

    const file = mount(PropertyRow, {
      props: { propKey: "artwork", def: definitions.artwork },
    });
    await file.get("input#artwork").setValue("C:/Media/cover.png");

    expect(applyUserProperties).toHaveBeenNthCalledWith(1, {
      accent: { value: expect.stringMatching(/^0\.35\d 0\.52\d 0\.92\d$/) },
    });
    expect(applyUserProperties).toHaveBeenNthCalledWith(2, {
      greeting: { value: "Aether live" },
    });
    expect(applyUserProperties).toHaveBeenNthCalledWith(3, {
      artwork: { value: "C:/Media/cover.png" },
    });
  });

  it("does not route fetch-all directory edits through applyUserProperties", async () => {
    const { PropertyRow, listenerFns } = await loadPropertyRow();
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };
    const wrapper = mount(PropertyRow, {
      props: { propKey: "gallery", def: definitions.gallery },
    });

    await wrapper.get("input#gallery").setValue("C:/Gallery");

    expect(applyUserProperties).not.toHaveBeenCalled();
  });
});
