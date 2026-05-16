// Types for project.json structure
export type {
  WallpaperBoolProperty,
  WallpaperColorProperty,
  WallpaperComboOption,
  WallpaperComboProperty,
  WallpaperDirectoryProperty,
  WallpaperFileProperty,
  WallpaperFileType,
  WallpaperLocalization,
  WallpaperProject,
  WallpaperProjectGeneral,
  WallpaperPropertyDefinition,
  WallpaperSliderProperty,
  WallpaperTextInputProperty,
} from "./types/project";

// Runtime listener / event types
export type {
  CueDeviceInfo,
  CueLedColor,
  CueLedPosition,
  CueProtocolDetails,
  WallpaperBoolValue,
  WallpaperColorValue,
  WallpaperComboValue,
  WallpaperCuePlugin,
  WallpaperDirectoryValue,
  WallpaperFileValue,
  WallpaperGeneralProperties,
  WallpaperLedPlugin,
  WallpaperMediaPlaybackEvent,
  WallpaperMediaPlaybackState,
  WallpaperMediaPropertiesEvent,
  WallpaperMediaStatusEvent,
  WallpaperMediaThumbnailEvent,
  WallpaperMediaTimelineEvent,
  WallpaperPluginListener,
  WallpaperPropertyListener,
  WallpaperPropertyRuntimeValue,
  WallpaperSliderValue,
  WallpaperTextValue,
  WallpaperUserProperties,
} from "./types/listeners";

export {
  PLAYBACK_PAUSED,
  PLAYBACK_PLAYING,
  PLAYBACK_STOPPED,
} from "./types/listeners";

// Window global augmentation — import this file (or the package root) in your
// wallpaper entry file to get typed access to window.wallpaperPropertyListener,
// window.wallpaperRegisterAudioListener, etc.
import "./types/window";
