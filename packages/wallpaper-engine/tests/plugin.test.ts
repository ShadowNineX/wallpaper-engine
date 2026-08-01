import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  boolProperty,
  colorProperty,
  comboProperty,
  directoryProperty,
  fileProperty,
  groupProperty,
  sliderProperty,
  textInputProperty,
  wallpaperEnginePlugin,
  type WallpaperUserPropertiesOf,
} from "../src/plugin/index";

const { readFileSyncMock, unwatchFileMock, watchFileMock } = vi.hoisted(() => ({
  readFileSyncMock: vi.fn(() => "globalThis.__DEVTOOLS_CLIENT_LOADED__ = true;"),
  unwatchFileMock: vi.fn(),
  watchFileMock: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: readFileSyncMock,
  unwatchFile: unwatchFileMock,
  watchFile: watchFileMock,
}));

// ---------------------------------------------------------------------------
// Property builders
// ---------------------------------------------------------------------------

describe("colorProperty", () => {
  it("sets type to 'color' and passes options through", () => {
    const prop = colorProperty({ text: "Background", value: "1 0 0" });
    expect(prop.type).toBe("color");
    expect(prop.text).toBe("Background");
    expect(prop.value).toBe("1 0 0");
  });

  it("accepts optional fields", () => {
    const prop = colorProperty({
      text: "C",
      value: "0 0 0",
      order: 2,
      condition: "flag.value == true",
    });
    expect(prop.order).toBe(2);
    expect(prop.condition).toBe("flag.value == true");
  });
});

describe("sliderProperty", () => {
  it("sets type to 'slider' with range", () => {
    const prop = sliderProperty({ text: "Speed", value: 1, min: 0, max: 10 });
    expect(prop.type).toBe("slider");
    expect(prop.value).toBe(1);
    expect(prop.min).toBe(0);
    expect(prop.max).toBe(10);
  });

  it("converts precision to Wallpaper Engine's step field", () => {
    const prop = sliderProperty({
      text: "S",
      value: 0.5,
      min: 0,
      max: 1,
      fraction: true,
      precision: 3,
    });
    expect(prop.fraction).toBe(true);
    expect(prop.precision).toBe(3);
    expect(prop.step).toBe(0.001);
  });

  it("accepts an explicit step instead of precision", () => {
    const prop = sliderProperty({
      text: "S",
      value: 0.5,
      min: 0,
      max: 1,
      fraction: true,
      step: 0.05,
    });
    expect(prop.step).toBe(0.05);
    expect(prop.precision).toBeUndefined();
  });

  it("prefers an explicit step over derived precision", () => {
    const prop = sliderProperty({
      text: "S",
      value: 0.5,
      min: 0,
      max: 1,
      fraction: true,
      precision: 3,
      step: 0.05,
    });
    expect(prop.step).toBe(0.05);
  });
});

describe("boolProperty", () => {
  it("sets type to 'bool'", () => {
    const prop = boolProperty({ text: "Show clock", value: true });
    expect(prop.type).toBe("bool");
    expect(prop.value).toBe(true);
  });
});

describe("comboProperty", () => {
  it("sets type to 'combo' with options array", () => {
    const prop = comboProperty({
      text: "Mode",
      value: "a",
      options: [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ],
    });
    expect(prop.type).toBe("combo");
    expect(prop.value).toBe("a");
    expect(prop.options).toHaveLength(2);
    expect(prop.options[0]?.value).toBe("a");
    expect(prop.options[1]?.label).toBe("Option B");
  });
});

describe("textInputProperty", () => {
  it("sets type to 'textinput'", () => {
    const prop = textInputProperty({ text: "Name", value: "hello" });
    expect(prop.type).toBe("textinput");
    expect(prop.value).toBe("hello");
  });
});

describe("fileProperty", () => {
  it("sets type to 'file'", () => {
    const prop = fileProperty({ text: "Image", value: "" });
    expect(prop.type).toBe("file");
  });

  it("accepts fileType", () => {
    const prop = fileProperty({ text: "Image", value: "", fileType: "image" });
    expect(prop.fileType).toBe("image");
  });
});

describe("directoryProperty", () => {
  it("sets type to 'directory' with mode", () => {
    const prop = directoryProperty({
      text: "Folder",
      value: "",
      mode: "fetchall",
    });
    expect(prop.type).toBe("directory");
    expect(prop.mode).toBe("fetchall");
  });

  it("accepts ondemand mode", () => {
    const prop = directoryProperty({
      text: "Folder",
      value: "",
      mode: "ondemand",
    });
    expect(prop.mode).toBe("ondemand");
  });
});

