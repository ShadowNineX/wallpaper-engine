---
title: Quick Start
description: Define a shared property schema, configure the Vite plugin, and consume partial typed host updates safely.
---

Build the property contract once, use it during the Vite build, and derive the exact runtime callback shape from the same record.

## 1. Define shared properties

```ts
// src/properties.ts
import {
  boolProperty,
  colorProperty,
  groupProperty,
  sliderProperty,
} from 'wallpaper-engine/plugin';

export const properties = {
  appearance: groupProperty({ text: 'Appearance' }),
  accent: colorProperty({ text: 'Accent', value: 'oklch(70% 0.18 250)' }),
  intensity: sliderProperty({
    text: 'Intensity',
    value: 0.5,
    min: 0,
    max: 1,
    fraction: true,
    precision: 2,
  }),
  showClock: boolProperty({ text: 'Show clock', value: true }),
};
```

The builders add Wallpaper Engine's discriminants while preserving your options. The group controls editor layout but produces no runtime value.

## 2. Add the Vite plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { wallpaperEnginePlugin } from 'wallpaper-engine/plugin';
import { properties } from './src/properties';

export default defineConfig({
  plugins: [
    wallpaperEnginePlugin({
      title: 'My Wallpaper',
      properties,
    }),
  ],
});
```

During `vite dev`, the plugin injects the development simulator by default. It exposes Wallpaper Engine-compatible globals and lets you send property, runtime, audio, and media events to the page.

During `vite build`, the plugin writes `project.json` beside the built `index.html`. It is minified by default; set `minify: false` to pretty-print it. `vite dev` injects the simulator and does not write `project.json`; production output never includes the simulator.

## 3. Register the host listener immediately

```ts
import type { WallpaperUserPropertiesOf } from 'wallpaper-engine/plugin';
import type { properties } from './properties';
import { wallpaperColorToHex } from 'wallpaper-engine/helpers';
// src/wallpaper.ts
import 'wallpaper-engine';

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
        '--intensity',
        String(values.intensity.value),
      );
    }

    if (values.showClock) {
      document.body.classList.toggle('clock-hidden', !values.showClock.value);
    }
  },
};
```

Register listeners at module scope—not in `onMounted`, `window.onload`, or a timer. Wallpaper Engine may deliver startup events before lifecycle hooks, and later property callbacks contain only changed keys. The `Partial<UserProperties>` annotation and per-key guards encode that behavior.

The inferred values are host-shaped wrappers: `accent.value` is a Wallpaper Engine color string, `intensity.value` is a number, and `showClock.value` is a boolean. The `appearance` group key is omitted.

:::tip[Framework-independent pattern]
The consumer demo registers during root component setup, before `onMounted`. For the strongest startup guarantee, production integrations should use a separately imported module that registers during module evaluation. React, Svelte, Vue, and vanilla applications must not wait for lifecycle hooks or timers.
:::

## Go deeper

- [Property schemas](../../guides/property-schemas/) covers every builder and ordering rule.
- [Type inference](../../guides/type-inference/) explains wrappers, group omission, and partial updates.
- [Host listeners](../../guides/host-listeners/) covers the complete callback surface.
- [Project metadata](../../build/project-metadata/) documents generated `project.json` and precedence.
- [Development simulation](../../devtools/simulation/) explains the injected overlay.

The complete working pattern lives in [`demo/src/wallpaper.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/demo/src/wallpaper.ts) and [`demo/src/App.vue`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/demo/src/App.vue).

## Next steps

Define the complete editor contract in [Property Schemas](../../guides/property-schemas/), then connect every host callback in [Host Listeners](../../guides/host-listeners/).
