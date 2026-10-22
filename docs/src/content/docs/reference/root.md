---
title: Root Types & Host Globals
description: Reference for the public type exports and ambient Wallpaper Engine browser globals in the package root.
---

The root entry has no runtime API. It exports types and imports the global augmentation declarations.

```ts
import type {
  WallpaperMediaPlaybackEvent,
  WallpaperProject,
  WallpaperPropertyListenerOf,
} from 'wallpaper-engine';
import 'wallpaper-engine';
```

## Project schema types (16)

| Type | Shape and purpose |
| --- | --- |
| `WallpaperFileType` | `'image' \| 'video'`; editor filter for file/directory properties |
| `WallpaperLocalization` | `Record<string, Record<string, string>>`; language code → `ui_` token → text |
| `WallpaperColorProperty` | Base fields + `type: 'color'`, `value: string` in normalized `"R G B"` form |
| `WallpaperSliderProperty` | Base fields + `type: 'slider'`, numeric `value`, `min`, `max`, optional `fraction`, `precision`, `step` |
| `WallpaperBoolProperty` | Base fields + `type: 'bool'`, `value: boolean` |
| `WallpaperComboOption` | `{ label: string; value: string }` |
| `WallpaperComboProperty` | Base fields + `type: 'combo'`, selected string `value`, and `options` |
| `WallpaperTextInputProperty` | Base fields + `type: 'textinput'`, `value: string` |
| `WallpaperFileProperty` | Base fields + `type: 'file'`, path `value`, optional `fileType` |
| `WallpaperDirectoryProperty` | Base fields + `type: 'directory'`, path `value`, optional `fileType`, required `mode: 'ondemand' \| 'fetchall'` |
| `WallpaperGroupProperty` | Base fields + `type: 'group'`, `value: ''`; editor layout only |
| `WallpaperDividerProperty` | `type: 'divider'`, optional `text`, `icon`, `order`, `index`, `condition`; no runtime value |
| `WallpaperPropertyDefinition` | Union of the nine property-definition interfaces |
| `WallpaperProjectGeneral` | Optional `properties`, `localization`, and `supportsaudioprocessing` |
| `WallpaperProjectMetadata` | Optional `description`, `preview`, `tags`, `contentrating`, `ratingsex`, `ratingviolence`, `visibility` |
| `WallpaperProject` | Metadata + required `file`, `title`, `type: 'web'`, optional `general` |

All property definitions accept optional `icon`, `order`, `index`, and `condition`.
`text` is required except on dividers, where it is optional. See
[Property Schemas](../../guides/property-schemas/) for normalization and editor behavior.

Source: [`src/types/project.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/project.ts), symbols listed above.

## Runtime property and listener types (13)

| Type | Exact public shape |
| --- | --- |
| `WallpaperColorValue` | `{ value: string }`, host `"R G B"` channels |
| `WallpaperSliderValue` | `{ value: number }` |
| `WallpaperBoolValue` | `{ value: boolean }` |
| `WallpaperComboValue` | `{ value: string; text: string }` |
| `WallpaperTextValue` | `{ value: string }` |
| `WallpaperFileValue` | `{ value: string }` native/file-picker path |
| `WallpaperDirectoryValue` | `{ value: string }` selected directory path |
| `WallpaperPropertyRuntimeValue` | Union of the seven wrappers above |
| `WallpaperUserProperties` | `Record<string, WallpaperPropertyRuntimeValue>` |
| `WallpaperGeneralProperties` | `{ fps?: number }`; `0` means unlimited |
| `WallpaperPropertyListener` | Optional user/general/pause/directory callback object |
| `WallpaperPropertyListenerOf<T>` | Listener inferred from custom and built-in properties; updates are partial and group/divider keys are omitted |
| `DefaultWEProps` | Built-in property definitions; `audioprocessing` is optional because audio support is conditional. Runtime defaults are exported from `/helpers`. |
| `WallpaperPluginListener` | Optional `onPluginLoaded(name, version)` callback object |

The base host contract is open-ended; its exact callback signatures are defined
in [`types/listeners.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/listeners.ts).
For application callbacks, infer the property keys and partial updates from your
schema with `satisfies`:

```ts
import type { WallpaperPropertyListenerOf } from 'wallpaper-engine';
import type { properties } from './properties';

window.wallpaperPropertyListener = {
  applyUserProperties(values) {
    // Keys and wrapper types come from properties; every key can be absent.
    if (values.speed)
      setSpeed(values.speed.value);
  },
} satisfies WallpaperPropertyListenerOf<typeof properties>;
```

No cast or manual `Partial` is needed. See [Type Inference](../../guides/type-inference/)
for migration and reusable callback types.

`WallpaperPluginListener.onPluginLoaded?: (name: string, version: string) => void` reports `led` or `cue` integration readiness.

## Media types (6)