describe("groupProperty", () => {
  it("creates Wallpaper Engine's native group marker", () => {
    expect(groupProperty({ text: "Appearance", order: 4 })).toEqual({
      text: "Appearance",
      order: 4,
      type: "group",
      value: "",
    });
  });

  it("is omitted from inferred applyUserProperties values", () => {
    const definitions = {
      appearance: groupProperty({ text: "Appearance" }),
      enabled: boolProperty({ text: "Enabled", value: true }),
    };

    expectTypeOf<
      keyof WallpaperUserPropertiesOf<typeof definitions>
    >().toEqualTypeOf<"enabled">();
  });
});

// ---------------------------------------------------------------------------
// Vite plugin — generateBundle output
// ---------------------------------------------------------------------------

interface GenerateBundlePlugin {
  generateBundle?: unknown;
}

type TestOutputBundle = Record<
  string,
  | { type: "chunk"; fileName: string; code: string }
  | { type: "asset"; fileName: string; source: string | Uint8Array }
>;

function runGenerateBundle(
  plugin: GenerateBundlePlugin,
  bundle: TestOutputBundle = {},
) {
  let emitted: { fileName: string; source: string } | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (plugin.generateBundle as any).call(
    {
      emitFile: (f: typeof emitted) => {
        emitted = f;
      },
    },
    {},
    bundle,
  );
  if (!emitted) throw new Error("emitFile was not called");
  return {
    fileName: emitted.fileName,
    source: emitted.source,
    project: JSON.parse(emitted.source),
  };
}

