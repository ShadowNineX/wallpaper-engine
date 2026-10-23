import type { DefaultWEPropertyDefinitions } from './default-properties';
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

/** Infers runtime property values, excluding group and divider layout markers. */
export type WallpaperUserPropertiesOf<
  T extends Record<string, WallpaperPropertyDefinition>,
> = {
  readonly [K in keyof T as T[K] extends { type: 'group' | 'divider' }
    ? never
    : K]: PropertyDefinitionToValue<T[K]>;
};

/**
 * A property listener whose `applyUserProperties` values are inferred from a
 * wallpaper's property record, including Wallpaper Engine's built-in properties.
 * Every update key is optional, and explicitly defined keys take precedence.
 * This is a projection of known editable keys, not a runtime filter. For
 * enumerating the complete host payload, use {@link WallpaperPropertyListener}
 * and guard layout descriptors with `'value' in property`.
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
  applyUserProperties?: (values: Partial<WallpaperUserPropertiesOf<
    Omit<Required<DefaultWEPropertyDefinitions>, keyof T> & T
  >>) => void;
};
