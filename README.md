# wallpaper-engine

TypeScript type definitions, a Vite plugin, and runtime helpers for building [Wallpaper Engine](https://www.wallpaperengine.io/) web wallpapers.

- **Full type coverage** for the entire Wallpaper Engine Web API — property listeners, media integration, audio, iCUE/LED plugins, and `window` augmentation
- **Vite plugin** that auto-generates `project.json` at build time with full IntelliSense on your property definitions
- **Strong inference** — define your properties once and TypeScript automatically types every key in `applyUserProperties`
- **Tree-shakeable helpers** for color conversion, audio processing, file URLs, LED encoding, and FPS-limited animation loops

---

## Installation

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

## Package Exports

| Import path | Contents |
|---|---|
| `wallpaper-engine` | All TypeScript types + `window` augmentation |
| `wallpaper-engine/plugin` | Vite plugin, property builders, `WallpaperUserPropertiesOf<T>` |
| `wallpaper-engine/helpers` | Runtime utility functions |

---

## Vite Plugin

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
      supportsAudioProcessing: true,
      properties: {
        bgcolor:   colorProperty({ text: 'Background Color', value: '1 1 1' }),
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
  "supportsaudioprocessing": true,
  "general": {
    "properties": {
      "bgcolor":   { "type": "color",  "text": "Background Color", "value": "1 1 1",  "index": 0, "order": 0 },
      "speed":     { "type": "slider", "text": "Speed",            "value": 1,        "index": 1, "order": 1, "min": 0, "max": 10 },
      "showClock": { "type": "bool",   "text": "Show Clock",       "value": true,     "index": 2, "order": 2 }
    }
  }
}
```

### Property builder reference

| Builder | Property type | Runtime value |
|---|---|---|
| `colorProperty` | Color picker | `WallpaperColorValue` — `value: "R G B"` (0–1 per channel) |
| `sliderProperty` | Numeric slider | `WallpaperSliderValue` — `value: number` |
| `boolProperty` | Checkbox | `WallpaperBoolValue` — `value: boolean` |
| `comboProperty` | Dropdown | `WallpaperComboValue` — `value: string` (hidden key), `text: string` (label) |
| `textInputProperty` | Text input | `WallpaperTextValue` — `value: string` |
| `fileProperty` | File picker | `WallpaperFileValue` — `value: string` (path, prefix with `file:///`) |
| `directoryProperty` | Directory picker | `WallpaperDirectoryValue` — `value: string` (path) |

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

---

## Strong Property Typing

Define your properties in a dedicated file, then import it in both `vite.config.ts` and your wallpaper source. `WallpaperUserPropertiesOf<T>` maps each definition to its exact runtime value type automatically.

```ts
// src/properties.ts
import { colorProperty, sliderProperty, boolProperty } from 'wallpaper-engine/plugin';

export const myProperties = {
  bgcolor:   colorProperty({ text: 'Background Color', value: '0 0 0' }),
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

## Helpers

All helpers are side-effect-free and individually tree-shakeable.

```ts
import {
  parseWallpaperColor,
  wallpaperColorToRgb,
  wallpaperColorToHex,
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
// "R G B" string (0–1 per channel) → { r, g, b } (0–255)
const { r, g, b } = parseWallpaperColor(props.bgcolor.value);

// → CSS "rgb(255,128,0)"
el.style.color = wallpaperColorToRgb(props.bgcolor.value);

// → CSS "#ff8000"
el.style.color = wallpaperColorToHex(props.bgcolor.value);
```

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

## Window Augmentation

Importing from `wallpaper-engine` automatically augments the global `Window` interface — no manual `declare` blocks needed.

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

---

## Full Type Reference

All types are exported from `wallpaper-engine` (main entry).

### Property definition types (`project.json`)

`WallpaperColorProperty` · `WallpaperSliderProperty` · `WallpaperBoolProperty` · `WallpaperComboProperty` · `WallpaperTextInputProperty` · `WallpaperFileProperty` · `WallpaperDirectoryProperty` · `WallpaperPropertyDefinition` · `WallpaperProject` · `WallpaperProjectGeneral` · `WallpaperLocalization`

### Runtime value types (`applyUserProperties`)

`WallpaperColorValue` · `WallpaperSliderValue` · `WallpaperBoolValue` · `WallpaperComboValue` · `WallpaperTextValue` · `WallpaperFileValue` · `WallpaperDirectoryValue` · `WallpaperUserProperties` · `WallpaperGeneralProperties`

### Listener interfaces

`WallpaperPropertyListener` · `WallpaperPluginListener`

### Media integration

`WallpaperMediaStatusEvent` · `WallpaperMediaPropertiesEvent` · `WallpaperMediaThumbnailEvent` · `WallpaperMediaPlaybackEvent` · `WallpaperMediaPlaybackState` · `WallpaperMediaTimelineEvent`

### iCUE / LED

`WallpaperCuePlugin` · `WallpaperLedPlugin` · `CueDeviceInfo` · `CueLedColor` · `CueLedPosition` · `CueProtocolDetails`

---

## Building

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

