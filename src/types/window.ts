import type {
  WallpaperCuePlugin,
  WallpaperLedPlugin,
  WallpaperMediaPlaybackEvent,
  WallpaperMediaPlaybackState,
  WallpaperMediaPropertiesEvent,
  WallpaperMediaStatusEvent,
  WallpaperMediaThumbnailEvent,
  WallpaperMediaTimelineEvent,
  WallpaperPluginListener,
  WallpaperPropertyListener,
} from "./listeners";

declare global {
  interface Window {
    // -------------------------------------------------------------------------
    // Property listener
    // -------------------------------------------------------------------------

    /**
     * Assign this object to receive property change events.
     * Must be set as a global — not inside `window.onload` or similar events.
     *
     * @example
     * window.wallpaperPropertyListener = {
     *   applyUserProperties(properties) {
     *     if (properties.mycolor) { ... }
     *   },
     * };
     */
    wallpaperPropertyListener?: WallpaperPropertyListener;

    // -------------------------------------------------------------------------
    // Audio visualization
    // -------------------------------------------------------------------------

    /**
     * Register a callback that receives 128 audio volume samples (~30 fps).
     * - Indices 0–63: left channel (bass → treble)
     * - Indices 64–127: right channel (bass → treble)
     * Each value is 0.0–1.0 (may occasionally exceed 1.0 — clamp with `Math.min`).
     *
     * @example
     * window.wallpaperRegisterAudioListener((audioArray) => { ... });
     */
    wallpaperRegisterAudioListener(
      callback: (audioArray: number[]) => void,
    ): void;

    // -------------------------------------------------------------------------
    // Directory property helpers
    // -------------------------------------------------------------------------

    /**
     * Request a random file path from an `ondemand` directory property.
     *
     * @param propertyName - The key of the directory property.
     * @param callback - Receives the property name and the file path.
     *   Prepend `"file:///"` to the path before using it as a URL.
     *
     * @example
     * window.wallpaperRequestRandomFileForProperty('mybg', (name, filePath) => {
     *   img.src = 'file:///' + filePath;
     * });
     */
    wallpaperRequestRandomFileForProperty(
      propertyName: string,
      callback: (propertyName: string, filePath: string) => void,
    ): void;

    // -------------------------------------------------------------------------
    // Plugin listener (LED / iCUE)
    // -------------------------------------------------------------------------

    /**
     * Assign this object to detect when plugins (LED, CUE) are loaded.
     * Check `name === "led"` or `name === "cue"` inside `onPluginLoaded`.
     */
    wallpaperPluginListener?: WallpaperPluginListener;

    /**
     * Provides access to LED and iCUE plugin APIs after the respective plugin
     * has loaded (see `wallpaperPluginListener`).
     */
    wpPlugins: {
      led: WallpaperLedPlugin;
    };

    // -------------------------------------------------------------------------
    // Media integration
    // -------------------------------------------------------------------------

    /**
     * Fired when the user enables/disables media integration in app settings.
     * Register at the bottom of `<body>`, not inside `window.onload`.
     */
    wallpaperRegisterMediaStatusListener(
      callback: (event: WallpaperMediaStatusEvent) => void,
    ): void;

    /**
     * Fired when track title, artist, album, or content type changes.
     */
    wallpaperRegisterMediaPropertiesListener(
      callback: (event: WallpaperMediaPropertiesEvent) => void,
    ): void;

    /**
     * Fired when the album art thumbnail changes.
     * `event.thumbnail` is a base64 PNG string usable as `img.src`.
     */
    wallpaperRegisterMediaThumbnailListener(
      callback: (event: WallpaperMediaThumbnailEvent) => void,
    ): void;

    /**
     * Fired when playback starts, pauses, or stops.
     * Compare `event.state` against `window.wallpaperMediaIntegration` constants.
     */
    wallpaperRegisterMediaPlaybackListener(
      callback: (event: WallpaperMediaPlaybackEvent) => void,
    ): void;

    /**
     * Fired when the track position changes.
     * Not all media players support this — ensure your wallpaper works without it.
     */
    wallpaperRegisterMediaTimelineListener(
      callback: (event: WallpaperMediaTimelineEvent) => void,
    ): void;

    /** Playback state constants for use with `WallpaperMediaPlaybackEvent.state` */
    wallpaperMediaIntegration: {
      PLAYBACK_PLAYING: WallpaperMediaPlaybackState;
      PLAYBACK_PAUSED: WallpaperMediaPlaybackState;
      PLAYBACK_STOPPED: WallpaperMediaPlaybackState;
    };

    // -------------------------------------------------------------------------
    // Corsair iCUE (advanced, rarely needed)
    // -------------------------------------------------------------------------

    /**
     * Direct Corsair iCUE SDK access. Only available when the `"cue"` plugin
     * has loaded (check via `wallpaperPluginListener.onPluginLoaded`).
     */
    cue: WallpaperCuePlugin;
  }

  // Expose the same properties on globalThis so `globalThis.xxx` works
  // without needing the `window` identifier (preferred by some linters).
  var wallpaperPropertyListener: WallpaperPropertyListener | undefined;
  var wallpaperPluginListener: WallpaperPluginListener | undefined;
  var wpPlugins: { led: WallpaperLedPlugin };
  var wallpaperMediaIntegration: {
    PLAYBACK_PLAYING: WallpaperMediaPlaybackState;
    PLAYBACK_PAUSED: WallpaperMediaPlaybackState;
    PLAYBACK_STOPPED: WallpaperMediaPlaybackState;
  };
  var cue: WallpaperCuePlugin;
  function wallpaperRegisterAudioListener(
    callback: (audioArray: number[]) => void,
  ): void;
  function wallpaperRequestRandomFileForProperty(
    propertyName: string,
    callback: (propertyName: string, filePath: string) => void,
  ): void;
  function wallpaperRegisterMediaStatusListener(
    callback: (event: WallpaperMediaStatusEvent) => void,
  ): void;
  function wallpaperRegisterMediaPropertiesListener(
    callback: (event: WallpaperMediaPropertiesEvent) => void,
  ): void;
  function wallpaperRegisterMediaThumbnailListener(
    callback: (event: WallpaperMediaThumbnailEvent) => void,
  ): void;
  function wallpaperRegisterMediaPlaybackListener(
    callback: (event: WallpaperMediaPlaybackEvent) => void,
  ): void;
  function wallpaperRegisterMediaTimelineListener(
    callback: (event: WallpaperMediaTimelineEvent) => void,
  ): void;
}
