import type { Plugin } from "vite";
import type {
  WallpaperBoolValue,
  WallpaperColorValue,
  WallpaperComboValue,
  WallpaperDirectoryValue,
  WallpaperFileValue,
  WallpaperSliderValue,
  WallpaperTextValue,
} from "../types/listeners";
import type {
  WallpaperBoolProperty,
  WallpaperColorProperty,
  WallpaperComboProperty,
  WallpaperDirectoryProperty,
  WallpaperFileProperty,
  WallpaperGroupProperty,
  WallpaperLocalization,
  WallpaperProject,
  WallpaperProjectGeneral,
  WallpaperPropertyDefinition,
  WallpaperSliderProperty,
  WallpaperTextInputProperty,
} from "../types/project";
import { colorToWallpaperColor } from "../color";

export type {
  WallpaperBoolProperty,
  WallpaperColorProperty,
  WallpaperComboProperty,
  WallpaperDirectoryProperty,
  WallpaperFileProperty,
  WallpaperGroupProperty,
  WallpaperLocalization,
  WallpaperProject,
  WallpaperProjectGeneral,
  WallpaperPropertyDefinition,
  WallpaperSliderProperty,
  WallpaperTextInputProperty,
};
export type { WallpaperComboOption, WallpaperFileType } from "../types/project";

// ---------------------------------------------------------------------------
// Property builder helpers
// ---------------------------------------------------------------------------

type Without<T, K extends keyof T> = Omit<T, K>;

/**
 * Define a color property from any color syntax supported by Color.js.
 *
 * CSS named colors, hex, `rgb()`, `hsl()`, `hwb()`, Lab, LCH, OKLab, OKLCH,
 * wide-gamut `color()` values, and Wallpaper Engine's native `"R G B"` format
 * are normalized to the 0–1 sRGB channels required by `project.json`.
 *
 * @example
 * colorProperty({ text: "Accent", value: "hsl(120 100% 50%)" });
 * // → { type: "color", text: "Accent", value: "0 1 0" }
 */
export function colorProperty(
  opts: Without<WallpaperColorProperty, "type">,
): WallpaperColorProperty {
  return {
    type: "color",
    ...opts,
    value: colorToWallpaperColor(opts.value),
  };
}

/**
 * Define a numeric slider property.
 *
 * Wallpaper Engine normalizes `step` to the configured `precision`. When
 * `precision` is omitted, it currently behaves as `precision: 1` and
 * `step: 0.1`, so finer custom steps must include a matching precision. When
 * only `precision` is supplied, this builder derives `step` as
 * `10 ** -precision`; an explicit `step` is emitted unchanged.
 *
 * @example
 * sliderProperty({
 *   text: "Opacity",
 *   value: 0.5,
 *   min: 0,
 *   max: 1,
 *   fraction: true,
 *   precision: 3,
 * }); // step: 0.001
 */
export function sliderProperty(
  opts: Without<WallpaperSliderProperty, "type">,
): WallpaperSliderProperty {
  const property: WallpaperSliderProperty = { type: "slider", ...opts };
  if (property.step === undefined && property.precision !== undefined) {
    property.step = 10 ** -property.precision;
  }
  return property;
}

/** Define a boolean checkbox property */
export function boolProperty(
  opts: Without<WallpaperBoolProperty, "type">,
): WallpaperBoolProperty {
  return { type: "bool", ...opts };
}

/** Define a dropdown (combo) property */
export function comboProperty(
  opts: Without<WallpaperComboProperty, "type">,
): WallpaperComboProperty {
  return { type: "combo", ...opts };
}

/** Define a text input property */
export function textInputProperty(
  opts: Without<WallpaperTextInputProperty, "type">,
): WallpaperTextInputProperty {
  return { type: "textinput", ...opts };
}

/** Define a file picker property */
export function fileProperty(
  opts: Without<WallpaperFileProperty, "type">,
): WallpaperFileProperty {
  return { type: "file", ...opts };
}

/** Define a directory picker property */
export function directoryProperty(
  opts: Without<WallpaperDirectoryProperty, "type">,
): WallpaperDirectoryProperty {
  return { type: "directory", ...opts };
}

/**
 * Define a collapsible property group marker.
 *
 * Properties after this marker belong to the group until the next marker.
 * The marker itself has no runtime value in `applyUserProperties`.
 *
 * @example
 * const properties = {
 *   appearance: groupProperty({ text: "Appearance" }),
 *   background: colorProperty({ text: "Background", value: "0 0 0" }),
 * };
 */
export function groupProperty(
  opts: Without<WallpaperGroupProperty, "type" | "value">,
): WallpaperGroupProperty {
  return { ...opts, type: "group", value: "" };
}

// ---------------------------------------------------------------------------
// Property definition → runtime value type mapping
// ---------------------------------------------------------------------------

/**
 * Maps a single property **definition** type to its **runtime value** type.
 *
 * Useful for building generic helpers that operate on any property kind.
 *
 * @example
 * type T = PropertyDefinitionToValue<WallpaperColorProperty>;
 * // → WallpaperColorValue
 */