| Type | Fields |
| --- | --- |
| `WallpaperMediaStatusEvent` | `enabled: boolean` |
| `WallpaperMediaPropertiesEvent` | Required `title`, `artist`, `contentType`; optional `subTitle`, `albumTitle`, `albumArtist`, `genres` |
| `WallpaperMediaThumbnailEvent` | `thumbnail`, `primaryColor`, `secondaryColor`, `tertiaryColor`, `textColor`, `highContrastColor` strings |
| `WallpaperMediaPlaybackState` | `number`; compare through host-supplied constants |
| `WallpaperMediaPlaybackEvent` | `state: WallpaperMediaPlaybackState` |
| `WallpaperMediaTimelineEvent` | `position: number`, `duration: number`, both seconds |

`contentType` is `'music' | 'video' | 'image'`. Timeline delivery is optional at the player boundary. Thumbnail is a base64 PNG suitable for `img.src`; the host owns palette selection.

See [Media](../../guides/media/) for registration and state flow.

## RGB and iCUE types (6)

### `CueProtocolDetails`

`{ sdkVersion: string; serverVersion: string; sdkProtocolVersion: number; serverProtocolVersion: number; breakingChanges: boolean }`.

### `CueDeviceInfo`

Fields: numeric `type`, `physicalLayout`, `logicalLayout`, `ledCount`, `capsMask`, plus string `model`.

### `CueLedPosition`

Fields: numeric `ledId`, `top`, `left`, `width`, `height`, plus string `ledIdName`.

### `CueLedColor`

`{ ledId: number; r: number; g: number; b: number }`.

### `WallpaperCuePlugin`

```ts
interface WallpaperCuePlugin {
  getProtocolDetails: (
    callback: (details: CueProtocolDetails) => void,
  ) => void;
  getDeviceCount: (callback: (deviceCount: number) => void) => void;
  getDeviceInfo: (
    deviceIndex: number,
    callback: (deviceInfo: CueDeviceInfo) => void,
  ) => void;
  getLedPositionsByDeviceIndex: (
    callback: (positions: CueLedPosition[]) => void,
  ) => void;
  setLedsColorsAsync: (colors: CueLedColor[]) => void;
  setAllLedsColorsAsync: (
    deviceIndexOrArray: number | number[],
    color: CueLedColor,
  ) => void;
  setLedColorsByImageData: (
    deviceIndexOrArray: number | number[],
    encodedImageData: string,
    width: number,
    height: number,
  ) => void;
}
```

### `WallpaperLedPlugin`

```ts
interface WallpaperLedPlugin {
  setAllDevicesByImageData: (
    encodedImageData: string,
    width: number,
    height: number,
  ) => void;
}
```

Use `WallpaperLedPlugin` for general hardware after `led` readiness. Use direct `WallpaperCuePlugin` APIs after `cue` readiness only when advanced Corsair behavior is required.

Source for runtime, media, and hardware symbols: [`src/types/listeners.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/listeners.ts).

## Ambient `Window` and bare globals (12)

Importing the root entry adds each name to `Window` and declares the matching bare/global binding so `window.name`, `globalThis.name`, or the bare host function type-checks.

| Name | Declaration |
| --- | --- |
| `wallpaperPropertyListener` | Optional `WallpaperPropertyListener` singleton |
| `wallpaperPluginListener` | Optional `WallpaperPluginListener` singleton |
| `wallpaperRegisterAudioListener` | `(callback: (audioArray: number[]) => void) => void` |
| `wallpaperRequestRandomFileForProperty` | `(propertyName: string, callback: (propertyName: string, filePath: string) => void) => void` |
| `wpPlugins` | `{ led: WallpaperLedPlugin }` |
| `cue` | `WallpaperCuePlugin` |
| `wallpaperRegisterMediaStatusListener` | Callback receives `WallpaperMediaStatusEvent` |
| `wallpaperRegisterMediaPropertiesListener` | Callback receives `WallpaperMediaPropertiesEvent` |
| `wallpaperRegisterMediaThumbnailListener` | Callback receives `WallpaperMediaThumbnailEvent` |
| `wallpaperRegisterMediaPlaybackListener` | Callback receives `WallpaperMediaPlaybackEvent` |
| `wallpaperRegisterMediaTimelineListener` | Callback receives `WallpaperMediaTimelineEvent` |
| `wallpaperMediaIntegration` | `{ PLAYBACK_PLAYING; PLAYBACK_PAUSED; PLAYBACK_STOPPED }`, each a `WallpaperMediaPlaybackState` |

Singleton listener globals are optional because a page assigns them. Registration functions and integration objects are host-provided declarations.

Source: [`src/types/window.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/window.ts), `Window` and matching global declarations.

## Export inventory check

The exact 39 root exports are defined in [`src/index.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/index.ts): 15 project-schema types and 24 runtime/listener/media/RGB types. Ambient names are declarations, not additional named exports.

## Next steps

Use [Plugin API](../plugin/) to create the schema and build output, then [Helpers API](../helpers/) for browser transformations.
