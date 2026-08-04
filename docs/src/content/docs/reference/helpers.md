---
title: Helpers API Reference
description: Exact signatures, results, allocations, errors, and lifecycle for all wallpaper-engine/helpers exports.
---

Every value export is side-effect-free and tree-shakeable.

```ts
import { toFileUrl, wallpaperColorToHex } from 'wallpaper-engine/helpers';
```

## Color functions

### `colorToWallpaperColor()`

```ts
function colorToWallpaperColor(value: string): string;
```

Accepts Wallpaper Engine native channels or Color.js-supported syntax. Returns a new normalized sRGB `"R G B"` string with up to six fractional digits; clamps converted Color.js output into gamut and discards alpha. Native numeric input outside 0–1 throws `RangeError`. An unconvertible null/non-finite sRGB coordinate throws `TypeError`; Color.js parser errors propagate. Does not mutate input.

### `parseWallpaperColor()`

```ts
function parseWallpaperColor(value: string): {
  r: number;
  g: number;
  b: number;
};
```

Requires exactly three finite whitespace-separated numbers. Clamps each to 0–1, multiplies by 255, rounds, and allocates a new channel object. Malformed channel count or non-finite values throw `TypeError`.

### `wallpaperColorToRgb()`

```ts
function wallpaperColorToRgb(value: string): string;
```

Uses `parseWallpaperColor()` and returns a new compact CSS string such as `rgb(255,128,0)`. It has the same `TypeError` behavior.

### `wallpaperColorToHex()`

```ts
function wallpaperColorToHex(value: string): string;
```

Uses `parseWallpaperColor()` and returns a new lowercase six-digit CSS hex string. It has the same `TypeError` behavior.

Source: [`src/color.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/color.ts), symbol `colorToWallpaperColor`; and [`src/helpers.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/helpers.ts), parsing/conversion symbols.

## Average-color types (4)

### `AverageColorSource`

```ts
type AverageColorSource
  = | string
    | HTMLImageElement
    | HTMLVideoElement
    | HTMLCanvasElement
    | OffscreenCanvas
    | ImageBitmap
    | VideoFrame;
```

A string may be an image URL, data URL, or object URL.

### `AverageColorOptions`

Extends FastAverageColor's option interface without adding or changing fields:

```ts
interface AverageColorOptions {
  defaultColor?: [number, number, number, number];
  ignoredColor?:
    | [number, number, number]
    | [number, number, number, number]
    | [number, number, number, number, number]
    | Array<
      | [number, number, number]
      | [number, number, number, number]
      | [number, number, number, number, number]
    >;
  mode?: 'precision' | 'speed';
  algorithm?: 'simple' | 'sqrt' | 'dominant';
  step?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  silent?: boolean;
  crossOrigin?: string;
  dominantDivider?: number;
}
```

Every option is forwarded unchanged. FastAverageColor owns defaults, crop validation, ignored-color thresholds, and algorithms. `silent` only suppresses its `console.error` logging for handled synchronous failures; it does not change fallback results, promise rejection, or thrown option errors.

### `AverageColorResult`

```ts
interface AverageColorResult {
  rgb: string;
  rgba: string;
  hex: string;
  hexa: string;
  value: [number, number, number, number];
  isDark: boolean;
  isLight: boolean;
  error?: Error;
}
```

The tuple channels are 0–255. `error` is optional dependency output from handled synchronous failures, whether or not `silent` is set.

### `AverageColorExtractor`

```ts
interface AverageColorExtractor {
  getColor: (
    source: Exclude<AverageColorSource, string>,
    options?: AverageColorOptions,
  ) => AverageColorResult;
  getColorAsync: (
    source: AverageColorSource,
    options?: AverageColorOptions,
  ) => Promise<AverageColorResult>;
  getColorFromArray4: (
    pixels: number[] | Uint8Array | Uint8ClampedArray,
    options?: AverageColorOptions,
  ) => [number, number, number, number];
  destroy: () => void;
}
```

`getColor()` is synchronous for available DOM/media resources. `getColorAsync()` loads string/pending sources. `getColorFromArray4()` reads RGBA groups and returns only a tuple. The extractor owns a reusable internal canvas; call `destroy()` after the last operation. Extraction reads sources/pixel input and does not intentionally mutate them.

## Average-color functions

### `createAverageColorExtractor()`

```ts
function createAverageColorExtractor(): AverageColorExtractor;
```

Allocates one FastAverageColor instance. The caller owns `destroy()`, including failure paths. Handled synchronous source, canvas, and CORS failures return a fallback result with `error`; asynchronous failures reject, and direct option errors may throw. `silent` suppresses dependency logging but does not change those outcomes.

