// Runtime listener / event types
// Window global augmentation — import this file (or the package root) in your
// wallpaper entry file to get typed access to window.wallpaperPropertyListener,
// window.wallpaperRegisterAudioListener, etc.
import './types/window';

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
} from './types/listeners';

// Types for project.json structure
export type {
  WallpaperBoolProperty,
  WallpaperColorProperty,
  WallpaperComboOption,
  WallpaperComboProperty,
  WallpaperDirectoryProperty,
  WallpaperFileProperty,
  WallpaperFileType,
  WallpaperGroupProperty,
  WallpaperLocalization,
  WallpaperProject,
  WallpaperProjectGeneral,
  WallpaperProjectMetadata,
  WallpaperPropertyDefinition,
  WallpaperSliderProperty,
  WallpaperTextInputProperty,
} from './types/project';
