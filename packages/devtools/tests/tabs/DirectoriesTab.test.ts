import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "vue-sonner";

vi.mock("vue-sonner", () => ({ toast: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = {
    properties: {
      random: {
        type: "directory",
        text: "Random pool",
        value: "C:/random",
        mode: "ondemand",
      },
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

describe("DirectoriesTab", () => {
  it("switches the visible workflow through the directory selector", async () => {
    const { default: DirectoriesTab } = await import(
      "../../src/tabs/DirectoriesTab.vue"
    );
    const wrapper = mount(DirectoriesTab);
    const select = wrapper.get("select#directory-property");

    expect(select.findAll("option")).toHaveLength(2);
    expect(wrapper.text()).toContain("returns one random path");
    await select.setValue("gallery");

    expect(wrapper.text()).toContain("add/change and removal callbacks");
    expect(
      wrapper.get('[data-slot="native-select-wrapper"]').attributes("data-slot"),
    ).toBe("native-select-wrapper");
  });

  it("sends fetch-all additions and removals through directory callbacks", async () => {
    const [{ default: DirectoriesTab }, { listenerFns }] = await Promise.all([
      import("../../src/tabs/DirectoriesTab.vue"),
      import("../../src/store"),
    ]);
    const changed = vi.fn();
    const removed = vi.fn();
    listenerFns.property = {
      userDirectoryFilesAddedOrChanged: changed,
      userDirectoryFilesRemoved: removed,
    };
    const wrapper = mount(DirectoriesTab);
    await wrapper.get("select#directory-property").setValue("gallery");
    await wrapper.get('input[placeholder="C:/Wallpapers/image.jpg"]').setValue(
      "C:/Gallery/new.jpg",
    );
    const addButton = wrapper
      .findAll("button")
      .find((button) => button.text().trim() === "Add");
    await addButton?.trigger("click");

    expect(wrapper.text()).toContain("C:/Gallery/new.jpg");
    expect(changed).toHaveBeenCalledWith("gallery", ["C:/Gallery/new.jpg"]);
    expect(toast).toHaveBeenCalledWith("File added and change callback sent.");

    const removeButton = wrapper
      .findAll("button")
      .find((button) => button.attributes("aria-label") === "Remove file");
    await removeButton?.trigger("click");
    expect(wrapper.text()).not.toContain("C:/Gallery/new.jpg");
    expect(removed).toHaveBeenCalledWith("gallery", ["C:/Gallery/new.jpg"]);
  });

  it("keeps on-demand files in the random pool without change callbacks", async () => {
    const [{ default: DirectoriesTab }, { listenerFns }] = await Promise.all([
      import("../../src/tabs/DirectoriesTab.vue"),
      import("../../src/store"),
    ]);
    const changed = vi.fn();
    listenerFns.property = { userDirectoryFilesAddedOrChanged: changed };
    const wrapper = mount(DirectoriesTab);
    await wrapper.get('input[placeholder="C:/Wallpapers/image.jpg"]').setValue(
      "C:/Random/pick.jpg",
    );
    const addButton = wrapper
      .findAll("button")
      .find((button) => button.text().trim() === "Add");
    await addButton?.trigger("click");

    expect(wrapper.text()).toContain("C:/Random/pick.jpg");
    expect(changed).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("File added to the on-demand random pool.");
  });
});
