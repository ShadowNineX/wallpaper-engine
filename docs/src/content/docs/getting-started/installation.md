---
title: Installation
description: Install wallpaper-engine and choose the root, plugin, and helpers entry points for a Vite wallpaper.
---

Install the package from your project directory. Bun is the package manager used by this repository.

```bash
bun add wallpaper-engine
```

Equivalent commands:

```bash
npm install wallpaper-engine
pnpm add wallpaper-engine
```

## Install Vite only for the plugin

`wallpaper-engine/plugin` is the only entry point that imports Vite. Vite is an optional peer dependency, so install it when you use the build plugin or property builders:

```bash
bun add --dev vite
```

A wallpaper that only consumes root types or `wallpaper-engine/helpers` does not need Vite because of this package.

## Choose an entry point

| Import | Responsibility | Runtime format |
| --- | --- | --- |
| `wallpaper-engine` | Type-only project, listener, media, hardware, and browser-global contracts | ESM and CommonJS |
| `wallpaper-engine/plugin` | Vite integration, property builders, inferred runtime types, metadata, and project links | ESM only |
| `wallpaper-engine/helpers` | Side-effect-free browser utilities for colors, files, audio, media, LED frames, and FPS limiting | ESM and CommonJS |

The public entries are independent. Import each capability from its owning entry rather than reaching into package internals.

## Make host globals visible to TypeScript

The root entry augments `Window` and declares Wallpaper Engine's matching bare globals. Choose one project-wide method.

### Add the package to `compilerOptions.types`

```json
{
  "compilerOptions": {
    "types": ["wallpaper-engine"]
  }
}
```

This is the best fit when every browser module in the project may use Wallpaper Engine globals. Preserve any other explicit entries already in the array.

### Import the root entry once

```ts
import 'wallpaper-engine';
```

Use this side-effect import in a runtime entry module when changing the TypeScript configuration is undesirable. The package has no runtime API at the root; the import exists to load its declarations.

:::caution[Do not import the plugin for ambient types]
`wallpaper-engine/plugin` is ESM-only and owns the Vite integration. Keep browser runtime code on the root types and `/helpers` entry points.
:::

## Module compatibility

- ESM projects may import all three entries.
- CommonJS consumers may load `wallpaper-engine` and `wallpaper-engine/helpers` through their CommonJS exports.
- `wallpaper-engine/plugin` is ESM-only because modern Vite configuration is ESM. Use an ESM Vite config rather than `require()`.

See the package's [export map](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/package.json) for the authoritative file mapping.

## Next steps

Continue to the [quick start](../quick-start/) to define properties once, generate `project.json`, and register the host listener before startup events can fire.
