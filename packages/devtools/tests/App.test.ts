import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vue-sonner", () => ({
  Toaster: { template: "<div data-testid='toaster' />" },
  toast: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = {
    title: "Aether test wallpaper",
    properties: {
      enabled: { type: "bool", text: "Enabled", value: true },
    },
    localization: {},
  };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
});

describe("devtools app shell", () => {
  it("renders all simulator tabs, switches content, and collapses in place", async () => {
    const { default: App } = await import("../src/App.vue");
    const wrapper = mount(App);

    expect(wrapper.text()).toContain("Wallpaper Engine Devtools");
    expect(wrapper.text()).toContain("Aether test wallpaper");
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(5);
    expect(wrapper.text()).toContain("User properties");

    const runtimeTab = wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text().includes("Runtime"));
    await runtimeTab?.trigger("mousedown", { button: 0, ctrlKey: false });
    expect(wrapper.text()).toContain("Wallpaper runtime");

    const mediaTab = wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text().includes("Media"));
    await mediaTab?.trigger("mousedown", { button: 0, ctrlKey: false });
    expect(wrapper.text()).toContain("Media integration");

    const panel = wrapper.get(".fixed");
    const collapse = wrapper.get('button[aria-label="Collapse devtools"]');
    await collapse.trigger("click");
    expect(panel.classes()).toContain("w-[280px]");
    expect(
      wrapper.get('button[aria-label="Expand devtools"]').attributes("aria-label"),
    ).toBe("Expand devtools");
    await wrapper.get('button[aria-label="Expand devtools"]').trigger("click");
    expect(panel.classes()).toContain("w-[440px]");
  });
});
