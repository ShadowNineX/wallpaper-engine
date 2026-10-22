import type {
  WallpaperBoolProperty,
  WallpaperColorProperty,
  WallpaperSliderProperty,
} from './project';

/**
 * Built-in Wallpaper Engine property definitions. Audio recording is only
 * delivered when the wallpaper supports audio processing.
 *
 * @example
 * import type { DefaultWEProps } from 'wallpaper-engine';
 * type SchemeColor = DefaultWEProps['schemecolor'];
 */
export interface DefaultWEProps {
  audioprocessing?: WallpaperBoolProperty;
  schemecolor: WallpaperColorProperty;
  alignmentfliph: WallpaperBoolProperty;
  wec_e: WallpaperBoolProperty;
  wec_brs: WallpaperSliderProperty;
  wec_con: WallpaperSliderProperty;
  wec_sa: WallpaperSliderProperty;
  wec_hue: WallpaperSliderProperty;
}
