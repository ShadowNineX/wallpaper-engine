import type {
  WallpaperBoolProperty,
  WallpaperColorProperty,
  WallpaperDividerProperty,
  WallpaperSliderProperty,
} from './project';

/**
 * Built-in Wallpaper Engine property definitions. Audio recording is only
 * delivered when the wallpaper supports audio processing. The `_d0` divider
 * separates built-in controls from custom properties and has no editable value.
 *
 * @example
 * import type { DefaultWEPropertyDefinitions } from 'wallpaper-engine';
 * type SchemeColor = DefaultWEPropertyDefinitions['schemecolor'];
 */
export interface DefaultWEPropertyDefinitions {
  audioprocessing?: WallpaperBoolProperty;
  schemecolor: WallpaperColorProperty;
  alignmentfliph: WallpaperBoolProperty;
  wec_e: WallpaperBoolProperty;
  wec_brs: WallpaperSliderProperty;
  wec_con: WallpaperSliderProperty;
  wec_sa: WallpaperSliderProperty;
  wec_hue: WallpaperSliderProperty;
  _d0: WallpaperDividerProperty;
}
