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

## Installed-host verification

The 2026-10-23 review used the installed Wallpaper Engine **2.8.42** files,
read-only IDA analysis, and native web-preview callbacks captured on 2026-10-22.
The executable loaded in the interactive IDA database matched the installed
`wallpaper64.exe` SHA-256:
`40e2ce021e9352324fadb3b8f72b8ba2a7ee95b71cc571d5b9f84be75cd993b0`.

The extended review used IDA's installed analysis library on temporary copies
of three additional binaries, preserving the interactive database and installed
files:

- `bin/webwallpaper64.exe`:
  `51173dab085628159b1af7d9b745c15768497d738c7bab7b72d667a35b4f6d9d`.
- `plugins/led/ledextensions64.dll`:
  `10d2ede8e0543198beacb49d4839f45eaec8d228c064817d6853b88c9d44cc0c`.
- `bin/winrtutil64.exe`:
  `42c4801b194bf06408e176d6869407c193e47ad995714ccdcfd5b4e7a0daf1e0`.

The built-in property constructor at `0x14010C650` creates `_d0` as a divider;
the web callback confirms `{ order: 0, type: 'divider' }` with no value or label.
Seven built-in definitions include Font Awesome classes in `icon`. No separate
font metadata was present in that callback. The checked-in native property
fixture preserves these descriptors independently of the simulator.

The first pass corrected these simulator differences:

- Native media playback constants are stopped `0`, playing `1`, and paused `2`.
- The installed `ui/dist/scripts` property panel uses `step || 1` and
  `precision || 1`. Its slider rounds interactions to the step grid relative to
  `min`, then rounds decimal places using `precision`; it preserves the initial
  value. The native editor's generated step convention is a separate authoring
  choice. Explicit steps emitted by the package remain supported.

The extended pass traced values through the producer, IPC transport, renderer,
and JavaScript binding before comparing the public contracts:

| Surface | Native evidence | Result |
| --- | --- | --- |
| Audio/media registration | Renderer `0x140014A60` assigns six independent callback slots through `0x140025AA0` | Each registration replaces the previous callback for that stream; simulator replacement and startup delivery corrected |
| Audio frames | Renderer `0x14000F090` reads 512 bytes and creates a JavaScript array of 128 samples | Existing `number[]` contract confirmed |
| Media metadata | Host `0x14011BE40` and renderer `0x14001A550` populate all seven string keys | Required fields and empty-string defaults corrected |
| Unknown media type | WinRT producer `0x140033D80` maps known types to `music`, `video`, or `image`; its default stays empty | Public union, simulator controls, and bridge now also accept `''` |
| Thumbnail palette | Host numeric colors pass through renderer `0x14001B4E0` and converter `0x14000B100` | JavaScript receives CSS hex strings; public string types confirmed |
| Timeline units | WinRT producer `0x1400359D0` converts 100-nanosecond ticks to seconds | Existing position/duration units confirmed; live player support remains separate |
| iCUE LED positions | LED metadata at `0x18014E9B0`, renderer argument validation at `0x140039B10`, and plugin handler `0x180018EC0` | Corrected signature to `(deviceIndex, callback)` |
| LED image dimensions | Plugin handlers `0x180019B38` and `0x18001A570` require both dimensions ≥ 2 and three bytes per pixel | Simulator validates the 2×2 minimum; its errors provide development feedback where the native plugin ignores unsupported frames |
| Empty random-file results | Renderer `0x14000F090` sends an empty path for missing properties and empty lists | Simulator now completes the callback with `(propertyName, '')` |

Installed UI scripts also confirmed combo option shape and strict selection,
group ordering, divider rendering, `ondemand`/`fetchall` modes, and the file-type
string passed to the host picker. Host-owned extension filtering was not
independently qualified.

The callback review also checked partial property updates, 128-sample audio
frames, plugin startup readiness, and image loading through file-property and
on-demand directory paths. Live media timeline delivery, native fetch-all
directory delivery, physical RGB hardware, and compatibility with other host
versions remain unqualified. Static analysis and simulator tests do not
establish those live-host behaviors.

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
