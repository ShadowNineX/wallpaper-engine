import type {
  WallpaperBoolValue,
  WallpaperColorValue,
  WallpaperComboValue,
  WallpaperDirectoryValue,
  WallpaperFileValue,
  WallpaperPropertyListener,
  WallpaperSliderValue,
  WallpaperTextValue,
} from './listeners';
import type { WallpaperPropertyDefinition } from './project';

/** Maps a property definition to the value delivered by Wallpaper Engine. */
export type PropertyDefinitionToValue<T extends WallpaperPropertyDefinition>
  = T extends { type: 'color' }
    ? WallpaperColorValue
    : T extends { type: 'slider' }
      ? WallpaperSliderValue
      : T extends { type: 'bool' }
        ? WallpaperBoolValue
        : T extends { type: 'combo' }
          ? WallpaperComboValue
          : T extends { type: 'textinput' }
            ? WallpaperTextValue
            : T extends { type: 'file' }
              ? WallpaperFileValue
              : T extends { type: 'directory' }
                ? WallpaperDirectoryValue
                : never;

/** Infers non-group Wallpaper Engine property values from a property record. */
export type WallpaperUserPropertiesOf<
  T extends Record<string, WallpaperPropertyDefinition>,
> = {
  readonly [K in keyof T as T[K] extends { type: 'group' }
    ? never
    : K]: PropertyDefinitionToValue<T[K]>;
};

/**
 * A property listener whose `applyUserProperties` values are inferred from a
 * wallpaper's property record.
 *
 * @example
 * import type { WallpaperPropertyListenerOf } from 'wallpaper-engine';
 *
 * window.wallpaperPropertyListener = {
 *   applyUserProperties(values) {
 *     if (values.enabled)
 *       console.log(values.enabled.value);
 *   },
 * } satisfies WallpaperPropertyListenerOf<typeof properties>;
 */
export type WallpaperPropertyListenerOf<
  T extends Record<string, WallpaperPropertyDefinition>,
> = Omit<WallpaperPropertyListener, 'applyUserProperties'> & {
  applyUserProperties?: (values: Partial<WallpaperUserPropertiesOf<T>>) => void;
};