describe("wallpaperEnginePlugin", () => {
  it("emits a file named project.json", () => {
    const { fileName } = runGenerateBundle(
      wallpaperEnginePlugin({ title: "T" }),
    );
    expect(fileName).toBe("project.json");
  });

  it("sets required top-level fields", () => {
    const { project } = runGenerateBundle(
      wallpaperEnginePlugin({ title: "My Wallpaper" }),
    );
    expect(project.title).toBe("My Wallpaper");
    expect(project.type).toBe("web");
    expect(project.file).toBe("index.html");
  });

  it("respects a custom file option", () => {
    const { project } = runGenerateBundle(
      wallpaperEnginePlugin({ title: "T", file: "main.html" }),
    );
    expect(project.file).toBe("main.html");
  });

  it("minifies project.json by default for builds", () => {
    const { source } = runGenerateBundle(
      wallpaperEnginePlugin({ title: "T" }),
    );

    expect(source).toBe('{"file":"index.html","title":"T","type":"web"}');
  });

  it("pretty-prints project.json when minification is disabled", () => {
    const { source } = runGenerateBundle(
      wallpaperEnginePlugin({ title: "T", minify: false }),
    );

    expect(source).toContain('\n\t"file": "index.html"');
  });

  it("defaults to pretty output during development", () => {
    const plugin = wallpaperEnginePlugin({ title: "T" });
    if (typeof plugin.configResolved !== "function") {
      throw new Error("configResolved hook is not callable");
    }
    plugin.configResolved.call({} as never, { command: "serve" } as never);

    const { source } = runGenerateBundle(plugin);
    expect(source).toContain('\n\t"file": "index.html"');
  });

  it("nests supportsaudioprocessing under general when enabled", () => {
    const { project } = runGenerateBundle(
      wallpaperEnginePlugin({ title: "T", supportsAudioProcessing: true }),
    );
    expect(project.general).toEqual({ supportsaudioprocessing: true });
    expect(project.supportsaudioprocessing).toBeUndefined();
  });

  it.each([
    [
      "window property",
      "window.wallpaperRegisterAudioListener(() => undefined);",
    ],
    [
      "globalThis property",
      "globalThis.wallpaperRegisterAudioListener(() => undefined);",
    ],
    ["bare global", "wallpaperRegisterAudioListener(() => undefined);"],
    [
      "computed window property",
      'window["wallpaperRegisterAudioListener"](() => undefined);',
    ],
  ])("detects a %s call in an emitted chunk", (_name, code) => {
    const { project } = runGenerateBundle(
      wallpaperEnginePlugin({ title: "T" }),
      {
        "assets/index.js": {
          type: "chunk",
          fileName: "assets/index.js",
          code,
        },
      },
    );

    expect(project.general).toEqual({ supportsaudioprocessing: true });
  });

  it("detects a listener call in an emitted script asset", () => {
    const { project } = runGenerateBundle(
      wallpaperEnginePlugin({ title: "T" }),
      {
        "audio.js": {
          type: "asset",
          fileName: "audio.js",
          source: new TextEncoder().encode(
            "window.wallpaperRegisterAudioListener(() => undefined);",
          ),
        },
      },
    );

    expect(project.general).toEqual({ supportsaudioprocessing: true });
  });

  it("allows automatic audio processing detection to be disabled", () => {
    const { project } = runGenerateBundle(
      wallpaperEnginePlugin({
        title: "T",
        supportsAudioProcessing: false,
      }),
      {
        "assets/index.js": {
          type: "chunk",
          fileName: "assets/index.js",
          code: "window.wallpaperRegisterAudioListener(() => undefined);",
        },
      },
    );

    expect(project.general).toBeUndefined();
  });

  it("omits supportsaudioprocessing when not set", () => {
    const { project } = runGenerateBundle(
      wallpaperEnginePlugin({ title: "T" }),
    );
    expect(project.general?.supportsaudioprocessing).toBeUndefined();
    expect(project.supportsaudioprocessing).toBeUndefined();
  });

  it("omits the general block when there are no properties or localization", () => {
    const { project } = runGenerateBundle(
      wallpaperEnginePlugin({ title: "T" }),
    );
    expect(project.general).toBeUndefined();
  });

  it("emits derived and explicit slider steps in project.json", () => {
    const { project } = runGenerateBundle(
      wallpaperEnginePlugin({
        title: "T",
        properties: {
          precise: sliderProperty({
            text: "Precise",
            value: 0.5,
            min: 0,
            max: 1,
            fraction: true,
            precision: 3,
          }),
          stepped: sliderProperty({
            text: "Stepped",
            value: 0.5,
            min: 0,
            max: 1,
            fraction: true,
            step: 0.05,
          }),
        },
      }),
    );
    expect(project.general.properties.precise.precision).toBe(3);
    expect(project.general.properties.precise.step).toBe(0.001);
    expect(project.general.properties.precise.steps).toBeUndefined();
    expect(project.general.properties.stepped.step).toBe(0.05);
  });

  it("emits native group markers in project.json", () => {
    const { project } = runGenerateBundle(
      wallpaperEnginePlugin({
        title: "T",
        properties: {
          appearance: groupProperty({ text: "Appearance" }),
          enabled: boolProperty({ text: "Enabled", value: true }),
        },
      }),
    );
    expect(project.general.properties.appearance).toEqual({
      index: 0,
      order: 0,
      text: "Appearance",
      type: "group",
      value: "",
    });
    expect(project.general.properties.enabled.index).toBe(1);
    expect(project.general.properties.enabled.order).toBe(1);
  });

  it("auto-assigns index and order to properties", () => {
    const { project } = runGenerateBundle(
      wallpaperEnginePlugin({
        title: "T",
        properties: {
          first: colorProperty({ text: "A", value: "0 0 0" }),
          second: sliderProperty({ text: "B", value: 1, min: 0, max: 10 }),
        },
      }),
    );
    expect(project.general.properties.first.index).toBe(0);
    expect(project.general.properties.first.order).toBe(0);
    expect(project.general.properties.second.index).toBe(1);
    expect(project.general.properties.second.order).toBe(1);
  });

  it("preserves explicit index / order on properties", () => {
    const { project } = runGenerateBundle(
      wallpaperEnginePlugin({
        title: "T",
        properties: {
          a: colorProperty({ text: "A", value: "0 0 0", index: 99, order: 42 }),
        },
      }),
    );
    // assignIndices spreads { index: i, order: i, ...prop }, so prop's values win
    expect(project.general.properties.a.index).toBe(99);
    expect(project.general.properties.a.order).toBe(42);
  });

  it("includes localization in the general block", () => {
    const { project } = runGenerateBundle(
      wallpaperEnginePlugin({
        title: "T",
        localization: { "en-us": { ui_foo: "Foo" } },
      }),
    );
    expect(project.general.localization["en-us"]["ui_foo"]).toBe("Foo");
  });

  it("outputs valid JSON", () => {
    const { source } = runGenerateBundle(
      wallpaperEnginePlugin({
        title: "T",
        properties: { c: colorProperty({ text: "C", value: "0 0 0" }) },
      }),
    );

    expect(() => JSON.parse(source)).not.toThrow();
  });
});

