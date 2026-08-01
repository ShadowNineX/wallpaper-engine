<div align="center">

# wallpaper-engine

TypeScript type definitions, a Vite plugin, and runtime helpers for building [Wallpaper Engine](https://www.wallpaperengine.io/) web wallpapers.

[![npm](https://img.shields.io/npm/v/wallpaper-engine)](https://www.npmjs.com/package/wallpaper-engine)
[![Build Status](https://github.com/ShadowNineX/wallpaper-engine/actions/workflows/test_and_deploy.yml/badge.svg)](https://github.com/ShadowNineX/wallpaper-engine/actions)
[![codecov](https://codecov.io/gh/ShadowNineX/wallpaper-engine/branch/main/graph/badge.svg)](https://codecov.io/gh/ShadowNineX/wallpaper-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[:package: Installation](#installation) · [:electric_plug: Vite Plugin](#vite-plugin) · [:muscle: Strong Typing](#strong-property-typing) · [:wrench: Helpers](#helpers) · [:window: Window Augmentation](#window-augmentation) · [:books: Type Reference](#full-type-reference)

</div>

- **Full type coverage** for the entire Wallpaper Engine Web API — property listeners, media integration, audio, iCUE/LED plugins, and `window` augmentation
- **Vite plugin** that auto-generates `project.json` at build time with full IntelliSense on your property definitions
- **Strong inference** — define your properties once and TypeScript automatically types every key in `applyUserProperties`
- **Tree-shakeable helpers** for color conversion and extraction, audio processing, file URLs, LED encoding, and FPS-limited animation loops

---

## <a id="installation"></a>:package: Installation

```bash
bun add wallpaper-engine
# or
npm install wallpaper-engine
# or
pnpm add wallpaper-engine
```

Vite is an optional peer dependency, required only if you use `wallpaper-engine/plugin`:

```bash
bun add -d vite
```

---

## <a id="package-exports"></a>:inbox_tray: Package Exports

| Import path | Contents |
|---|---|
| `wallpaper-engine` | All TypeScript types + `window` augmentation |
| `wallpaper-engine/plugin` | Vite plugin, property builders, `WallpaperUserPropertiesOf<T>` |
| `wallpaper-engine/helpers` | Runtime utility functions |

---

## <a id="vite-plugin"></a>:electric_plug: Vite Plugin

The plugin emits a `project.json` asset alongside your build so Wallpaper Engine can load the wallpaper without any manual file maintenance.

### Basic setup

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { wallpaperEnginePlugin, colorProperty, sliderProperty, boolProperty } from 'wallpaper-engine/plugin';

export default defineConfig({
  plugins: [
    wallpaperEnginePlugin({
      title: 'My Wallpaper',
      properties: {
        bgcolor:   colorProperty({ text: 'Background Color', value: 'hsl(0 0% 100%)' }),
        speed:     sliderProperty({ text: 'Speed', value: 1, min: 0, max: 10 }),
        showClock: boolProperty({ text: 'Show Clock', value: true }),
      },
    }),
  ],
});
```

This outputs a `project.json` alongside your build:

```json
{
  "file": "index.html",
  "title": "My Wallpaper",
  "type": "web",
  "general": {
    "properties": {
      "bgcolor":   { "type": "color",  "text": "Background Color", "value": "1 1 1",  "index": 0, "order": 0 },
      "speed":     { "type": "slider", "text": "Speed",            "value": 1,        "index": 1, "order": 1, "min": 0, "max": 10 },
      "showClock": { "type": "bool",   "text": "Show Clock",       "value": true,     "index": 2, "order": 2 }
    }
  }
}
```

### Project JSON formatting

Production builds minify `project.json` to one line by default. Development
mode leaves it formatted. Set `minify` explicitly to override either default:

```ts
wallpaperEnginePlugin({
  title: 'My Wallpaper',
  minify: false, // keep production project.json readable
});
```

### Property builder reference

| Builder | Property type | Runtime value |
|---|---|---|
| `colorProperty` | Color picker | Accepts Color.js syntax; emits `WallpaperColorValue` as `"R G B"` (0–1 per channel) |
| `sliderProperty` | Numeric slider | `WallpaperSliderValue` — `value: number` |
| `boolProperty` | Checkbox | `WallpaperBoolValue` — `value: boolean` |
| `comboProperty` | Dropdown | `WallpaperComboValue` — `value: string` (hidden key), `text: string` (label) |
| `textInputProperty` | Text input | `WallpaperTextValue` — `value: string` |
| `fileProperty` | File picker | `WallpaperFileValue` — `value: string` (path, prefix with `file:///`) |
| `directoryProperty` | Directory picker | `WallpaperDirectoryValue` — `value: string` (path) |
| `groupProperty` | Collapsible property section marker | No runtime value |

#### Flexible color defaults

`colorProperty` accepts every color string supported by
[Color.js](https://colorjs.io): CSS named colors, hex, `rgb()`, `hsl()`,
`hwb()`, Lab, LCH, OKLab, OKLCH, wide-gamut `color()` values, and more.
Wallpaper Engine's native `"R G B"` format remains supported:

```ts
const properties = {
  named: colorProperty({ text: 'Named', value: 'rebeccapurple' }),
  hex: colorProperty({ text: 'Hex', value: '#ff8000' }),
  rgb: colorProperty({ text: 'RGB', value: 'rgb(255 128 0 / 50%)' }),
  hsl: colorProperty({ text: 'HSL', value: 'hsl(30 100% 50%)' }),
  perceptual: colorProperty({ text: 'OKLCH', value: 'oklch(70% 0.2 40)' }),
  wideGamut: colorProperty({
    text: 'Display P3',
    value: 'color(display-p3 0 1 0)',
  }),
  native: colorProperty({ text: 'Native', value: '1 0.5 0' }),
};
```

Values are converted immediately to Wallpaper Engine's space-separated sRGB
channels. Wide-gamut colors use Color.js's CSS gamut mapping. Alpha is
discarded because Wallpaper Engine color properties do not support it.
Color.js is bundled into the package; consumers do not install it separately.

Fractional sliders use `precision` and `step` together. `precision` limits the
number of decimal places Wallpaper Engine keeps, and Wallpaper Engine
normalizes `step` to that precision before using it. When `precision` is
omitted, Wallpaper Engine currently behaves as though the slider had
`precision: 1` and `step: 0.1`; for example, `step: 0.005` by itself still
increments by `0.1`.

Always provide a matching `precision` for a custom fractional `step`.
`sliderProperty` retains both fields and derives `step` as
`10 ** -precision` only when `precision` is provided without `step`:

```ts
sliderProperty({
  text: 'Fine adjustment',
  value: 0.5,
  min: 0,
  max: 1,
  fraction: true,
  precision: 3, // derives "step": 0.001
});

sliderProperty({
  text: 'Custom adjustment',
  value: 0.5,
  min: 0,
  max: 1,
  fraction: true,
  precision: 3,
  step: 0.005, // remains 0.005 instead of being normalized to 0.1
});
```

Group markers create collapsible sections in Wallpaper Engine's property list.
Every property after a marker belongs to that section until the next marker;
properties before the first marker remain ungrouped:

```ts
const properties = {
  alwaysVisible: boolProperty({ text: 'Always visible', value: true }),
  appearance: groupProperty({ text: 'Appearance' }),
  background: colorProperty({ text: 'Background', value: '0 0 0' }),
  motion: groupProperty({ text: 'Motion' }),
  speed: sliderProperty({ text: 'Speed', value: 1, min: 0, max: 5 }),
};
```

Group markers are layout-only and are omitted from
`WallpaperUserPropertiesOf<typeof properties>`.

### Localization

Property labels starting with `ui_` are resolved against the localization map:

```ts
wallpaperEnginePlugin({
  title: 'My Wallpaper',
  properties: {
    bgcolor: colorProperty({ text: 'ui_bgcolor', value: '0 0 0' }),
  },
  localization: {
    'en-us': { 'ui_bgcolor': 'Background Color' },
    'de-de': { 'ui_bgcolor': 'Hintergrundfarbe' },
  },
});
```

### Development file and directory simulation

While Vite is serving, the devtools use the browser's native file and folder
pickers. The browser keeps direct references to the selected files and exposes
them as local `blob:` URLs; nothing is uploaded, copied into the project, or
sent through the Vite server. The simulation follows Wallpaper Engine's
property routing:

- `fileProperty` sends one selected image or video through
  `applyUserProperties`.
- `directoryProperty({ mode: 'ondemand' })` sends the selected directory
  through `applyUserProperties`; `wallpaperRequestRandomFileForProperty`
  returns one file from that directory.
- `directoryProperty({ mode: 'fetchall' })` skips `applyUserProperties` and
  sends file diffs through `userDirectoryFilesAddedOrChanged` and
  `userDirectoryFilesRemoved`.

`fileType` applies Wallpaper Engine's image/video extension filters, including
nested directory files. Choosing **Browse** again for a directory reopens the
browser picker and diffs files by relative path, size, and modification time.

Browsers do not expose loadable absolute filesystem paths. In development,
file callbacks therefore receive local `blob:` URLs instead; Wallpaper Engine
continues to provide native filesystem paths in production. Pass either
representation to `toFileUrl`. The devtools revoke local URLs when a selection
is replaced or cleared, and the browser releases all remaining references when
the page closes.

---

## <a id="strong-property-typing"></a>:muscle: Strong Property Typing

Define your properties in a dedicated file, then import it in both `vite.config.ts` and your wallpaper source. `WallpaperUserPropertiesOf<T>` maps each definition to its exact runtime value type automatically.

```ts
// src/properties.ts
import { colorProperty, sliderProperty, boolProperty } from 'wallpaper-engine/plugin';

export const myProperties = {
  bgcolor:   colorProperty({ text: 'Background Color', value: '#000' }),
  speed:     sliderProperty({ text: 'Speed', value: 1, min: 0, max: 5 }),
  showClock: boolProperty({ text: 'Show Clock', value: true }),
};
```

```ts
// vite.config.ts
import { wallpaperEnginePlugin } from 'wallpaper-engine/plugin';
import { myProperties } from './src/properties';

export default defineConfig({
  plugins: [wallpaperEnginePlugin({ title: 'My Wallpaper', properties: myProperties })],
});
```

```ts
// src/wallpaper.ts
import type { WallpaperUserPropertiesOf } from 'wallpaper-engine/plugin';
import type { myProperties } from './properties';
import { wallpaperColorToRgb } from 'wallpaper-engine/helpers';

type MyProps = WallpaperUserPropertiesOf<typeof myProperties>;
// → { bgcolor: WallpaperColorValue; speed: WallpaperSliderValue; showClock: WallpaperBoolValue }

window.wallpaperPropertyListener = {
  applyUserProperties(props: Partial<MyProps>) {
    if (props.bgcolor)   document.body.style.background = wallpaperColorToRgb(props.bgcolor.value);
    if (props.speed)     setSpeed(props.speed.value);       // inferred as number ✓
    if (props.showClock) toggle(props.showClock.value);     // inferred as boolean ✓
  },
};
```

---

## <a id="helpers"></a>:wrench: Helpers

All helpers are side-effect-free and individually tree-shakeable.

```ts
import {
  colorToWallpaperColor,
  parseWallpaperColor,
  wallpaperColorToRgb,
  wallpaperColorToHex,
  createAverageColorExtractor,
  getAverageColor,
  toFileUrl,
  clampAudio,
  leftChannel,
  rightChannel,
  encodeCanvasForLed,
  createFpsLimiter,
} from 'wallpaper-engine/helpers';
```

### Color

```ts
// Any Color.js-supported string → Wallpaper Engine "R G B"
colorToWallpaperColor('hsl(120 100% 50%)'); // → "0 1 0"

// "R G B" string (0–1 per channel) → { r, g, b } (0–255)
const { r, g, b } = parseWallpaperColor(props.bgcolor.value);

// → CSS "rgb(255,128,0)"
el.style.color = wallpaperColorToRgb(props.bgcolor.value);

// → CSS "#ff8000"
el.style.color = wallpaperColorToHex(props.bgcolor.value);
```

#### Image and media color extraction

`getAverageColor` accepts an image URL, data/blob URL, `HTMLImageElement`,
`HTMLVideoElement`, canvas, `OffscreenCanvas`, `ImageBitmap`, or `VideoFrame`.
It creates and disposes its extraction canvas automatically:

```ts
const color = await getAverageColor(image, {
  algorithm: 'dominant',
  mode: 'precision',
  ignoredColor: [255, 255, 255, 255, 10],
});

document.body.style.backgroundColor = color.hex;
```

For multiple images, cropped regions, or live video frames, reuse one extractor:

```ts
const extractor = createAverageColorExtractor();

const full = await extractor.getColorAsync(image);
const corner = await extractor.getColorAsync(image, {
  left: 0,
  top: 0,
  width: 200,
  height: 200,
});
const currentFrame = extractor.getColor(video, { mode: 'speed' });
const raw = extractor.getColorFromArray4(rgbaPixels, { algorithm: 'sqrt' });

extractor.destroy();
```

All FastAverageColor options are supported and forwarded unchanged:

| Option | Purpose |
|---|---|
| `defaultColor` | RGBA fallback when no usable pixels are available |
| `ignoredColor` | One RGB/RGBA color, a color with a matching threshold, or a list of them |
| `mode` | `'speed'` downsizes large sources; `'precision'` samples at source size |
| `algorithm` | `'simple'`, `'sqrt'` (default), or `'dominant'` |
| `step` | Samples every nth pixel |
| `left` | Left edge of the sampled source region |
| `top` | Top edge of the sampled source region |
| `width` | Width of the sampled source region |
| `height` | Height of the sampled source region |
| `silent` | Suppresses synchronous extraction errors in the console |
| `crossOrigin` | Sets `crossOrigin` when loading a string source |
| `dominantDivider` | Controls RGB bucket size for the dominant algorithm |

Results include `rgb`, `rgba`, `hex`, `hexa`, raw RGBA `value`, `isDark`, and
`isLight`. The reusable extractor also accepts `number[]`, `Uint8Array`, and
`Uint8ClampedArray` RGBA pixel data through `getColorFromArray4`.

### Files

```ts
// Prefix a WE path with file:/// before using it as an <img> or <video> src
img.src = toFileUrl(props.myimage.value);
```

### Audio

```ts
window.wallpaperRegisterAudioListener((raw) => {
  const audio = clampAudio(raw);     // clamp all 128 values to 0–1
  const left  = leftChannel(audio);  // indices 0–63  (bass → treble)
  const right = rightChannel(audio); // indices 64–127 (bass → treble)
  renderBars(left, right);
});
```

> [!IMPORTANT]
> The Vite plugin scans emitted JavaScript and HTML for `wallpaperRegisterAudioListener(...)` calls and automatically writes `"supportsaudioprocessing": true` under `"general"`. Calls through `window`, `globalThis`, and the bare global are detected.
>
> Detection runs on production output. If the listener is registered through an alias or generated runtime code, set `supportsAudioProcessing: true` explicitly. Set it to `false` only when you need to suppress automatic detection.

### LED / RGB

```ts
// Encode a canvas as the RGB byte string expected by setAllDevicesByImageData
const canvas  = document.getElementById('RGBCanvas') as HTMLCanvasElement;
const encoded = encodeCanvasForLed(canvas);
window.wpPlugins.led.setAllDevicesByImageData(encoded, canvas.width, canvas.height);
```

### FPS-limited animation loop

Mirrors the FPS cap delivered by `applyGeneralProperties`. Pass `0` for unlimited.

```ts
const loop = createFpsLimiter((dt) => renderFrame(dt));

window.wallpaperPropertyListener = {
  applyGeneralProperties(props) {
    if (props.fps !== undefined) loop.setLimit(props.fps);
  },
};

window.onload = () => loop.start();
```

---

## <a id="window-augmentation"></a>:window: Window Augmentation

If you're not using Vite or don't need the plugin, the main `wallpaper-engine` entry is all you need. A single side-effect import augments the global `Window` interface so every WE API is fully typed — no manual `declare` blocks, no runtime cost.

```ts
import 'wallpaper-engine';

// All of these are now fully typed:
window.wallpaperPropertyListener = { ... };
window.wallpaperRegisterAudioListener((audio) => { ... });
window.wallpaperRequestRandomFileForProperty('mydir');
window.wallpaperPluginListener = { onPluginLoaded(name, version) { ... } };
window.wpPlugins.led.setAllDevicesByImageData(encoded, w, h);
window.cue.setLedsColorsAsync(deviceIndex, leds);

// Media integration
window.wallpaperRegisterMediaPropertiesListener((e) => { /* e.title, e.artist, ... */ });
window.wallpaperRegisterMediaPlaybackListener((e) => { /* e.state */ });
window.wallpaperRegisterMediaThumbnailListener((e) => { /* e.thumbnail (base64 PNG) */ });
```

The import is erased at compile time — nothing is added to your bundle.

Two alternatives that also work without an `import` in your source:

**`tsconfig.json`** — applies the augmentation project-wide, no import needed anywhere:
```json
{
  "compilerOptions": {
    "types": ["wallpaper-engine"]
  }
}
```

**Triple-slash reference** — per-file, useful if you only want types in specific files:
```ts
/// <reference types="wallpaper-engine" />
```

---

## <a id="full-type-reference"></a>:books: Full Type Reference

All types are exported from `wallpaper-engine` (main entry).

### Property definition types (`project.json`)

`WallpaperColorProperty` · `WallpaperSliderProperty` · `WallpaperBoolProperty` · `WallpaperComboProperty` · `WallpaperTextInputProperty` · `WallpaperFileProperty` · `WallpaperDirectoryProperty` · `WallpaperGroupProperty` · `WallpaperPropertyDefinition` · `WallpaperProject` · `WallpaperProjectGeneral` · `WallpaperLocalization`

### Runtime value types (`applyUserProperties`)

`WallpaperColorValue` · `WallpaperSliderValue` · `WallpaperBoolValue` · `WallpaperComboValue` · `WallpaperTextValue` · `WallpaperFileValue` · `WallpaperDirectoryValue` · `WallpaperUserProperties` · `WallpaperGeneralProperties`

### Listener interfaces

`WallpaperPropertyListener` · `WallpaperPluginListener`

### Media integration

`WallpaperMediaStatusEvent` · `WallpaperMediaPropertiesEvent` · `WallpaperMediaThumbnailEvent` · `WallpaperMediaPlaybackEvent` · `WallpaperMediaPlaybackState` · `WallpaperMediaTimelineEvent`

### iCUE / LED

`WallpaperCuePlugin` · `WallpaperLedPlugin` · `CueDeviceInfo` · `CueLedColor` · `CueLedPosition` · `CueProtocolDetails`

---

## <a id="building"></a>:building_construction: Building

```bash
bun run build      # production build (ESM + CJS + .d.ts)
bun run dev        # watch mode
bun run typecheck  # type-check without emitting
```

Output goes to `dist/` with the following structure:

```
dist/
  index.js / index.cjs / index.d.ts
  helpers.js / helpers.cjs / helpers.d.ts
  plugin/
    index.js / index.cjs / index.d.ts
```

