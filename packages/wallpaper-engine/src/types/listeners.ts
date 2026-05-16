// ---------------------------------------------------------------------------
// Runtime property values (received inside applyUserProperties)
// ---------------------------------------------------------------------------

/**
 * Runtime value of a color property.
 * `value` is `"R G B"` where each channel is in the **0–1** range.
 * Multiply by 255 to convert for CSS `rgb()`.
 *
 * @example
 * const [r, g, b] = props.myColor.value.split(' ').map(c => Math.ceil(+c * 255));
 * el.style.color = `rgb(${r},${g},${b})`;
 */
export interface WallpaperColorValue {
  /** Color string `"R G B"` — each channel 0.0–1.0. */
  value: string;
}

/** Runtime value of a slider property. */
export interface WallpaperSliderValue {
  value: number;
}

/** Runtime value of a checkbox (`bool`) property. */
export interface WallpaperBoolValue {
  value: boolean;
}

/**
 * Runtime value of a combo (dropdown) property.
 * `value` is the hidden key configured in the editor;
 * `text` is the visible display label.
 */
export interface WallpaperComboValue {
  /** The hidden value configured on the combo option. */
  value: string;
  /** Display label of the selected option (may be a `ui_` localization token). */
  text: string;
}

/** Runtime value of a text-input property. */
export interface WallpaperTextValue {
  value: string;
}

/**
 * Runtime value of a file property.
 * Prepend `"file:///"` to `value` before using it as a URL.
 *
 * @example
 * img.src = 'file:///' + props.myImage.value;
 */
export interface WallpaperFileValue {
  /** File path — prepend `"file:///"` before use as a URL. */
  value: string;
}

/**
 * Runtime value of a directory property in `ondemand` mode.
 * An empty string means no directory is currently selected.
 * Call `wallpaperRequestRandomFileForProperty` to retrieve a random file.
 */
export interface WallpaperDirectoryValue {
  /** Directory path, or empty string when no directory is selected. */
  value: string;
}

/** Union of all possible runtime property values delivered by `applyUserProperties`. */
export type WallpaperPropertyRuntimeValue =
  | WallpaperColorValue
  | WallpaperSliderValue
  | WallpaperBoolValue
  | WallpaperComboValue
  | WallpaperTextValue
  | WallpaperFileValue
  | WallpaperDirectoryValue;

/**
 * Map of property key → current runtime value passed to
 * `wallpaperPropertyListener.applyUserProperties`.
 * On first load all properties are present; on subsequent calls only the
 * changed ones are included — always guard with `if (properties.key)`.
 */
export type WallpaperUserProperties = Record<
  string,
  WallpaperPropertyRuntimeValue
>;

/** App-level settings delivered by `wallpaperPropertyListener.applyGeneralProperties`. */
export interface WallpaperGeneralProperties {
  /** Current FPS limit set by the user in Wallpaper Engine settings. `0` = unlimited. */
  fps?: number;
}

// ---------------------------------------------------------------------------
// wallpaperPropertyListener
// ---------------------------------------------------------------------------

/**
 * Assign to `window.wallpaperPropertyListener` to receive property and
 * app-settings updates. **Must be a top-level global** — never assign inside
 * `window.onload` or other events, or startup events may be missed.
 *
 * @example
 * window.wallpaperPropertyListener = {
 *   applyUserProperties(properties) {
 *     if (properties.mycolor) { ... }
 *   },
 * };
 */
export interface WallpaperPropertyListener {
  /**
   * Called once on wallpaper load (with all user properties) and again
   * whenever the user changes a property. Only changed properties are
   * included on subsequent calls — always guard with `if (properties.key)`.
   */
  applyUserProperties?: (properties: WallpaperUserProperties) => void;
  /**
   * Called on load and whenever the user changes app-level settings
   * such as the FPS limit. See {@link WallpaperGeneralProperties}.
   */
  applyGeneralProperties?: (properties: WallpaperGeneralProperties) => void;
  /**
   * Called for `directory` properties in `fetchall` mode when files are
   * added or modified in the selected directory. Prepend `"file:///"` to
   * each path before using it as a URL.
   */
  userDirectoryFilesAddedOrChanged?: (
    propertyName: string,
    changedFiles: string[],
  ) => void;
  /**
   * Called for `directory` properties in `fetchall` mode when files are
   * removed from the selected directory.
   */
  userDirectoryFilesRemoved?: (
    propertyName: string,
    removedFiles: string[],
  ) => void;
}

