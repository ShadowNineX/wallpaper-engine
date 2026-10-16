import type {
  WallpaperBoolValue,
  WallpaperColorValue,
  WallpaperComboValue,
  WallpaperDirectoryValue,
  WallpaperFileValue,
  WallpaperGeneralProperties,
  WallpaperPropertyListener,
  WallpaperPropertyListenerOf,
  WallpaperPropertyRuntimeValue,
  WallpaperSliderValue,
  WallpaperTextValue,
  WallpaperUserProperties,
} from '../src/index';
import { expect, expectTypeOf, it, vi } from 'vitest';
import {
  boolProperty,
  colorProperty,
  comboProperty,
  directoryProperty,
  fileProperty,
  groupProperty,
  sliderProperty,
  textInputProperty,
} from '../src/plugin';

const properties = {
  appearance: groupProperty({ text: 'Appearance' }),
  enabled: boolProperty({ text: 'Enabled', value: true }),
  speed: sliderProperty({ text: 'Speed', value: 2, min: 0, max: 5 }),
  accent: colorProperty({ text: 'Accent', value: '#5b86ed' }),
  mode: comboProperty({
    text: 'Mode',
    value: 'bars',
    options: [{ label: 'Bars', value: 'bars' }],
  }),
  greeting: textInputProperty({ text: 'Greeting', value: 'Hello' }),
  artwork: fileProperty({ text: 'Artwork', value: '' }),
  gallery: directoryProperty({ text: 'Gallery', value: '', mode: 'ondemand' }),
};
void properties;

type Update = Parameters<NonNullable<
  WallpaperPropertyListenerOf<typeof properties>['applyUserProperties']
>>[0];

it('keeps arbitrary callback keys optional in the broad listener type', () => {
  type BroadUpdate = Parameters<NonNullable<WallpaperPropertyListener['applyUserProperties']>>[0];

  expectTypeOf<BroadUpdate[string]>().toEqualTypeOf<WallpaperPropertyRuntimeValue | undefined>();
  expectTypeOf<BroadUpdate>().toEqualTypeOf<Partial<WallpaperUserProperties>>();
});

it('contextually types the recommended schema-aware listener assignment', () => {
  expectTypeOf<keyof Update>().toEqualTypeOf<
    'enabled' | 'speed' | 'accent' | 'mode' | 'greeting' | 'artwork' | 'gallery'
  >();
  expectTypeOf<Update['enabled']>().toEqualTypeOf<WallpaperBoolValue | undefined>();
  expectTypeOf<Update['speed']>().toEqualTypeOf<WallpaperSliderValue | undefined>();
  expectTypeOf<Update['accent']>().toEqualTypeOf<WallpaperColorValue | undefined>();
  expectTypeOf<Update['mode']>().toEqualTypeOf<WallpaperComboValue | undefined>();
  expectTypeOf<Update['greeting']>().toEqualTypeOf<WallpaperTextValue | undefined>();
  expectTypeOf<Update['artwork']>().toEqualTypeOf<WallpaperFileValue | undefined>();
  expectTypeOf<Update['gallery']>().toEqualTypeOf<WallpaperDirectoryValue | undefined>();

  let enabled = true;
  const listener = {
    applyUserProperties(values) {
      if (values.enabled) {
        expectTypeOf(values.enabled.value).toEqualTypeOf<boolean>();
        enabled = values.enabled.value;
      }
      if (values.speed)
        expectTypeOf(values.speed.value).toEqualTypeOf<number>();
      if (values.accent)
        expectTypeOf(values.accent.value).toEqualTypeOf<string>();
      if (values.mode)
        expectTypeOf(values.mode.text).toEqualTypeOf<string>();
      if (values.greeting)
        expectTypeOf(values.greeting.value).toEqualTypeOf<string>();
      if (values.artwork)
        expectTypeOf(values.artwork.value).toEqualTypeOf<string>();
      if (values.gallery)
        expectTypeOf(values.gallery.value).toEqualTypeOf<string>();
      // @ts-expect-error Group markers and unknown keys are never delivered.
      void values.appearance;
      // @ts-expect-error Unknown properties are never delivered.
      void values.unknown;
    },
    applyGeneralProperties(general) {
      expectTypeOf(general).toEqualTypeOf<WallpaperGeneralProperties>();
      expectTypeOf(general.fps).toEqualTypeOf<number | undefined>();
    },
    setPaused(paused) {
      expectTypeOf(paused).toEqualTypeOf<boolean>();
    },
    userDirectoryFilesAddedOrChanged(name, files) {
      expectTypeOf(name).toEqualTypeOf<string>();
      expectTypeOf(files).toEqualTypeOf<string[]>();
    },
  } satisfies WallpaperPropertyListenerOf<typeof properties>;

  vi.stubGlobal('window', {});
  try {
    window.wallpaperPropertyListener = listener;
    window.wallpaperPropertyListener.applyUserProperties?.({
      enabled: { value: false },
    });
    expect(enabled).toBe(false);
  }
  finally {
    vi.unstubAllGlobals();
  }

  const partial: Update = { enabled: { value: false }, speed: { value: 3 } };
  expect(partial.enabled?.value).toBe(false);
  // @ts-expect-error Boolean values cannot be assigned to slider properties.
  const invalidValue: Update = { speed: { value: false } };
  // @ts-expect-error Unrecognized keys cannot be sent to this listener.
  const invalidKey: Update = { unknown: { value: true } };
  void invalidValue;
  void invalidKey;
});