export type PropertyDefinitionToValue<T extends WallpaperPropertyDefinition> =
  T extends { type: "color" }
    ? WallpaperColorValue
    : T extends { type: "slider" }
      ? WallpaperSliderValue
      : T extends { type: "bool" }
        ? WallpaperBoolValue
        : T extends { type: "combo" }
          ? WallpaperComboValue
          : T extends { type: "textinput" }
            ? WallpaperTextValue
            : T extends { type: "file" }
              ? WallpaperFileValue
              : T extends { type: "directory" }
                ? WallpaperDirectoryValue
                : never;

/**
 * Infer the strongly-typed `applyUserProperties` argument from a property
 * definition record. Define your properties once in a shared file, then pass
 * `typeof yourProperties` here to get full autocomplete on every property key
 * and its value type.
 *
 * @example
 * // properties.ts — shared between vite.config.ts and wallpaper source
 * import { colorProperty, sliderProperty } from 'wallpaper-engine/plugin';
 *
 * export const myProperties = {
 *   bgcolor: colorProperty({ text: 'Background Color', value: '0 0 0' }),
 *   speed:   sliderProperty({ text: 'Speed', value: 1, min: 0, max: 5 }),
 * };
 *
 * // vite.config.ts
 * import { wallpaperEnginePlugin } from 'wallpaper-engine/plugin';
 * import { myProperties } from './properties';
 *
 * export default defineConfig({
 *   plugins: [wallpaperEnginePlugin({ title: 'My Wallpaper', properties: myProperties })],
 * });
 *
 * // wallpaper.ts
 * import type { WallpaperUserPropertiesOf } from 'wallpaper-engine/plugin';
 * import type { myProperties } from './properties';
 *
 * type MyProps = WallpaperUserPropertiesOf<typeof myProperties>;
 * // → { bgcolor: WallpaperColorValue; speed: WallpaperSliderValue }
 *
 * window.wallpaperPropertyListener = {
 *   applyUserProperties(props: Partial<MyProps>) {
 *     if (props.bgcolor) el.style.background = wallpaperColorToRgb(props.bgcolor.value);
 *     if (props.speed !== undefined) setSpeed(props.speed.value); // number ✓
 *   },
 * };
 */
export type WallpaperUserPropertiesOf<
  T extends Record<string, WallpaperPropertyDefinition>,
> = {
  readonly [K in keyof T as T[K] extends { type: "group" }
    ? never
    : K]: PropertyDefinitionToValue<T[K]>;
};

// ---------------------------------------------------------------------------
// Vite plugin
// ---------------------------------------------------------------------------

export interface WallpaperEnginePluginOptions {
  /**
   * Entry HTML file name relative to the project root.
   * @default "index.html"
   */
  file?: string;
  /** Wallpaper title shown in the Wallpaper Engine UI */
  title: string;
  /**
   * Emit `project.json` without indentation or line breaks. Defaults to
   * enabled for production builds and disabled during development.
   *
   * @default `true` for build, `false` for dev
   * @example
   * minify: false
   */
  minify?: boolean;
  /**
   * Override automatic audio-listener detection.
   *
   * By default, production JavaScript and HTML are scanned for calls to
   * `wallpaperRegisterAudioListener`. Set this to `true` to always enable
   * audio processing or `false` to explicitly disable it.
   */
  supportsAudioProcessing?: boolean;
  /**
   * User-configurable properties exposed in the Wallpaper Engine properties panel.
   * Keys become the property identifiers accessed in `applyUserProperties`.
   *
   * @example
   * properties: {
   *   bgcolor: colorProperty({ text: 'Background Color', value: '0 0 0' }),
   *   speed:   sliderProperty({ text: 'Speed', value: 1, min: 0, max: 5 }),
   * }
   */
  properties?: Record<string, WallpaperPropertyDefinition>;
  /**
   * Localization strings for property labels and combo option labels.
   * Keys are BCP 47 language codes (e.g. `"en-us"`, `"de-de"`, `"zh-chs"`).
   * Property labels that should be translated must start with `ui_`.
   *
   * @example
   * localization: {
   *   'en-us': { 'ui_bgcolor': 'Background Color' },
   *   'de-de': { 'ui_bgcolor': 'Hintergrundfarbe' },
   * }
   */
  localization?: WallpaperLocalization;
  /**
   * Enable the in-browser dev overlay during `vite dev`. The overlay stubs
   * every `window.wallpaper*` global, renders a draggable panel to edit each
   * property in real time, and lets you fire audio/media/plugin events
   * manually — so wallpapers can be developed without round-tripping through
   * the Wallpaper Engine host application.
   *
   * Disabled automatically for production builds regardless of this setting.
   *
   * @default true
   */
  devtools?: boolean;
}

/**
 * Vite plugin that auto-generates `project.json` into the build output.
 *
 * @example
 * // vite.config.ts
 * import { wallpaperEnginePlugin, colorProperty } from 'wallpaper-engine/plugin';
 *
 * export default defineConfig({
 *   plugins: [
 *     wallpaperEnginePlugin({
 *       title: 'My Wallpaper',
 *       properties: {
 *         bgcolor: colorProperty({ text: 'Background Color', value: '0 0 0' }),
 *       },
 *     }),
 *   ],
 * });
 */