// ---------------------------------------------------------------------------
// wallpaperPluginListener
// ---------------------------------------------------------------------------

/**
 * Assign to `window.wallpaperPluginListener` to detect when RGB plugins load.
 * Check `name` to distinguish `"led"` (all RGB hardware via `wpPlugins.led`)
 * from `"cue"` (Corsair iCUE direct SDK, only needed for advanced features).
 *
 * @example
 * window.wallpaperPluginListener = {
 *   onPluginLoaded(name, version) {
 *     if (name === 'led') { // general RGB hardware ready
 *     }
 *     if (name === 'cue') { // Corsair iCUE SDK ready
 *     }
 *   },
 * };
 */
export interface WallpaperPluginListener {
  /**
   * Fired when a plugin finishes loading.
   * @param name    - `"led"` for general RGB hardware or `"cue"` for Corsair iCUE.
   * @param version - Plugin version string.
   */
  onPluginLoaded?: (name: string, version: string) => void;
}

// ---------------------------------------------------------------------------
// Media integration events
// ---------------------------------------------------------------------------

/**
 * Event fired by `wallpaperRegisterMediaStatusListener` when the user enables
 * or disables media integration in the Wallpaper Engine app settings.
 */
export interface WallpaperMediaStatusEvent {
  /** `true` when media integration is active; `false` when disabled. */
  enabled: boolean;
}

/**
 * Event fired by `wallpaperRegisterMediaPropertiesListener` when the
 * currently playing track's metadata changes (title, artist, album, etc.).
 */
export interface WallpaperMediaPropertiesEvent {
  /** Title of the currently playing media. */
  title: string;
  /** Artist of the currently playing media. */
  artist: string;
  /** Optional sub-title (e.g. episode name for podcasts). */
  subTitle?: string;
  /** Optional album title. */
  albumTitle?: string;
  /** Optional album artist (may differ from `artist`). */
  albumArtist?: string;
  /** Optional comma-separated list of genres. */
  genres?: string;
  /** Media type: `"music"`, `"video"`, or `"image"`. */
  contentType: "music" | "video" | "image";
}

/**
 * Event fired by `wallpaperRegisterMediaThumbnailListener` when album art changes.
 * Assign `event.thumbnail` directly to `img.src`.
 *
 * @example
 * window.wallpaperRegisterMediaThumbnailListener((e) => {
 *   document.getElementById('cover').src = e.thumbnail;
 *   document.body.style.background = e.primaryColor;
 *   titleEl.style.color = e.textColor;
 * });
 */
export interface WallpaperMediaThumbnailEvent {
  /** Base64-encoded PNG of the album art — usable directly as `img.src`. */
  thumbnail: string;
  /** Dominant color extracted from the thumbnail. */
  primaryColor: string;
  /** Secondary color from the thumbnail palette. */
  secondaryColor: string;
  /** Tertiary color from the thumbnail palette. */
  tertiaryColor: string;
  /**
   * Text color guaranteed to contrast sufficiently against `primaryColor`.
   * May be `secondaryColor` or `tertiaryColor` when the contrast is sufficient.
   */
  textColor: string;
  /** Either black or white — whichever contrasts more against `primaryColor`. */
  highContrastColor: string;
}

/** Media is actively playing on the system. */
export const PLAYBACK_PLAYING = 0 as const;
/** Media was playing but has been temporarily paused by the user. */
export const PLAYBACK_PAUSED = 1 as const;
/** Media playback is completely stopped. */
export const PLAYBACK_STOPPED = 2 as const;

/**
 * Numeric playback state for {@link WallpaperMediaPlaybackEvent}.
 * Compare against `window.wallpaperMediaIntegration.PLAYBACK_PLAYING` etc.
 * or the module-level constants {@link PLAYBACK_PLAYING}, {@link PLAYBACK_PAUSED},
 * {@link PLAYBACK_STOPPED}.
 */
export type WallpaperMediaPlaybackState =
  | typeof PLAYBACK_PLAYING
  | typeof PLAYBACK_PAUSED
  | typeof PLAYBACK_STOPPED;

/**
 * Event fired by `wallpaperRegisterMediaPlaybackListener` when playback
 * starts, pauses, or stops.
 */
