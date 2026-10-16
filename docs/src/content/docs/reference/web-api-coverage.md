---
title: Wallpaper Engine Web API Coverage
description: Coverage of the official Wallpaper Engine web wallpaper APIs in wallpaper-engine.
---

This page maps the official Wallpaper Engine web wallpaper surface to the
package's public types, helpers, Vite output, and development simulator. The
official documentation remains authoritative for behavior in the native
Wallpaper Engine host.

## Coverage matrix

| Official surface | Public package | Helpers | Simulator | Status |
| --- | --- | --- | --- | --- |
| `wallpaperPropertyListener` (`applyUserProperties`, `applyGeneralProperties`, `setPaused`, and directory change callbacks) | `WallpaperPropertyListener`, `WallpaperGeneralProperties` in [`types/listeners.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/listeners.ts) | — | Properties and Runtime tabs deliver startup and change callbacks | Covered |
| User properties: `color`, `slider`, `bool`, `combo`, `textinput`, `file`, and `directory` | Builders and `WallpaperPropertyDefinition` in [`plugin/index.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/plugin/index.ts) and [`types/project.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/project.ts) | Color and file URL helpers | Properties tab supports groups, conditions, file selection, and directory selection | Covered |
| Directory `ondemand` and `fetchall` modes | `WallpaperDirectoryProperty` and listener callback types | `toFileUrl` | Browser-selected files are delivered as object URLs; random-file and add/remove callbacks are simulated | Covered with browser limits |
| FPS limits and pausing | `WallpaperGeneralProperties` and `setPaused` | `createFpsLimiter` | Runtime tab sends limits and pause callbacks | Covered |
| Audio visualization (`wallpaperRegisterAudioListener`) | Ambient global in `types/window.ts`; `number[]` callback | Audio analysis and channel helpers in [`helpers.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/helpers.ts) | Audio tab emits configurable virtual 128-sample frames | Covered |
| `supportsaudioprocessing` in `project.json` | `WallpaperProjectGeneral` and plugin detection/override | — | — | Covered |
| Media status, properties, thumbnail, playback, and timeline listeners | Event interfaces and ambient globals in `types/listeners.ts` and `types/window.ts` | Playback-state and media helpers | Media tab sends all five event kinds | Covered |
| LED plugin (`wpPlugins.led.setAllDevicesByImageData`) | `WallpaperLedPlugin` and `wallpaperPluginListener` | Frame/image-data helpers | Virtual device model only; no hardware access | Covered as simulator API, native hardware unverified |
| Corsair iCUE (`window.cue`) | `WallpaperCuePlugin` plus protocol, device, LED position, and color types | — | Virtual keyboard queries, positions, RGB image frames, and per-LED colors | Covered as simulator API, native hardware unverified |
| `project.json`: `file`, `title`, `type`, `general.properties`, `general.localization`, and `general.supportsaudioprocessing` | `WallpaperProject`, `WallpaperProjectGeneral`, localization and property types | — | — | Covered |
| Display conditions and property groups | `condition` and `WallpaperGroupProperty` | — | Reactive visibility for property comparisons, boolean operators, and groups | Documented comparisons supported; arbitrary JavaScript is not executed |
| Property localization | `WallpaperLocalization` and plugin `localization` option | — | Localized labels are available to the simulator configuration | Covered |

## Display conditions

The simulator supports property references such as `showclock.value`, boolean, numeric and string comparisons, `&&`, `||`, `!`, and parentheses. Conditions affect editor visibility only; hidden values still reach runtime callbacks. Unsupported expressions or missing references stay visible and produce a warning. Native Wallpaper Engine remains authoritative for arbitrary JavaScript condition behavior.

## Native runtime boundaries

The official guide describes Wallpaper Engine's internal browser as Chromium
Embedded Framework (CEF). Use the [official debugging guide](https://docs.wallpaperengine.io/en/web/debug/debug.html)
when validating native browser behavior; a normal browser or the simulator is
not proof of native-host compatibility.

The official getting-started guidance recommends bundling important assets
locally, keeping the project directory dedicated, and handling arbitrary
screen resolutions and aspect ratios. The web guide documents `.webm`, `.ogg`,
and `.ogv` as the supported video extensions. See [Creating a Web Wallpaper](https://docs.wallpaperengine.io/en/web/first/gettingstarted.html)
and the [Web Wallpaper Reference Guide](https://docs.wallpaperengine.io/en/web/overview.html).

File and directory properties are represented by native file paths in
Wallpaper Engine and require the documented `file:///` prefix. In the browser
simulator, the user selects files through the browser picker and the simulator
uses object URLs. A browser selection does not grant arbitrary filesystem
access or reproduce native absolute-path permissions; this is an intentional
development boundary.

## Official references

- [Property listener API](https://docs.wallpaperengine.io/en/web/api/propertylistener.html)
- [User properties](https://docs.wallpaperengine.io/en/web/customization/properties.html)
- [Display conditions](https://docs.wallpaperengine.io/en/web/customization/displaycondition.html)
- [Property localization](https://docs.wallpaperengine.io/en/web/customization/localization.html)
- [Audio visualization](https://docs.wallpaperengine.io/en/web/audio/visualizer.html)
- [Media integration](https://docs.wallpaperengine.io/en/web/audio/media.html)
- [FPS limiter](https://docs.wallpaperengine.io/en/web/performance/fps.html)
- [RGB hardware support](https://docs.wallpaperengine.io/en/web/api/rgb.html)
- [Additional Corsair iCUE functions](https://docs.wallpaperengine.io/en/web/api/icue.html)
