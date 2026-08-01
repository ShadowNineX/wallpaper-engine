import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = { properties: {}, localization: {} };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
});

describe("StatusBar", () => {
  it("reactively summarizes listeners registered through host APIs", async () => {
    const [{ default: StatusBar }, { installGlobals }] = await Promise.all([
      import("../../src/components/StatusBar.vue"),
      import("../../src/globals"),
    ]);
    installGlobals();
    const wrapper = mount(StatusBar);
    expect(wrapper.text()).toContain("Propertieswaiting");
    expect(wrapper.text()).toContain("Media0 of 5");

    window.wallpaperPropertyListener = {};
    window.wallpaperPluginListener = {};
    window.wallpaperRegisterAudioListener(() => undefined);
    window.wallpaperRegisterAudioListener(() => undefined);
    window.wallpaperRegisterMediaStatusListener(() => undefined);
    window.wallpaperRegisterMediaPropertiesListener(() => undefined);
    await nextTick();

    expect(wrapper.text()).toContain("Propertiesready");
    expect(wrapper.text()).toContain("Pluginsready");
    expect(wrapper.text()).toContain("Audio2 listeners");
    expect(wrapper.text()).toContain("Media2 of 5");
    expect(wrapper.findAll(".bg-emerald-400")).toHaveLength(4);
  });
});
