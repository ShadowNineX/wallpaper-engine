---
title: Colors & Media Helpers
description: Convert Wallpaper Engine colors and extract average or dominant colors from browser media with explicit lifecycle control.
---

All APIs on this page come from the side-effect-free helpers entry:

```ts
import {
  colorToWallpaperColor,
  createAverageColorExtractor,
  getAverageColor,
  parseWallpaperColor,
  wallpaperColorToHex,
  wallpaperColorToRgb,
} from 'wallpaper-engine/helpers';
```

## Convert to Wallpaper Engine color

```ts
const native = colorToWallpaperColor('oklch(70% 0.18 250)');
// "R G B", with normalized sRGB channels in the 0–1 range
```

`colorToWallpaperColor(value)` accepts Color.js-supported color syntax and Wallpaper Engine's native three-number syntax. It converts through sRGB and returns a normalized host string. Native channels outside 0–1 throw `RangeError`; parsed colors that cannot produce finite sRGB channels throw `TypeError`. Color.js parser errors propagate for invalid syntax.

Color-space parsing and conversion are provided by [Color.js](https://colorjs.io/docs/). Wide-gamut values are mapped into sRGB with its CSS gamut-mapping behavior, and alpha is discarded.

## Parse host colors

`parseWallpaperColor(value)` requires exactly three finite whitespace-separated channels. It clamps each to 0–1, multiplies by 255, rounds to the nearest integer, and returns a new object:

```ts
parseWallpaperColor('1 0.501 0');
// { r: 255, g: 128, b: 0 }
```

Malformed input throws `TypeError`. Two convenience functions reuse the same validation and rounding:

```ts
wallpaperColorToRgb('1 0.501 0'); // 'rgb(255,128,0)'
wallpaperColorToHex('1 0.501 0'); // '#ff8000'
```

## Average-color extraction

Average-color helpers wrap [FastAverageColor](https://github.com/fast-average-color/fast-average-color). They accept these `AverageColorSource` kinds:

| Source | Synchronous reusable API | Async reusable API |
| --- | --- | --- |
| Image URL, data URL, or `blob:` URL string | No | Yes |
| `HTMLImageElement` | Once loaded | Yes, including pending load |
| `HTMLVideoElement` | Yes | Yes |
| `HTMLCanvasElement` | Yes | Yes |
| `OffscreenCanvas` | Yes | Yes |
| `ImageBitmap` | Yes | Yes |
| `VideoFrame` | Yes | Yes |

### One-shot extraction

```ts
const result = await getAverageColor(imageUrl, {
  algorithm: 'dominant',
  crossOrigin: 'anonymous',
  mode: 'precision',
});
```

`getAverageColor()` creates one extractor, awaits its async API, and destroys it in `finally`. Cleanup therefore runs after success and rejection. Prefer it for occasional sources.

### Reusable extraction

```ts
const extractor = createAverageColorExtractor();

try {
  const frameColor = extractor.getColor(video, { mode: 'speed' });
  const loadedColor = await extractor.getColorAsync(imageUrl);
  const rgba = extractor.getColorFromArray4(pixelBytes);
  applyTheme(frameColor, loadedColor, rgba);
}
finally {
  extractor.destroy();
}
```

- `getColor(source, options?)` is synchronous and accepts an already-available non-string source.
- `getColorAsync(source, options?)` loads strings and pending images before extracting.
- `getColorFromArray4(pixels, options?)` accepts `number[]`, `Uint8Array`, or `Uint8ClampedArray` containing RGBA groups and returns `[r, g, b, a]`.
- `destroy()` releases the internal canvas and rendering context. It is required when the reusable extractor is no longer needed.

Reuse one extractor for video frames, repeated crops, or multiple images to avoid repeatedly allocating its internal canvas.

## Extraction options

Every `AverageColorOptions` field is forwarded unchanged to FastAverageColor:

| Field | Type | Purpose |
| --- | --- | --- |
| `defaultColor` | `[r, g, b, a]` | Fallback RGBA result |
| `ignoredColor` | RGB/RGBA tuple, threshold tuple, or array of them | Exclude matching colors |
| `mode` | `'precision' \| 'speed'` | Sampling quality/performance policy |
| `algorithm` | `'simple' \| 'sqrt' \| 'dominant'` | Color calculation algorithm |
| `step` | `number` | Sampling interval |
| `left`, `top` | `number` | Crop origin |
| `width`, `height` | `number` | Crop size |
| `silent` | `boolean` | Suppress dependency `console.error` logging for handled synchronous failures; results and thrown/rejected errors are unchanged |
| `crossOrigin` | `string` | Cross-origin setting used while loading a URL |
| `dominantDivider` | `number` | Dominant-algorithm color grouping divisor |

Consult FastAverageColor's [options documentation](https://github.com/fast-average-color/fast-average-color#options) for dependency-owned defaults, accepted threshold tuple forms, and algorithm details.

## Result shape

`getAverageColor()`, `getColor()`, and `getColorAsync()` return `AverageColorResult`:

| Field | Meaning |
| --- | --- |
| `rgb` | CSS `rgb()` string |
| `rgba` | CSS `rgba()` string |
| `hex` | Six-digit CSS hex string |
| `hexa` | Eight-digit CSS hex including alpha |
| `value` | `[red, green, blue, alpha]`, each 0–255 |
| `isDark` | Perceived brightness is below FastAverageColor's threshold |
| `isLight` | Perceived brightness meets the threshold |
| `error` | Optional synchronous extraction failure supplied by the dependency |

The returned strings, tuple, and object are new result values. `getColorFromArray4()` returns only the raw RGBA tuple.

## CORS and failure cleanup

An image loaded from another origin must permit canvas access. Set `crossOrigin` appropriately and configure the image server's CORS headers; a client option cannot grant access the server denies. Tainted-canvas, decode, load, or unsupported-source failures may reject the async API.

```ts
const extractor = createAverageColorExtractor();
try {
  return await extractor.getColorAsync(url, { crossOrigin: 'anonymous' });
}
finally {
  extractor.destroy();
}
```

Always keep `destroy()` in `finally`. Do the same when a later extraction or application callback can throw.

## Source

Color normalization lives in [`src/color.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/color.ts); extraction types and lifecycle live in [`src/image-color.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/image-color.ts).

## Next steps

Use the exact signatures in [Helpers API](../../reference/helpers/) and connect media events through the [Media guide](../../guides/media/).
