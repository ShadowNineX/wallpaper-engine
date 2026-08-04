---
title: API Reference Entry Points
description: Choose the public wallpaper-engine entry point that owns each type, build API, or browser helper.
---

The package publishes three independent entry points. Import from the owner shown here; internal source paths are not public APIs.

| Entry point | Exports | Runtime and module formats | Dependency boundary |
| --- | --- | --- | --- |
| `wallpaper-engine` | 39 project, listener, media, RGB, and iCUE types; ambient host globals | Type-oriented root; ESM and CommonJS | No runtime API or Vite import |
| `wallpaper-engine/plugin` | Vite plugin, eight property builders, inference/options types, and 15 re-exported project-schema types | ESM only | The only public entry allowed to import Vite |
| `wallpaper-engine/helpers` | 13 side-effect-free functions and four average-color types | ESM and CommonJS | Individually tree-shakeable browser utilities |

## Boundary examples

```ts
import type { WallpaperMediaPlaybackEvent } from 'wallpaper-engine';
import type { WallpaperUserPropertiesOf } from 'wallpaper-engine/plugin';
import { toFileUrl, wallpaperColorToHex } from 'wallpaper-engine/helpers';
import { wallpaperEnginePlugin } from 'wallpaper-engine/plugin';
import 'wallpaper-engine';
```

- Use the root import for host contracts and global augmentation.
- Use `/plugin` from Vite configuration and shared property-schema modules. Browser code may import its types, but should not pull the Vite runtime into application bundles.
- Use `/helpers` in browser runtime modules. Helpers do not register listeners or initialize the simulator.
- Do not cross-import one public entry through another or reach into `dist`/`src` package internals.

## Reference pages

- [Root Types & Host Globals](./root/): all 39 exported types and 12 ambient host names.
- [Plugin API](./plugin/): generation, links, builders, inference, and re-exported schemas.
- [Helpers API](./helpers/): exact signatures, allocation, errors, and lifecycle.

The authoritative export map is [`packages/wallpaper-engine/package.json`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/package.json).

## Next steps

Start with [Root Types](./root/) for host integration, [Plugin API](./plugin/) for build configuration, or [Helpers API](./helpers/) for runtime tasks.
