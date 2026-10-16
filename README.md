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

`wallpaper-engine` provides TypeScript types, Vite integration, and browser utilities for [Wallpaper Engine](https://www.wallpaperengine.io/) web wallpapers. Define your properties once, use them in typed host callbacks, and preview changes in the browser before testing in Wallpaper Engine.

## Features

- **Typed host APIs** for user properties, audio, media, files, and RGB integrations.
- **Shared property schemas** that generate `project.json` and infer callback values.
- **Browser devtools** with property controls, audio and media simulation, and performance diagnostics. Float, dock, or open the panel in a separate window.
- **Runtime helpers** for colors, audio analysis and tempo estimation, media, files, and frame pacing.
- **Build integration** for project metadata, previews, and links to local Wallpaper Engine projects.

The published package has no runtime dependencies. The devtools client is bundled and included only during development.

## Installation

```bash
bun add wallpaper-engine
```

For Vite integration, also install Vite:

```bash
bun add --dev vite
```

Follow the **[Quick Start](https://shadowninex.github.io/wallpaper-engine/getting-started/quick-start/)** to create a wallpaper with typed properties and the development simulator. The [Installation guide](https://shadowninex.github.io/wallpaper-engine/getting-started/installation/) covers TypeScript setup and other package managers.

## Documentation and examples

Setup instructions, working examples, and API details live in the [documentation](https://shadowninex.github.io/wallpaper-engine/).

| Topic | Documentation |
| --- | --- |
| Working examples | [Typed properties, audio, and media](https://shadowninex.github.io/wallpaper-engine/examples/) |
| Property definitions and typed callbacks | [Property Schemas](https://shadowninex.github.io/wallpaper-engine/guides/property-schemas/) · [Type Inference](https://shadowninex.github.io/wallpaper-engine/guides/type-inference/) |
| Audio and media integration | [Audio](https://shadowninex.github.io/wallpaper-engine/guides/audio/) · [Media](https://shadowninex.github.io/wallpaper-engine/guides/media/) |
| Development and production | [Simulator](https://shadowninex.github.io/wallpaper-engine/devtools/simulation/) · [Build and Workshop workflow](https://shadowninex.github.io/wallpaper-engine/build/workshop-workflow/) |
| Public API and host coverage | [API Reference](https://shadowninex.github.io/wallpaper-engine/reference/) · [Web API Coverage](https://shadowninex.github.io/wallpaper-engine/reference/web-api-coverage/) |

The [Vue demo](https://github.com/ShadowNineX/wallpaper-engine/tree/main/demo) combines these features in a complete consumer application. The package can also be used with vanilla TypeScript and other browser frameworks.

## Package entry points

| Import | Use |
| --- | --- |
| `wallpaper-engine` | Host types, typed listeners, and browser-global declarations |
| `wallpaper-engine/plugin` | Vite plugin, property builders, and project generation |
| `wallpaper-engine/helpers` | Tree-shakeable browser utilities |

Vite is an optional peer dependency used only by the plugin entry point. Register host listeners immediately during module evaluation, and test the finished wallpaper in Wallpaper Engine; the simulator covers development workflows rather than every native host behavior.

## Development

Run workspace commands from the repository root with [Bun](https://bun.sh/):

```bash
bun install
bun run build
bun run dev:demo
```

Use `bun run dev:docs` to work on the documentation. Before submitting changes, run `bun run lint`, `bun run typecheck`, and `bun run test:run`.

The root build bundles devtools before building the library. Build the documentation separately with `bun run build:docs`.

## License

[MIT](https://github.com/ShadowNineX/wallpaper-engine/blob/main/LICENSE)