describe("wallpaperEnginePlugin devtools hooks", () => {
  beforeEach(() => {
    readFileSyncMock.mockClear();
    unwatchFileMock.mockClear();
    watchFileMock.mockClear();
  });

  it("only injects the devtools module while Vite is serving", () => {
    const plugin = wallpaperEnginePlugin({ title: "T" });
    if (typeof plugin.configResolved !== "function") {
      throw new Error("configResolved hook is not callable");
    }
    if (typeof plugin.transformIndexHtml !== "function") {
      throw new Error("transformIndexHtml hook is not callable");
    }

    plugin.configResolved.call({} as never, { command: "build" } as never);
    expect(
      plugin.transformIndexHtml.call({} as never, "", {} as never),
    ).toBeUndefined();

    plugin.configResolved.call({} as never, { command: "serve" } as never);
    expect(
      plugin.transformIndexHtml.call({} as never, "", {} as never),
    ).toEqual([
      {
        tag: "script",
        attrs: {
          type: "module",
          src: "/@id/virtual:wallpaper-engine/devtools",
        },
        injectTo: "head-prepend",
      },
    ]);
  });

  it("never injects devtools when explicitly disabled", () => {
    const plugin = wallpaperEnginePlugin({ title: "T", devtools: false });
    if (
      typeof plugin.configResolved !== "function" ||
      typeof plugin.transformIndexHtml !== "function"
    ) {
      throw new Error("plugin hooks are not callable");
    }

    plugin.configResolved.call({} as never, { command: "serve" } as never);

    expect(
      plugin.transformIndexHtml.call({} as never, "", {} as never),
    ).toBeUndefined();
  });

  it("resolves only its virtual module id", () => {
    const plugin = wallpaperEnginePlugin({ title: "T" });
    if (typeof plugin.resolveId !== "function") {
      throw new Error("resolveId hook is not callable");
    }

    expect(
      plugin.resolveId.call(
        {} as never,
        "virtual:wallpaper-engine/devtools",
        undefined,
        {} as never,
      ),
    ).toBe("\0virtual:wallpaper-engine/devtools");
    expect(
      plugin.resolveId.call({} as never, "other", undefined, {} as never),
    ).toBeNull();
  });

  it("loads injected config and caches the bundled devtools client", async () => {
    const plugin = wallpaperEnginePlugin({
      title: "Configured",
      properties: {
        mode: comboProperty({
          text: "Mode",
          value: "a",
          options: [{ label: "A", value: "a" }],
        }),
      },
      localization: { "en-us": { ui_mode: "Mode" } },
    });
    if (typeof plugin.load !== "function") {
      throw new Error("load hook is not callable");
    }

    expect(
      await plugin.load.call({} as never, "unrelated", {} as never),
    ).toBeNull();
    const first = await plugin.load.call(
      {} as never,
      "\0virtual:wallpaper-engine/devtools",
      {} as never,
    );
    const second = await plugin.load.call(
      {} as never,
      "\0virtual:wallpaper-engine/devtools",
      {} as never,
    );

    expect(first).toContain('window.__WE_DEVTOOLS_CONFIG__ = {\"title\":\"Configured\"');
    expect(first).toContain('\"mode\":{\"index\":0,\"order\":0,\"type\":\"combo\"');
    expect(first).toContain("globalThis.__DEVTOOLS_CLIENT_LOADED__ = true;");
    expect(second).toBe(first);
    expect(readFileSyncMock).toHaveBeenCalledOnce();
  });

  it("watches the bundled client, invalidates its module, and reloads the page", async () => {
    let onClientChange: (() => void) | undefined;
    let onServerClose: (() => void) | undefined;
    watchFileMock.mockImplementation((_path, _options, callback) => {
      onClientChange = callback;
    });
    const invalidateModule = vi.fn();
    const send = vi.fn();
    const plugin = wallpaperEnginePlugin({ title: "T" });
    if (typeof plugin.configureServer !== "function") {
      throw new Error("configureServer hook is not callable");
    }

    plugin.configureServer.call({} as never, {
      moduleGraph: {
        getModuleById: vi.fn(() => ({ id: "virtual" })),
        invalidateModule,
      },
      ws: { send },
      httpServer: {
        once: vi.fn((_event, callback) => {
          onServerClose = callback;
        }),
      },
    } as never);
    await vi.waitFor(() => expect(watchFileMock).toHaveBeenCalledOnce());

    onClientChange?.();
    expect(invalidateModule).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({ type: "full-reload" });

    onServerClose?.();
    expect(unwatchFileMock).toHaveBeenCalledOnce();
  });

  it("does not install a client watcher when devtools are disabled", () => {
    const plugin = wallpaperEnginePlugin({ title: "T", devtools: false });
    if (typeof plugin.configureServer !== "function") {
      throw new Error("configureServer hook is not callable");
    }

    plugin.configureServer.call({} as never, {} as never);

    expect(watchFileMock).not.toHaveBeenCalled();
  });
});