### `getAverageColor()`

```ts
function getAverageColor(
  source: AverageColorSource,
  options?: AverageColorOptions,
): Promise<AverageColorResult>;
```

Allocates one extractor, awaits `getColorAsync()`, and destroys the extractor in `finally`. The returned promise rejects with the dependency error after cleanup. Prefer the reusable extractor to avoid repeated internal-canvas allocation across frames or batches.

Source: [`src/image-color.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/image-color.ts), all four types and two functions. Dependency behavior: [FastAverageColor documentation](https://github.com/fast-average-color/fast-average-color).

## `toFileUrl()`

```ts
function toFileUrl(path: string): string;
```

Returns `''` unchanged. Preserves strings beginning with `/` or `http:`, `https:`, `data:`, `blob:`, or `file:` (scheme check is case-insensitive). Otherwise allocates `file:///${path}`. Performs no encoding, parsing, filesystem access, or mutation and intentionally does not throw for malformed-but-string inputs.

## Audio functions

### `clampAudio()`

```ts
function clampAudio(audioArray: number[]): number[];
```

Allocates a same-length array with each finite sample clamped to 0–1 and every non-finite sample replaced with `0`. Does not mutate input or require exactly 128 elements.

### `leftChannel()`

```ts
function leftChannel(audioArray: number[]): number[];
```

Allocates `audioArray.slice(0, 64)`. Short input yields a shorter result; extra input is ignored.

### `rightChannel()`

```ts
function rightChannel(audioArray: number[]): number[];
```

Allocates `audioArray.slice(64, 128)`. Short input may yield an empty/short result; extra input is ignored.

See [Audio](../../guides/audio/) for the host's 128-sample stereo contract.

## `getMediaPlaybackStatus()`

```ts
function getMediaPlaybackStatus(
  state: number,
): 'playing' | 'paused' | 'stopped';
```

Reads `globalThis.wallpaperMediaIntegration`. Exact equality with `PLAYBACK_PLAYING` returns `'playing'`; equality with `PLAYBACK_PAUSED` returns `'paused'`; every other number returns `'stopped'`. It allocates no collection and mutates nothing. The host integration object must exist; calling outside Wallpaper Engine/devtools without a stub produces the normal missing-property runtime error.

## `encodeCanvasForLed()`

```ts
function encodeCanvasForLed(canvas: HTMLCanvasElement): string;
```

Reads the full 2D `ImageData`, discards each alpha byte, and builds a new three-code-point-per-pixel RGB string. It does not mutate the canvas. A missing 2D context throws `Error('Could not get 2D context from canvas')`; `getImageData()` errors such as tainted-canvas security failures propagate. The call allocates `ImageData` and a result string.

See [Files, LED & Frames](../../helpers/files-led-and-frames/#led-canvas-encoding) for plugin readiness.

## `createFpsLimiter()`

```ts
function createFpsLimiter(draw: (dt: number) => void): {
  start: () => void;
  stop: () => void;
  setLimit: (fps: number) => void;
};
```

Allocates one controller and closure state. `start()` cancels an existing RAF, resets timestamps/threshold, and schedules a new RAF. `stop()` cancels the current RAF. `setLimit()` resets threshold only when the numeric value changes. Limits greater than zero cap drawing; non-positive values are uncapped.

The callback receives elapsed seconds since the last draw, clamped to 0–1. Under a cap, tick time accumulates and retains remainder. No per-frame result arrays are allocated by the limiter. The browser must supply `requestAnimationFrame`, `cancelAnimationFrame`, `performance.now`, and animation timestamps. Errors thrown by `draw` propagate from the RAF callback; the next RAF is scheduled before drawing.

## Export inventory check

The exact 13 functions are:

1. `colorToWallpaperColor`
2. `createAverageColorExtractor`
3. `getAverageColor`
4. `parseWallpaperColor`
5. `wallpaperColorToRgb`
6. `wallpaperColorToHex`
7. `toFileUrl`
8. `clampAudio`
9. `leftChannel`
10. `rightChannel`
11. `getMediaPlaybackStatus`
12. `encodeCanvasForLed`
13. `createFpsLimiter`

The exact four types are `AverageColorSource`, `AverageColorOptions`, `AverageColorResult`, and `AverageColorExtractor`. Public re-exports are defined by [`src/helpers.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/helpers.ts).

## Next steps

Use [Runtime Helper Overview](../../helpers/) for task-oriented navigation and [Root Types](../root/) for the host values these helpers consume.
