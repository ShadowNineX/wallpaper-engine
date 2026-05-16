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
  WallpaperLocalization,
  WallpaperProject,
  WallpaperProjectGeneral,
  WallpaperPropertyDefinition,
  WallpaperSliderProperty,
  WallpaperTextInputProperty,
} from "../types/project";

export type {
  WallpaperBoolProperty,
  WallpaperColorProperty,
  WallpaperComboProperty,
  WallpaperDirectoryProperty,
  WallpaperFileProperty,
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

/** Define a color property (value: `"R G B"` in 0–1 range) */
export function colorProperty(
  opts: Without<WallpaperColorProperty, "type">,
): WallpaperColorProperty {
  return { type: "color", ...opts };
}

/** Define a numeric slider property */
export function sliderProperty(
  opts: Without<WallpaperSliderProperty, "type">,
): WallpaperSliderProperty {
  return { type: "slider", ...opts };
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
  readonly [K in keyof T]: PropertyDefinitionToValue<T[K]>;
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
   * Enable audio data delivery to `wallpaperRegisterAudioListener`.
   * Wallpaper Engine can auto-detect this, but you can set it explicitly.
   * @default false
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
  return {
    name: "wallpaper-engine",

    generateBundle() {
      const properties = options.properties
        ? assignIndices(options.properties)
        : undefined;

      const general: WallpaperProjectGeneral = {};
      if (properties) general.properties = properties;
      if (options.localization) general.localization = options.localization;

      const project: WallpaperProject = {
        file: options.file ?? "index.html",
        title: options.title,
        type: "web",
      };

      if (options.supportsAudioProcessing) {
        project.supportsaudioprocessing = true;
      }

      if (Object.keys(general).length > 0) {
        project.general = general;
      }

      this.emitFile({
        type: "asset",
        fileName: "project.json",
        source: JSON.stringify(project, null, "\t"),
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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
