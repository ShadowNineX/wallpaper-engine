/** File type accepted by file/directory properties */
export type WallpaperFileType = 'image' | 'video';

/**
 * Localization map inside `project.json`'s `general.localization`.
 * Outer key: BCP-47 language code (e.g. `"en-us"`, `"de-de"`, `"zh-chs"`).
 * Inner key: `ui_` token string. Value: translated display text.
 *
 * @example
 * {
 *   "en-us": { "ui_mycolor": "Background color" },
 *   "de-de": { "ui_mycolor": "Hintergrundfarbe" }
 * }
 */
export type WallpaperLocalization = Record<string, Record<string, string>>;

// ---------------------------------------------------------------------------
// Property definitions (as stored in project.json)
// ---------------------------------------------------------------------------

interface WallpaperPropertyBase {
  /** Display label shown in the properties panel, or a `ui_` token for localization */
  text: string;
  /** Sort index within the properties panel */
  order?: number;
  /** Internal sequential index (auto-assigned by the editor) */
  index?: number;
  /**
   * JavaScript expression evaluated to determine visibility.
   * References other property keys, e.g. `"showclock.value == true"`.
   */
  condition?: string;
}

/**
 * The stored and runtime value is `"R G B"` where each channel is in the
 * **0–1** range. {@link colorProperty} accepts Color.js-supported color syntax
 * and normalizes it to this representation.
 */
export interface WallpaperColorProperty extends WallpaperPropertyBase {
  type: 'color';
  /** Normalized sRGB default as `"R G B"` with channels in the 0–1 range. */
  value: string;
}

/**
 * Slider property. Lets users pick a number in a defined range.
 * Enable `fraction` for decimal values; `precision` constrains both the
 * displayed value and the effective `step`.
 */
export interface WallpaperSliderProperty extends WallpaperPropertyBase {
  type: 'slider';
  /** Default value — should be within `[min, max]`. */
  value: number;
  min: number;
  max: number;
  /** Allow fractional (decimal) values. */
  fraction?: boolean;
  /**
   * Number of decimal places Wallpaper Engine keeps for fractional values.
   * When omitted, Wallpaper Engine currently behaves as though this were `1`.
   */
  precision?: number;
  /**
   * Requested numeric increment. Wallpaper Engine normalizes it to
   * `precision`; when omitted, {@link sliderProperty} derives it from an
   * explicitly provided `precision`.
   */
  step?: number;
}

/** Checkbox (on/off toggle) property. */
export interface WallpaperBoolProperty extends WallpaperPropertyBase {
  type: 'bool';
  /** Default checked state. */
  value: boolean;
}

export interface WallpaperComboOption {
  /** Human-readable label shown in the dropdown, or a `ui_` token */
  label: string;
  /** Hidden value passed to `applyUserProperties` */
  value: string;
}

export interface WallpaperComboProperty extends WallpaperPropertyBase {
  type: 'combo';
  /** Key of the default selected option */
  value: string;
  options: WallpaperComboOption[];
}

/** Free-text input property. */
export interface WallpaperTextInputProperty extends WallpaperPropertyBase {
  type: 'textinput';
  /** Default text value. */
  value: string;
}

/**
 * File selector property. Lets users import a single image or video file.
 * The runtime `value` path must be prefixed with `"file:///"` before use as a URL.
 */
export interface WallpaperFileProperty extends WallpaperPropertyBase {
  type: 'file';
  /** Default file path (empty string = no file selected). */
  value: string;
  fileType?: WallpaperFileType;
}

/**
 * Directory selector for mass-importing image or video files.
 * Choose between `"ondemand"` (one random file at a time via
 * `wallpaperRequestRandomFileForProperty`) and `"fetchall"` (all files
 * surfaced via `userDirectoryFilesAddedOrChanged` / `userDirectoryFilesRemoved`).
 */
export interface WallpaperDirectoryProperty extends WallpaperPropertyBase {
  type: 'directory';
  /** Default directory path (empty string = no directory selected). */
  value: string;
  fileType?: WallpaperFileType;
  /**
   * - `"ondemand"` — call `wallpaperRequestRandomFileForProperty` to get a file.
   * - `"fetchall"` — all files are surfaced via `userDirectoryFilesAddedOrChanged`.
   */
  mode: 'ondemand' | 'fetchall';
}

/**
 * Collapsible section marker in Wallpaper Engine's property list.
 * Every following property belongs to this group until the next group marker.
 * Group markers are layout metadata and are not delivered to
 * `applyUserProperties`.
 *
 * @example
 * {
 *   type: "group",
 *   text: "Appearance",
 *   value: "",
 * }
 */
export interface WallpaperGroupProperty extends WallpaperPropertyBase {
  type: 'group';
  value: '';
}

/** Union of all property definition types stored in `project.json`. */
export type WallpaperPropertyDefinition
  = | WallpaperColorProperty
    | WallpaperSliderProperty
    | WallpaperBoolProperty
    | WallpaperComboProperty
    | WallpaperTextInputProperty
    | WallpaperFileProperty
    | WallpaperGroupProperty
    | WallpaperDirectoryProperty;

// ---------------------------------------------------------------------------
// project.json structure
// ---------------------------------------------------------------------------

/** The `general` block inside `project.json`. */
export interface WallpaperProjectGeneral {
  properties?: Record<string, WallpaperPropertyDefinition>;
  localization?: WallpaperLocalization;
  /**
   * Set to `true` to enable audio data delivery. The Vite plugin detects
   * direct `wallpaperRegisterAudioListener` calls automatically.
   */
  supportsaudioprocessing?: boolean;
}

/**
 * Author-owned publishing metadata stored at the top level of `project.json`.
 *
 * Serialized rating and visibility values are intentionally left as strings
 * because Wallpaper Engine does not publish their complete JSON domains.
 *
 * @example
 * const metadata: WallpaperProjectMetadata = {
 *   description: 'An animated night sky.',
 *   preview: 'preview.jpg',
 *   tags: ['Landscape'],
 * };
 */
export interface WallpaperProjectMetadata {
  /** Workshop description shown alongside the wallpaper. */
  description?: string;
  /** Project-relative path to the Workshop preview image. */
  preview?: string;
  /** Workshop tags selected by the author. */
  tags?: string[];
  /** Wallpaper Engine's serialized general content rating. */
  contentrating?: string;
  /** Wallpaper Engine's serialized sexual-content rating. */
  ratingsex?: string;
  /** Wallpaper Engine's serialized violence rating. */
  ratingviolence?: string;
  /** Wallpaper Engine's serialized Workshop visibility. */
  visibility?: string;
}

/**
 * Full shape of the author-controlled `project.json` fields generated by
 * Wallpaper Engine.
 *
 * @example
 * const project: WallpaperProject = {
 *   file: 'index.html',
 *   title: 'Night Sky',
 *   type: 'web',
 *   description: 'An animated night sky.',
 * };
 */
export interface WallpaperProject extends WallpaperProjectMetadata {
  /** Entry HTML file name relative to the project directory */
  file: string;
  /** Wallpaper title shown in the Wallpaper Engine UI */
  title: string;
  type: 'web';
  general?: WallpaperProjectGeneral;
}
