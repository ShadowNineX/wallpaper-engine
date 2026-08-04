---
title: Development Simulation
description: Use the serve-only Vite overlay to drive property, runtime, audio, media, file, LED, and iCUE host callbacks.
---

`wallpaperEnginePlugin()` injects a self-contained host simulator during Vite's `serve` mode. Production builds omit it. Disable development injection explicitly when needed:

```ts
wallpaperEnginePlugin({
  title: 'My wallpaper',
  properties,
  devtools: false,
});
```

The client installs Wallpaper Engine-compatible globals before your application runs, stores simulated host state, and calls the listeners your wallpaper registers.

## Shell and listener status

The overlay is a draggable panel with four tabs: Properties, Runtime, Audio, and Media. It can collapse to a compact status bar and constrains itself to the viewport while moving, resizing, and switching tabs.

Status labels expose the current integration state, including property-listener readiness, running/paused runtime state, selected audio mode, and media enabled/disabled state. Controls show warnings or toasts when their matching callback is missing instead of silently pretending delivery succeeded.

## Properties

The Properties tab renders controls from the same property definitions passed to the plugin:

- Changing a scalar, file, or `ondemand` directory control sends a partial `applyUserProperties` payload containing only that property. A `fetchall` directory control instead sends add/change/remove callbacks.
- **Replay all** sends every current non-group, non-`fetchall` user property, replays selected `fetchall` files through `userDirectoryFilesAddedOrChanged`, and sends the current FPS and pause state.
- Group markers become collapsible sections; they are never sent as runtime property values.
- Property labels and combo option labels resolve configured localization tokens.
- File and directory controls filter local selections by configured image/video type.
- Directory controls route `ondemand` requests and `fetchall` add/change/remove callbacks according to the definition.

A missing `wallpaperPropertyListener` produces visible feedback. Treat that as a startup-registration bug, not a reason to delay delivery further.

## Runtime

| Control | Callback |
| --- | --- |
| FPS limit, 0–240 (`0` is unlimited) | `wallpaperPropertyListener.applyGeneralProperties({ fps })` |
| Running / Paused | `wallpaperPropertyListener.setPaused(boolean)` |
| Load LED plugin | `wallpaperPluginListener.onPluginLoaded('led', '0.0.0-dev')` |
| Load iCUE plugin | `wallpaperPluginListener.onPluginLoaded('cue', '0.0.0-dev')` |

The simulator exposes development stubs for the LED and CUE objects so code can exercise readiness and frame delivery without hardware. It does not emulate real device layouts, SDK timing, or hardware failures.

## Audio

The Audio tab reports listener count, chooses one of six modes, and visualizes the most recently delivered 128-sample spectrum.

| Mode | Signal |
| --- | --- |
| Off | No timer or callbacks |
| Silence | Zero-valued callbacks |
| Noise | Random, frequency-decayed values |
| Sweep | Mirrored sinusoidal sweep |
| Bass pulse | Mirrored low-frequency pulse |
| Stereo pan | Energy moves between channels |

Active modes send at approximately 30 Hz. See [Audio](../../guides/audio/) for channel layout, clamping, detection, and the exact simulator-only generator distinctions.

## Media

The Media tab drives all five media callback streams with controls for:

- Enable or disable media integration.
- Enter title, artist, album title, and content type. The public event also supports `subTitle`, `albumArtist`, and `genres`, but the simulator does not expose controls for them.
- Select playing, paused, or stopped using simulator playback constants.
- Adjust timeline position and duration.
- Select local artwork and send the resulting thumbnail.
- Inspect and change primary, secondary, tertiary, text, and high-contrast colors.

A local image is decoded in the browser, converted to a PNG data URL, and used to derive a development palette. This conversion and palette algorithm are simulator behavior. Wallpaper Engine supplies its own thumbnail and colors in production.

## Local file privacy and lifetime

Browser file pickers never upload selected files. The simulator creates page-local `blob:` URLs for file-property values and files delivered from directory selections; the selected directory value remains a browser-visible directory name. It keeps only the information needed to simulate callbacks and revokes stale URLs when selections are replaced or cleared and when the page unloads.

Application code should use `toFileUrl()` so both native host paths and development object URLs work. A `blob:` URL is temporary and cannot be persisted across reloads or treated as the user's native path.

## Simulator versus real host

| Area | Development simulator | Wallpaper Engine |
| --- | --- | --- |
| Injection | Vite serve only; optional via `devtools` | Host-owned browser environment |
| Listener registration | Compatible globals; current state can replay | Register immediately; rely only on documented host timing |
| Property changes | Deterministic controls and replay-all | User editor changes and startup delivery |
| Directory files | Browser-selected files and object URLs | Native directory paths and host callbacks |
| Audio | Six synthetic modes at a timer cadence | Real host FFT spectrum |
| Media artwork/colors | Local PNG conversion and derived palette | Host media integration output |
| LED/iCUE | Readiness and API stubs | Installed plugins and physical hardware |
| Errors | Audio/media fanout, directory notifications, random-file callbacks, and registration replay are isolated with `[WE Dev]` logging; explicit property, general, and plugin UI delivery is not universally isolated | Application must own its failure handling |

:::caution[Compatibility is not fidelity]
The simulator matches callback shapes and common event flows. It cannot guarantee host ordering, native filesystem behavior, media-player support, FFT values, Steam integration, or hardware behavior. Complete final testing inside Wallpaper Engine.
:::

## Source

The shell is implemented in [`packages/devtools/src/App.vue`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/devtools/src/App.vue), host globals in [`packages/devtools/src/globals.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/devtools/src/globals.ts), and state delivery in [`packages/devtools/src/store.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/devtools/src/store.ts).

## Next steps

Implement production-safe registration in [Host Listeners](../../guides/host-listeners/), then package output with [Project Metadata](../../build/project-metadata/).