export interface WallpaperMediaPlaybackEvent {
  /**
   * Current playback state. Compare against the `PLAYBACK_*` constants:
   * - `PLAYBACK_PLAYING` (`0`) — actively playing
   * - `PLAYBACK_PAUSED`  (`1`) — temporarily paused
   * - `PLAYBACK_STOPPED` (`2`) — playback stopped
   */
  state: WallpaperMediaPlaybackState;
}

/**
 * Event fired by `wallpaperRegisterMediaTimelineListener` when track position
 * changes. **Not all media players support this** — ensure your wallpaper
 * works correctly even if this listener is never called.
 */
export interface WallpaperMediaTimelineEvent {
  /** Current playback position in seconds. */
  position: number;
  /** Total track duration in seconds. */
  duration: number;
}

// ---------------------------------------------------------------------------
// Corsair iCUE SDK types (window.cue)
// ---------------------------------------------------------------------------

/** Returned by `window.cue.getProtocolDetails` */
export interface CueProtocolDetails {
  sdkVersion: string;
  serverVersion: string;
  sdkProtocolVersion: number;
  serverProtocolVersion: number;
  breakingChanges: boolean;
}

/** Returned by `window.cue.getDeviceInfo` — mirrors `CorsairDeviceInfo` in the C++ SDK */
export interface CueDeviceInfo {
  /** `CorsairDeviceType` enum value */
  type: number;
  /** Human-readable device model name */
  model: string;
  /** `CorsairPhysicalLayout` enum value */
  physicalLayout: number;
  /** `CorsairLogicalLayout` enum value */
  logicalLayout: number;
  /** Number of available LEDs on this device */
  ledCount: number;
  /** `CorsairDeviceCaps` bitmask */
  capsMask: number;
}

/** An entry in the array returned by `window.cue.getLedPositionsByDeviceIndex` */
export interface CueLedPosition {
  /** `CorsairLedId` as integer */
  ledId: number;
  /** `CorsairLedId` as string */
  ledIdName: string;
  /** Position in mm from the top of the device */
  top: number;
  /** Position in mm from the left of the device */
  left: number;
  width: number;
  height: number;
}

/** LED color entry used in `setLedsColorsAsync` / `setAllLedsColorsAsync` */
export interface CueLedColor {
  /** `CorsairLedId` as integer */
  ledId: number;
  r: number;
  g: number;
  b: number;
}

/**
 * Direct Corsair iCUE SDK access exposed as `window.cue`.
 * Only available after the `"cue"` plugin has loaded via `wallpaperPluginListener`.
 */
export interface WallpaperCuePlugin {
  /** Returns current iCUE SDK status and version info */
  getProtocolDetails(
    callback: (protocolDetails: CueProtocolDetails) => void,
  ): void;
  /** Returns the number of recognised iCUE-compatible devices */
  getDeviceCount(callback: (deviceCount: number) => void): void;
  /** Returns hardware details for a specific device by index */
  getDeviceInfo(
    deviceIndex: number,
    callback: (deviceInfo: CueDeviceInfo) => void,
  ): void;
  /** Returns all LED positions for a specific device */
  getLedPositionsByDeviceIndex(
    callback: (arrayOfLEDs: CueLedPosition[]) => void,
  ): void;
  /** Update specific LEDs by supplying an array of `CueLedColor` objects */
  setLedsColorsAsync(arrayOfLEDColors: CueLedColor[]): void;
  /** Set all LEDs on one or more devices to a single color */
  setAllLedsColorsAsync(
    deviceIndexOrArray: number | number[],
    LEDColor: CueLedColor,
  ): void;
  /**
   * Update device LEDs from an RGB bitmap string (same format as
   * `wpPlugins.led.setAllDevicesByImageData`, but targets specific devices).
   */
  setLedColorsByImageData(
    deviceIndexOrArray: number | number[],
    encodedImageData: string,
    width: number,
    height: number,
  ): void;
}

// ---------------------------------------------------------------------------
// RGB / LED plugin
// ---------------------------------------------------------------------------

export interface WallpaperLedPlugin {
  /**
   * Push concatenated RGB bytes (as a string) to all connected LED devices.
   * Use a small canvas (e.g. 100×20) and convert it with `getImageData` for
   * best performance.
   */
  setAllDevicesByImageData(
    encodedImageData: string,
    width: number,
    height: number,
  ): void;
}