export function wallpaperEnginePlugin(
  options: WallpaperEnginePluginOptions,
): Plugin {
  const devtoolsEnabled = options.devtools !== false;
  const VIRTUAL_ID = "virtual:wallpaper-engine/devtools";
  const RESOLVED_ID = "\0" + VIRTUAL_ID;
  let isServe = false;
  let cachedClientCode: Promise<string> | undefined;
  const loadClientCode = (): Promise<string> => {
    cachedClientCode ??= (async () => {
      // Reads the bundled Vue UI asynchronously. Dynamic imports keep this
      // entry browser-safe when consumers import only its property builders.
      const [{ readFile }, { fileURLToPath }] = await Promise.all([
        import(/* @vite-ignore */ "node:fs/promises"),
        import(/* @vite-ignore */ "node:url"),
      ]);
      const url = new URL("./devtools/client.js", import.meta.url);
      return readFile(fileURLToPath(url), "utf8");
    })();
    return cachedClientCode;
  };

  return {
    name: "wallpaper-engine",

    configResolved(config) {
      isServe = config.command === "serve";
    },

    async configureServer(server) {
      if (!devtoolsEnabled) return;
      const [fs, { fileURLToPath }] = await Promise.all([
        import(/* @vite-ignore */ "node:fs"),
        import(/* @vite-ignore */ "node:url"),
      ]);
      const clientPath = fileURLToPath(
        new URL("./devtools/client.js", import.meta.url),
      );
      // Use stat-polling watchFile instead of chokidar: avoids Windows
      // path-normalisation mismatches (forward vs back slashes) and works
      // correctly across Bun workspace symlinks.
      fs.watchFile(clientPath, { interval: 500 }, () => {
        cachedClientCode = undefined;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      });
      server.httpServer?.once("close", () => {
        fs.unwatchFile(clientPath);
      });
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },

    async load(id) {
      if (id !== RESOLVED_ID) return null;
      const properties = options.properties
        ? assignIndices(options.properties)
        : {};
      const cfg = {
        title: options.title,
        properties,
        localization: options.localization ?? {},
      };
      return (
        "window.__WE_DEVTOOLS_CONFIG__ = " +
        JSON.stringify(cfg) +
        ";\n" +
        (await loadClientCode())
      );
    },

    transformIndexHtml() {
      if (!isServe || !devtoolsEnabled) return;
      return [
        {
          tag: "script",
          attrs: { type: "module", src: "/@id/" + VIRTUAL_ID },
          injectTo: "head-prepend",
        },
      ];
    },

    generateBundle(_outputOptions, bundle) {
      const properties = options.properties
        ? assignIndices(options.properties)
        : undefined;

      const general: WallpaperProjectGeneral = {};
      if (properties) general.properties = properties;
      if (options.localization) general.localization = options.localization;
      if (
        options.supportsAudioProcessing ??
        Object.values(bundle).some(bundleOutputRegistersAudioListener)
      ) {
        general.supportsaudioprocessing = true;
      }

      const project: WallpaperProject = {
        file: options.file ?? "index.html",
        title: options.title,
        type: "web",
      };

      if (Object.keys(general).length > 0) {
        project.general = general;
      }

      this.emitFile({
        type: "asset",
        fileName: "project.json",
        source:
          (options.minify ?? !isServe)
            ? JSON.stringify(project)
            : JSON.stringify(project, null, "\t"),
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type BundleOutput =
  | { type: "chunk"; code: string }
  | { type: "asset"; fileName: string; source: string | Uint8Array };

const AUDIO_LISTENER_CALLS = [
  /\bwallpaperRegisterAudioListener\s*(?:\?\.)?\s*\(/,
  /\b(?:window|globalThis)\s*\[\s*["']wallpaperRegisterAudioListener["']\s*\]\s*(?:\?\.)?\s*\(/,
] as const;

function bundleOutputRegistersAudioListener(output: BundleOutput): boolean {
  if (output.type === "chunk") {
    return AUDIO_LISTENER_CALLS.some((pattern) => pattern.test(output.code));
  }

  if (!/\.(?:[cm]?js|html?)$/i.test(output.fileName)) return false;
  const source =
    typeof output.source === "string"
      ? output.source
      : new TextDecoder().decode(output.source);
  return AUDIO_LISTENER_CALLS.some((pattern) => pattern.test(source));
}

/**
 * Auto-assigns `index` and `order` to any properties that don't already have
 * them, based on their insertion order in the record.
 */
function assignIndices(
  properties: Record<string, WallpaperPropertyDefinition>,
): Record<string, WallpaperPropertyDefinition> {
  const result: Record<string, WallpaperPropertyDefinition> = {};
  let i = 0;

  for (const [key, prop] of Object.entries(properties)) {
    result[key] = {
      index: i,
      order: i,
      ...prop,
    };
    i++;
  }

  return result;
}
