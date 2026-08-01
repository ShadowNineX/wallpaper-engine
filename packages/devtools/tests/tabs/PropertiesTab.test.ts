import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = {
    properties: {
      second: { type: "textinput", text: "Second", value: "b", order: 2 },
      first: { type: "bool", text: "First", value: true, order: 1 },
    },
    localization: {},
  };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
});

describe("PropertiesTab", () => {
  it("sorts properties by order and replays complete startup state", async () => {
    const [{ default: PropertiesTab }, { listenerFns }] = await Promise.all([
      import("../../src/tabs/PropertiesTab.vue"),
      import("../../src/store"),
    ]);
    const applyUserProperties = vi.fn();
    const applyGeneralProperties = vi.fn();
    const setPaused = vi.fn();
    listenerFns.property = {
      applyUserProperties,
      applyGeneralProperties,
      setPaused,
    };
    const wrapper = mount(PropertiesTab);

    expect(wrapper.findAll("article").map((card) => card.text())).toEqual([
      expect.stringContaining("First"),
      expect.stringContaining("Second"),
    ]);
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Replay all"))
      ?.trigger("click");

    expect(applyUserProperties).toHaveBeenCalledWith({
      first: { value: true },
      second: { value: "b" },
    });
    expect(applyGeneralProperties).toHaveBeenCalledWith({ fps: 60 });
    expect(setPaused).toHaveBeenCalledWith(false);
  });

  it("shows an explicit empty state without configured properties", async () => {
    window.__WE_DEVTOOLS_CONFIG__ = { properties: {}, localization: {} };
    const { default: PropertiesTab } = await import(
      "../../src/tabs/PropertiesTab.vue"
    );

    expect(mount(PropertiesTab).text()).toContain(
      "No user properties are configured",
    );
  });
});
