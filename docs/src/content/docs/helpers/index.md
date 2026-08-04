---
title: Runtime Helper Overview
description: Choose side-effect-free, tree-shakeable browser utilities from the wallpaper-engine helpers entry point.
---

Import utilities from `wallpaper-engine/helpers`. This entry point does not import Vite, mutate host globals, or initialize shared runtime state; bundlers can retain only the exports you use.

```ts
import {
  createFpsLimiter,
  toFileUrl,
  wallpaperColorToHex,
} from 'wallpaper-engine/helpers';
```

## Choose a task

| Task | Start here |
| --- | --- |
| Convert Color.js or CSS syntax into Wallpaper Engine's native color string | [`colorToWallpaperColor`](./colors-and-media/#convert-to-wallpaper-engine-color) |
| Parse a host color into byte channels, CSS RGB, or hex | [Wallpaper color conversion](./colors-and-media/#parse-host-colors) |
| Extract an average or dominant color from images, videos, canvases, or raw pixels | [Average-color extraction](./colors-and-media/#average-color-extraction) |
| Normalize host filesystem paths and simulator object URLs | [`toFileUrl`](./files-led-and-frames/#file-urls) |
| Clamp and split the 128-sample audio spectrum | [Audio guide](../guides/audio/) |
| Resolve host-defined playback constants | [Media guide](../guides/media/#compare-playback-through-host-constants) |
| Encode canvas RGB bytes for LED or iCUE APIs | [LED canvas encoding](./files-led-and-frames/#led-canvas-encoding) |
| Apply Wallpaper Engine's FPS limit and pause/resume behavior | [Frame limiting](./files-led-and-frames/#frame-limiting) |

## Boundary rules

- The helpers entry is side-effect-free and independently tree-shakeable.
- Browser-specific helpers accept native DOM objects but do not register Wallpaper Engine listeners for you.
- `clampAudio()`, `leftChannel()`, and `rightChannel()` allocate new arrays. Color result and URL/string behavior is documented per API; `getColorFromArray4()` may return the supplied `defaultColor` tuple for undersized input.
- Import build-time builders and Vite integration from `wallpaper-engine/plugin`, not this entry.
- Import host contracts and ambient global declarations from `wallpaper-engine`.

See the exact [Helpers API Reference](../reference/helpers/) and public source in [`src/helpers.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/helpers.ts).

## Next steps

Use [Colors & Media](./colors-and-media/) for conversion and extraction, or [Files, LED & Frames](./files-led-and-frames/) for browser path, hardware, and render-loop tasks.
