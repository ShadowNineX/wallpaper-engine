<h1 align="center">wallpaper-engine</h1>

<p align="center">
  Build typed, Vite-powered web wallpapers for Wallpaper Engine.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/wallpaper-engine"><img alt="npm version" src="https://img.shields.io/npm/v/wallpaper-engine"></a>
  <a href="https://github.com/ShadowNineX/wallpaper-engine/actions"><img alt="build status" src="https://github.com/ShadowNineX/wallpaper-engine/actions/workflows/test_and_deploy.yml/badge.svg"></a>
  <a href="https://codecov.io/gh/ShadowNineX/wallpaper-engine"><img alt="coverage" src="https://codecov.io/gh/ShadowNineX/wallpaper-engine/branch/main/graph/badge.svg"></a>
  <a href="./LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
</p>

<p align="center">
  <a href="#quick-start">🚀 Quick start</a> ·
  <a href="#devtools">🛠️ Devtools</a> ·
  <a href="#properties">🎛️ Properties</a> ·
  <a href="#runtime-helpers">🧰 Helpers</a> ·
  <a href="#wallpaper-engine-types">🪟 Types</a> ·
  <a href="#development">🏗️ Development</a>
</p>

`wallpaper-engine` is a TypeScript toolkit for [Wallpaper Engine](https://www.wallpaperengine.io/) web wallpapers. It combines the host API types, a `project.json`-generating Vite plugin, an in-browser host simulator, and focused runtime helpers in one package.

## <a id="what-you-get"></a>✨ What you get

- Complete types for properties, audio, media, playback, plugin events, iCUE, LED devices, and Wallpaper Engine's browser globals.
- A Vite plugin that generates `project.json`, normalizes property definitions, and detects audio-listener usage.
- An in-browser devtools overlay for testing properties and host events without reopening Wallpaper Engine.
- Exact `applyUserProperties` inference from the property object you already define.
- Tree-shakeable helpers for colors, image color extraction, audio data, file URLs, LED canvases, and FPS-limited loops.
- No runtime dependencies in the published package. Vite is an optional peer dependency.

## <a id="installation"></a>📦 Installation

```bash
bun add wallpaper-engine
```

The equivalent commands are `npm install wallpaper-engine` and `pnpm add wallpaper-engine`.

Install Vite only when using the plugin entry point:

```bash
bun add --dev vite
```

## <a id="quick-start"></a>🚀 Quick start

### 1. Define properties once

```ts
// src/properties.ts
import {
  boolProperty,
  colorProperty,
  groupProperty,
  sliderProperty,
} from "wallpaper-engine/plugin";

export const properties = {
  appearance: groupProperty({ text: "Appearance" }),
  accent: colorProperty({ text: "Accent", value: "oklch(70% 0.18 250)" }),
  intensity: sliderProperty({
    text: "Intensity",
    value: 0.5,
    min: 0,
    max: 1,
    fraction: true,
    precision: 2,
  }),
  showClock: boolProperty({ text: "Show clock", value: true }),
};
```

### 2. Add the Vite plugin

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { wallpaperEnginePlugin } from "wallpaper-engine/plugin";
import { properties } from "./src/properties";

export default defineConfig({
  plugins: [
    wallpaperEnginePlugin({
      title: "My Wallpaper",
      properties,
    }),
  ],
});
```

The production build now includes a minified `project.json` beside `index.html`. Development output stays readable.

### 3. Use inferred runtime values

```ts
// src/wallpaper.ts
import "wallpaper-engine";
import { wallpaperColorToHex } from "wallpaper-engine/helpers";
import type { WallpaperUserPropertiesOf } from "wallpaper-engine/plugin";
import type { properties } from "./properties";

type UserProperties = WallpaperUserPropertiesOf<typeof properties>;

window.wallpaperPropertyListener = {
  applyUserProperties(values: Partial<UserProperties>) {
    if (values.accent) {
      document.body.style.backgroundColor = wallpaperColorToHex(
        values.accent.value,
      );
    }

    if (values.intensity) {
      document.documentElement.style.setProperty(
        "--intensity",
        String(values.intensity.value),
      );
    }

    if (values.showClock) {
      document.body.classList.toggle("clock-hidden", !values.showClock.value);
    }
  },
};
```

`accent.value` is inferred as a Wallpaper Engine color string, `intensity.value` as `number`, and `showClock.value` as `boolean`. Group markers are excluded automatically.

## <a id="package-entry-points"></a>🧩 Package entry points

| Import | Use it for | Formats |
| --- | --- | --- |
| `wallpaper-engine` | Host API types, global `Window` augmentation, and playback constants | ESM and CJS |
| `wallpaper-engine/plugin` | Vite integration, property builders, and inferred property types | ESM |
| `wallpaper-engine/helpers` | Side-effect-free runtime utilities | ESM and CJS |

The entry points are independent. Projects that only need host types do not load Vite or the helper implementation.

## <a id="devtools"></a>🛠️ Devtools

Run Vite normally:

```bash
bun run dev
```

During `vite dev`, the plugin injects a draggable simulator into the page. It can:

- edit every configured property and replay the complete property state;
- change FPS, pause, resume, and emit plugin events;
- generate silent, random, sine, bass, and stereo audio frames;
- simulate media metadata, playback, thumbnail, and timeline events;
- browse local files and directories using browser-native pickers;
- show the embedded package version and Git revision in its header.

The devtools are never injected into production builds. Disable them locally when needed:

```ts
wallpaperEnginePlugin({
  title: "My Wallpaper",
  devtools: false,
});
```

### Files and directories in development

Browsers do not expose native absolute filesystem paths. The simulator therefore passes local `blob:` URLs while developing; Wallpaper Engine continues to pass filesystem paths in production. `toFileUrl` accepts both representations.

Property routing matches the host:

- `fileProperty` delivers one selected image or video through `applyUserProperties`.
- `directoryProperty({ mode: "ondemand" })` delivers the directory property, then answers `wallpaperRequestRandomFileForProperty` with one file.
- `directoryProperty({ mode: "fetchall" })` reports additions, changes, and removals through the directory listener callbacks.

Selected files remain local to the browser. They are not uploaded or copied into the project.

## <a id="vite-plugin"></a>🔌 Vite plugin

```ts
import { wallpaperEnginePlugin } from "wallpaper-engine/plugin";
```

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `title` | `string` | required | Wallpaper title shown by the host |
| `file` | `string` | `"index.html"` | Entry HTML file written to `project.json` |
| `properties` | property record | `{}` | User-configurable Wallpaper Engine properties |
| `localization` | localization record | — | BCP 47 translations for `ui_` labels |
| `metadata` | `WallpaperProjectMetadata` | — | Source-controlled description, preview, tags, ratings, and visibility |
| `metadataFile` | `string` | — | Root-relative or absolute JSON file containing publishing/editor state |
| `devtools` | `boolean` | `true` | Enable the development simulator |
| `minify` | `boolean` | production only | Override environment-based JSON formatting |
| `supportsAudioProcessing` | `boolean` | auto-detected | Force audio support on or off |

The plugin assigns missing `index` and `order` fields by insertion order. Explicit values are preserved.

### Steam Workshop metadata

Keep author-owned publishing values in the plugin configuration:

```ts
wallpaperEnginePlugin({
  title: "Night Sky",
  metadata: {
    description: "An animated night sky.",
    preview: "preview.jpg",
    tags: ["Landscape"],
  },
});
```

`WallpaperProjectMetadata` is exported from both `wallpaper-engine` and `wallpaper-engine/plugin`. Its typed fields are `description`, `preview`, `tags`, `contentrating`, `ratingsex`, `ratingviolence`, and `visibility`. Rating and visibility values remain strings because Wallpaper Engine does not publish their complete serialized domains.

Wallpaper Engine owns Workshop identity and editor state such as `workshopid`, `workshopurl`, `version`, snapshot fields, approval, and monetization. Before Vite cleans the output directory, the plugin reads the existing `project.json` and preserves every non-generated top-level field, including unknown future fields and explicit falsy values. It never writes editor state back into source files.

The merge is shallow and uses this exact precedence:

1. the previous output's `project.json`;
2. the optional `metadataFile`;
3. defined fields from `metadata`;
4. generated `file`, `title`, `type`, and `general`.

Generated core fields are always authoritative. `general` is replaced rather than recursively merged, so stale properties, localization, or audio flags cannot survive a build.

For a clean clone or a separately copied editor project, point `metadataFile` at a flat JSON object:

```ts
wallpaperEnginePlugin({
  title: "Night Sky",
  metadataFile: "wallpaper-engine.metadata.json",
});
```

```json
{
  "description": "An animated night sky.",
  "preview": "preview.jpg",
  "tags": ["Landscape"],
  "workshopid": "1234567890",
  "version": 7
}
```

Leave `file`, `title`, `type`, and `general` out of this file because the plugin regenerates them. Unknown Wallpaper Engine fields are accepted and preserved.

Put the referenced preview at `public/preview.jpg`, or the matching nested path under `public/`. This is the deterministic clean-build path. When rebuilding an existing output, the plugin caches the old preview before cleanup and restores it only if the bundle or `public` directory does not provide a newer file at the same path.

The plugin fails before cleanup when an explicitly configured metadata file is missing or either JSON source is unreadable, malformed, or not a top-level object. It also rejects absolute or escaping preview paths and fails a written build when the final preview is unavailable from the bundle, `public`, or the previous output.

Zero-script Workshop workflow:

1. Commit the author metadata and preview.
2. Build directly to the Vite `outDir` used as the Wallpaper Engine project.
3. Publish that project in Wallpaper Engine.
4. Keep building to the same directory. Generated files refresh while Workshop identity, version, editor state, and preview survive.

Wallpaper Engine may copy an imported build to another directory. Automatic round-tripping works only when later builds target that editor project/output. For a clean clone or a separately copied project, use `metadataFile: "wallpaper-engine.metadata.json"` without generated core keys and keep its preview under `public/`.

### Audio detection

Production JavaScript and HTML are scanned for calls to `wallpaperRegisterAudioListener`. Bare calls and calls through `window` or `globalThis` automatically set `general.supportsaudioprocessing`.

Set `supportsAudioProcessing` explicitly when the listener is aliased or generated dynamically:

```ts
wallpaperEnginePlugin({
  title: "Audio Wallpaper",
  supportsAudioProcessing: true,
});
```

## <a id="properties"></a>🎛️ Properties

Import property builders from `wallpaper-engine/plugin`:

| Builder | Wallpaper Engine control | Runtime value |
| --- | --- | --- |
| `colorProperty` | Color picker | `{ value: string }` |
| `sliderProperty` | Numeric slider | `{ value: number }` |
| `boolProperty` | Checkbox | `{ value: boolean }` |
| `comboProperty` | Dropdown | `{ value: string; text: string }` |
| `textInputProperty` | Text field | `{ value: string }` |
| `fileProperty` | File picker | `{ value: string }` |
| `directoryProperty` | Directory picker | `{ value: string }` |
| `groupProperty` | Collapsible section marker | omitted |

Every builder adds the correct `type` field while preserving Wallpaper Engine's native property shape.

### Colors

`colorProperty` accepts Wallpaper Engine's native `"R G B"` format and every color syntax supported by [Color.js](https://colorjs.io/): named colors, hex, `rgb()`, `hsl()`, `hwb()`, Lab, LCH, OKLab, OKLCH, and wide-gamut `color()` values.

```ts
const colors = {
  named: colorProperty({ text: "Named", value: "rebeccapurple" }),
  hex: colorProperty({ text: "Hex", value: "#ff8000" }),
  perceptual: colorProperty({ text: "OKLCH", value: "oklch(70% 0.2 40)" }),
  wideGamut: colorProperty({
    text: "Display P3",
    value: "color(display-p3 0 1 0)",
  }),
  native: colorProperty({ text: "Native", value: "1 0.5 0" }),
};
```

Defaults are converted to space-separated sRGB channels immediately. Wide-gamut values use Color.js gamut mapping. Alpha is discarded because Wallpaper Engine color properties do not carry it. Color.js is bundled; consumers do not install it.

### Fractional sliders

Wallpaper Engine treats an omitted fractional `precision` as `1`, with an effective step of `0.1`. Provide a matching precision for finer increments:

```ts
sliderProperty({
  text: "Fine adjustment",
  value: 0.5,
  min: 0,
  max: 1,
  fraction: true,
  precision: 3,
  // step is derived as 0.001
});

sliderProperty({
  text: "Custom adjustment",
  value: 0.5,
  min: 0,
  max: 1,
  fraction: true,
  precision: 3,
  step: 0.005,
});
```

An explicit `step` is preserved. When only `precision` is supplied, `sliderProperty` derives `10 ** -precision`.

### Groups

A group marker starts a collapsible section. Properties remain in that group until the next marker; properties before the first marker stay ungrouped.

```ts
const properties = {
  alwaysVisible: boolProperty({ text: "Always visible", value: true }),
  appearance: groupProperty({ text: "Appearance" }),
  background: colorProperty({ text: "Background", value: "0 0 0" }),
  motion: groupProperty({ text: "Motion" }),
  speed: sliderProperty({ text: "Speed", value: 1, min: 0, max: 5 }),
};
```

### Localization

Labels beginning with `ui_` resolve through the localization map:

```ts
wallpaperEnginePlugin({
  title: "My Wallpaper",
  properties: {
    background: colorProperty({ text: "ui_background", value: "0 0 0" }),
  },
  localization: {
    "en-us": { ui_background: "Background color" },
    "de-de": { ui_background: "Hintergrundfarbe" },
  },
});
```

## <a id="runtime-helpers"></a>🧰 Runtime helpers

All helpers are individually tree-shakeable and imported from `wallpaper-engine/helpers`.

| Helper | Purpose |
| --- | --- |
| `colorToWallpaperColor` | Convert a Color.js-supported value to native `"R G B"` |
| `parseWallpaperColor` | Parse native channels into 0–255 RGB values |
| `wallpaperColorToRgb` | Convert native channels to CSS `rgb()` |
| `wallpaperColorToHex` | Convert native channels to CSS hex |
| `getAverageColor` | One-shot image or media color extraction |
| `createAverageColorExtractor` | Reusable color extraction for frames or multiple sources |
| `toFileUrl` | Normalize Wallpaper Engine paths for browser use |
| `clampAudio` | Clamp samples to 0–1 and replace non-finite values |
| `leftChannel` / `rightChannel` | Split a 128-value stereo spectrum |
| `encodeCanvasForLed` | Encode canvas RGB data for Wallpaper Engine LED APIs |
| `createFpsLimiter` | Run `requestAnimationFrame` with a host-controlled FPS cap |

### Color conversion

```ts
import {
  colorToWallpaperColor,
  parseWallpaperColor,
  wallpaperColorToHex,
  wallpaperColorToRgb,
} from "wallpaper-engine/helpers";

colorToWallpaperColor("hsl(120 100% 50%)"); // "0 1 0"
parseWallpaperColor("1 0.5 0");             // { r: 255, g: 128, b: 0 }
wallpaperColorToRgb("1 0.5 0");             // "rgb(255,128,0)"
wallpaperColorToHex("1 0.5 0");             // "#ff8000"
```

`parseWallpaperColor` accepts arbitrary whitespace, rounds to the nearest 8-bit channel, and clamps values outside 0–1. Missing, extra, or non-finite channels throw `TypeError`.

### Image and media colors

`getAverageColor` accepts URLs, data/blob URLs, images, videos, canvases, `OffscreenCanvas`, `ImageBitmap`, and `VideoFrame`:

```ts
import {
  createAverageColorExtractor,
  getAverageColor,
} from "wallpaper-engine/helpers";

const color = await getAverageColor(image, {
  algorithm: "dominant",
  mode: "precision",
  ignoredColor: [255, 255, 255, 255, 10],
});

document.body.style.backgroundColor = color.hex;
```

Reuse an extractor for live media, cropped regions, or raw RGBA arrays:

```ts
const extractor = createAverageColorExtractor();

const frame = extractor.getColor(video, { mode: "speed" });
const corner = await extractor.getColorAsync(image, {
  left: 0,
  top: 0,
  width: 200,
  height: 200,
});
const pixels = extractor.getColorFromArray4(rgbaPixels, {
  algorithm: "sqrt",
});

extractor.destroy();
```

All FastAverageColor options are supported, including crop dimensions, sampling step, ignored colors, fallback color, algorithm, mode, cross-origin behavior, and dominant-color bucket size.

### Audio

```ts
import {
  clampAudio,
  leftChannel,
  rightChannel,
} from "wallpaper-engine/helpers";

window.wallpaperRegisterAudioListener((raw) => {
  const audio = clampAudio(raw);
  const left = leftChannel(audio);   // indices 0–63, bass to treble
  const right = rightChannel(audio); // indices 64–127, bass to treble

  renderBars(left, right);
});
```

`clampAudio` returns a new array, clamps negative and greater-than-one values, and replaces `NaN` or infinities with zero.

### Files, LED data, and frame rate

```ts
import {
  createFpsLimiter,
  encodeCanvasForLed,
  toFileUrl,
} from "wallpaper-engine/helpers";

image.src = toFileUrl(values.cover.value);

const encoded = encodeCanvasForLed(canvas);
window.wpPlugins.led.setAllDevicesByImageData(
  encoded,
  canvas.width,
  canvas.height,
);

const loop = createFpsLimiter((delta) => renderFrame(delta));
window.wallpaperPropertyListener = {
  applyGeneralProperties(properties) {
    if (properties.fps !== undefined) loop.setLimit(properties.fps);
  },
};
loop.start();
```

Pass `0` to `setLimit` for an uncapped animation loop.

## <a id="wallpaper-engine-types"></a>🪟 Wallpaper Engine types

The main entry exposes the host API without requiring handwritten global declarations.

### Project-wide augmentation

Add the package to `compilerOptions.types` when every wallpaper source file should see the globals:

```json
{
  "compilerOptions": {
    "types": ["wallpaper-engine"]
  }
}
```

Alternatively, load the augmentation from one source entry:

```ts
import "wallpaper-engine";
```

Typed globals include:

```ts
window.wallpaperPropertyListener = { /* ... */ };
window.wallpaperRegisterAudioListener((audio) => { /* ... */ });
window.wallpaperRequestRandomFileForProperty("gallery");
window.wallpaperPluginListener = { /* ... */ };
window.wallpaperRegisterMediaPropertiesListener((event) => { /* ... */ });
window.wallpaperRegisterMediaPlaybackListener((event) => { /* ... */ });
window.wallpaperRegisterMediaThumbnailListener((event) => { /* ... */ });
window.wpPlugins.led.setAllDevicesByImageData(data, width, height);
window.cue.setLedsColorsAsync(deviceIndex, colors);
```

### Notable exported types

| Area | Types |
| --- | --- |
| Project definitions | `WallpaperProject`, `WallpaperProjectGeneral`, `WallpaperPropertyDefinition`, property-specific interfaces, `WallpaperLocalization` |
| Runtime properties | `WallpaperUserProperties`, `WallpaperPropertyRuntimeValue`, property-specific value interfaces, `WallpaperGeneralProperties` |
| Listeners | `WallpaperPropertyListener`, `WallpaperPluginListener` |
| Media | Media status, properties, thumbnail, playback, and timeline event types |
| Hardware | `WallpaperCuePlugin`, `WallpaperLedPlugin`, CUE device, LED color, position, and protocol types |

Playback state numbers are defined by Wallpaper Engine at runtime. Compare `event.state` against `window.wallpaperMediaIntegration.PLAYBACK_PLAYING`, `PLAYBACK_PAUSED`, or `PLAYBACK_STOPPED` rather than hard-coding numeric values.

## <a id="development"></a>🏗️ Development

This repository is a Bun workspace containing the published package, the private Vue devtools client, and a consumer demo.

```bash
bun install
bun run typecheck
bun run test:run
bun run build
```

Useful development commands:

```bash
bun run dev           # watch and copy the devtools client
bun run dev:demo      # start the consumer demo
bun run test          # run workspace tests
bun run test:coverage # collect workspace coverage
```

The root build compiles the devtools first, then bundles the library with tsdown and copies the self-contained client into the plugin distribution.

## <a id="license"></a>📄 License

[MIT](./LICENSE) © ShadowNineX
