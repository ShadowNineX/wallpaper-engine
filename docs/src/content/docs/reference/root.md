---
title: Root Types & Host Globals
description: Exhaustive reference for the 39 type exports and 12 ambient Wallpaper Engine browser globals in the package root.
---

The root entry has no runtime API. It exports types and imports the global augmentation declarations.

```ts
import type {
  WallpaperMediaPlaybackEvent,
  WallpaperProject,
  WallpaperPropertyListener,
} from 'wallpaper-engine';
import 'wallpaper-engine';
```

## Project schema types (15)

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
| `WallpaperPropertyDefinition` | Union of the eight property-definition interfaces |
| `WallpaperProjectGeneral` | Optional `properties`, `localization`, and `supportsaudioprocessing` |
| `WallpaperProjectMetadata` | Optional `description`, `preview`, `tags`, `contentrating`, `ratingsex`, `ratingviolence`, `visibility` |
| `WallpaperProject` | Metadata + required `file`, `title`, `type: 'web'`, optional `general` |

All property definitions share `text: string` and optional `order`, `index`, and `condition`. See [Property Schemas](../../guides/property-schemas/) for normalization and editor behavior.

Source: [`src/types/project.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/project.ts), symbols listed above.

## Runtime property and listener types (12)

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
| `WallpaperPluginListener` | Optional `onPluginLoaded(name, version)` callback object |

`WallpaperPropertyListener` callbacks:

```ts
interface WallpaperPropertyListener {
  applyUserProperties?: (properties: WallpaperUserProperties) => void;
  applyGeneralProperties?: (properties: WallpaperGeneralProperties) => void;
  setPaused?: (isPaused: boolean) => void;
  userDirectoryFilesAddedOrChanged?: (
    propertyName: string,
    changedFiles: string[],
  ) => void;
  userDirectoryFilesRemoved?: (
    propertyName: string,
    removedFiles: string[],
  ) => void;
}
```

The host contract is open-ended. Application callbacks inferred from a schema should use `Partial<WallpaperUserPropertiesOf<...>>` after narrowing because post-startup deliveries contain only changed keys.

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
