<p align="center">
  <a href="https://shadowninex.github.io/wallpaper-engine/">
    <img alt="wallpaper-engine logo" src="https://raw.githubusercontent.com/ShadowNineX/wallpaper-engine/main/docs/public/favicon.svg" width="96" height="96">
  </a>
</p>

<h1 align="center">wallpaper-engine</h1>

<p align="center">
  Typed host contracts, Vite tooling, runtime helpers, and a development simulator for Wallpaper Engine web wallpapers.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/wallpaper-engine"><img alt="npm version" src="https://img.shields.io/npm/v/wallpaper-engine"></a>
  <a href="https://github.com/ShadowNineX/wallpaper-engine/actions/workflows/test_and_deploy.yml"><img alt="build status" src="https://github.com/ShadowNineX/wallpaper-engine/actions/workflows/test_and_deploy.yml/badge.svg"></a>
  <a href="https://codecov.io/gh/ShadowNineX/wallpaper-engine"><img alt="coverage" src="https://codecov.io/gh/ShadowNineX/wallpaper-engine/branch/main/graph/badge.svg"></a>
  <a href="https://github.com/ShadowNineX/wallpaper-engine/blob/main/LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
</p>

<p align="center">
  <a href="https://shadowninex.github.io/wallpaper-engine/">Documentation</a> ·
  <a href="https://github.com/ShadowNineX/wallpaper-engine/tree/main/demo">Demo source</a> ·
  <a href="https://github.com/ShadowNineX/wallpaper-engine">Repository</a>
</p>

`wallpaper-engine` lets one property schema drive Wallpaper Engine's editor metadata, inferred runtime callbacks, and a Vite development simulator. The published package has no runtime dependencies; Vite is an optional peer used only by the plugin entry point.

## Install

```bash
bun add wallpaper-engine
```

Equivalent commands: `npm install wallpaper-engine` or `pnpm add wallpaper-engine`.

Install Vite when using `wallpaper-engine/plugin`:

```bash
bun add --dev vite
```

## Quick start

```ts
// src/properties.ts
import { colorProperty } from 'wallpaper-engine/plugin';

export const properties = {
  accent: colorProperty({ text: 'Accent', value: '#60a5fa' }),
};

// vite.config.ts
import { defineConfig } from 'vite';
import { wallpaperEnginePlugin } from 'wallpaper-engine/plugin';
import { properties } from './src/properties';

export default defineConfig({
  plugins: [wallpaperEnginePlugin({ title: 'My Wallpaper', properties })],
});

// src/wallpaper.ts
import type { WallpaperUserPropertiesOf } from 'wallpaper-engine/plugin';
import { wallpaperColorToHex } from 'wallpaper-engine/helpers';
import type { properties } from './properties';
import 'wallpaper-engine';

type UserProperties = WallpaperUserPropertiesOf<typeof properties>;

window.wallpaperPropertyListener = {
  applyUserProperties(values: Partial<UserProperties>) {
    if (values.accent) {
      document.body.style.backgroundColor = wallpaperColorToHex(
        values.accent.value,
      );
    }
  },
};
```

Register host listeners immediately at module scope. Wallpaper Engine may send startup events before framework lifecycle hooks, and later property callbacks contain only changed keys.

By default, the Vite plugin injects the simulator during development and emits `project.json` during production builds. Set `devtools: false` to disable development injection.

Written builds preserve prior top-level Workshop metadata and preview bytes while regenerating ordinary properties, localization, and audio configuration. When `metadataFile` is configured, editor preview bytes are also synchronized to the source-controlled sibling `<metadata stem>.assets/<preview>` sidecar for clean-clone rebuilds. Configure Wallpaper Engine's browser color with `schemeColor`; when omitted, a valid editor-managed value from previous output is preserved.

## Public entry points

| Entry point | Responsibility | Format |
| --- | --- | --- |
| `wallpaper-engine` | Project, listener, audio, media, RGB, iCUE, and ambient browser-global types | ESM + CommonJS |
| `wallpaper-engine/plugin` | Vite integration, property builders, inferred runtime types, metadata, and project links | ESM only |
| `wallpaper-engine/helpers` | Side-effect-free, tree-shakeable browser utilities | ESM + CommonJS |

### Audio spectrum analysis

`wallpaper-engine/helpers` includes one-shot frame metrics and a reusable,
allocation-free stateful analyzer for Wallpaper Engine's 128-value stereo
spectrum callback:

```ts
import { analyzeAudioFrame, createAudioAnalyzer } from 'wallpaper-engine/helpers';

const analyzer = createAudioAnalyzer({
  sensitivity: 0.65,
  eventCooldown: 0.13,
  peakDecayPerSecond: 1.5,
});
let previousTime = performance.now();

window.wallpaperRegisterAudioListener((audioArray) => {
  const now = performance.now();
  analyzer.process(audioArray, (now - previousTime) / 1000);
  previousTime = now;

  const current = analyzeAudioFrame(audioArray);
  renderLevel(current.rmsVolume, analyzer.decayingPeakVolume);
  if (analyzer.beat > 0)
    pulse(analyzer.beat);
});
```

`analyzeAudioFrame()` reports `averageVolume`, `rmsVolume`, `peakVolume`,
left/right volume and stereo balance, plus ordered-spectrum `bass`,
`midrange`, and `treble` averages. `createAudioAnalyzer()` retains those
current metrics and adds a decaying peak envelope, a log-flux autocorrelation
`bpm` estimate, and per-frame `kick`, `clap`, `hiHat`, `beat`, and general
`onset` strengths. BPM estimation starts after four seconds, expands to a
rolling eight-second window, and holds the last accepted tempo through
low-confidence passages instead of flickering back to zero. Configure detector
strictness with `sensitivity` (0–1), same-band retrigger delay with
`eventCooldown` (seconds), and envelope decay with `peakDecayPerSecond`.

All volume values are normalized magnitudes derived from the spectrum captured
by Wallpaper Engine. They do not expose Windows master volume or a media
player's volume slider. Instrument detections are spectrum-based transient
estimates, not source separation.

Full guides and exhaustive API references: **[shadowninex.github.io/wallpaper-engine](https://shadowninex.github.io/wallpaper-engine/)**.

## Development

Run workspace commands from the repository root with [Bun](https://bun.sh/):

```bash
bun install
bun run dev:demo
bun run dev:docs
bun run lint
bun run typecheck
bun run test:run
bun run build
```

`bun run build` preserves the required devtools-first, library-second package build order. The documentation site has its own `bun run build:docs` command.

## License

[MIT](https://github.com/ShadowNineX/wallpaper-engine/blob/main/LICENSE)
