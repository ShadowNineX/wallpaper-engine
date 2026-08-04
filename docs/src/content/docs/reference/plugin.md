---
title: Plugin API Reference
description: Exact Vite plugin, builder, inference, metadata, and project-link APIs exported by wallpaper-engine/plugin.
---

`wallpaper-engine/plugin` is ESM-only and is the only public entry point that imports Vite.

```ts
import {
  colorProperty,
  wallpaperEnginePlugin,
} from 'wallpaper-engine/plugin';
```

## `wallpaperEnginePlugin()`

```ts
function wallpaperEnginePlugin(
  options: WallpaperEnginePluginOptions,
): import('vite').Plugin;
```

Returns one Vite plugin named `wallpaper-engine`. In serve mode it injects the bundled devtools client unless `devtools: false`. In build mode it captures preservation state, optionally prepares a project link, detects direct audio registration calls, and emits `project.json`. The devtools client is never emitted into production output.

### `WallpaperEnginePluginOptions`

```ts
interface WallpaperEnginePluginOptions {
  file?: string;
  title: string;
  metadata?: WallpaperProjectMetadata;
  metadataFile?: string;
  projectLink?: WallpaperProjectLinkOptions;
  minify?: boolean;
  supportsAudioProcessing?: boolean;
  properties?: Record<string, WallpaperPropertyDefinition>;
  localization?: WallpaperLocalization;
  devtools?: boolean;
}
```

| Field | Behavior |
| --- | --- |
| `file` | Generated entry HTML path; defaults to `'index.html'` |
| `title` | Required generated project title |
| `metadata` | Defined author fields override metadata-file and previous-output values |
| `metadataFile` | Required non-null, non-array top-level JSON object when configured; resolves from final Vite root and merges shallowly |
| `projectLink` | Creates/validates a persistent link only when `build.write` is true |
| `minify` | Build output defaults to minified JSON; `false` uses tab indentation |
| `supportsAudioProcessing` | Defined value overrides direct-call detection; only true emits the general flag |
| `properties` | Record emitted under `general.properties` after index/order assignment |
| `localization` | Emitted under `general.localization` |
| `devtools` | Defaults true for serve; false disables injection; build always omits it |

Generated `file`, `title`, `type`, and `general` replace preserved values. See [Project Metadata](../../build/project-metadata/) for exact precedence and preview behavior.

### Build-time errors

The plugin fails rather than accepting unsafe or ambiguous state:

- Configured metadata file missing/unreadable, invalid JSON, or non-object top level.
- Unsafe absolute/traversing preview path.
- Unreadable previous preview or public preview inspection failure.
- Final written preview unavailable from bundle, public directory, or captured output.
- Missing/ambiguous/unsupported project-directory discovery.
- Invalid project-link name or parent path.
- Link/output overlap, existing wrong destination, permissions, or filesystem failure.
- Missing embedded devtools client when serve injection attempts to read package build output.

Specific error classes include `TypeError` for wrong metadata/link option shape and `RangeError` for unsafe preview paths; filesystem and generation failures use `Error` with path context.

## Property builders

Every builder returns the corresponding `Wallpaper*Property` definition and injects its `type` discriminant.

### `colorProperty()`

```ts
function colorProperty(
  opts: Omit<WallpaperColorProperty, 'type'>,
): WallpaperColorProperty;
```

Normalizes `opts.value` through `colorToWallpaperColor()` after spreading other options. Native channels outside 0–1 throw `RangeError`; non-convertible finite output throws `TypeError`; Color.js parse failures propagate.

### `sliderProperty()`

```ts
function sliderProperty(
  opts: Omit<WallpaperSliderProperty, 'type'>,
): WallpaperSliderProperty;
```

Returns a new object. When `step` is `undefined` and `precision` is defined, adds `step = 10 ** -precision`. An explicit step wins. The builder does not validate min/max/default relationships.

### `boolProperty()`

```ts
function boolProperty(
  opts: Omit<WallpaperBoolProperty, 'type'>,
): WallpaperBoolProperty;
```

Pass-through plus `type: 'bool'`; no extra runtime validation.

### `comboProperty()`

```ts
function comboProperty(
  opts: Omit<WallpaperComboProperty, 'type'>,
): WallpaperComboProperty;
```

Pass-through plus `type: 'combo'`; labels and hidden values remain strings. It does not validate that the default matches an option.

### `textInputProperty()`

```ts
function textInputProperty(
  opts: Omit<WallpaperTextInputProperty, 'type'>,
): WallpaperTextInputProperty;
```

Pass-through plus `type: 'textinput'`.

### `fileProperty()`

```ts
function fileProperty(
  opts: Omit<WallpaperFileProperty, 'type'>,
): WallpaperFileProperty;
```

Pass-through plus `type: 'file'`; no filesystem lookup occurs.

### `directoryProperty()`

```ts
function directoryProperty(
  opts: Omit<WallpaperDirectoryProperty, 'type'>,
): WallpaperDirectoryProperty;
```

Pass-through plus `type: 'directory'`; delivery mode is enforced by TypeScript and consumed by host/devtools callbacks.

### `groupProperty()`

```ts
function groupProperty(
  opts: Omit<WallpaperGroupProperty, 'type' | 'value'>,
): WallpaperGroupProperty;
```

Returns `{ ...opts, type: 'group', value: '' }`. The generated discriminant/value override no caller fields because their omission is part of the signature.

Except `colorProperty()` parsing and ordinary JavaScript allocation failures, the pass-through builders do not intentionally throw. They allocate one new definition and do not mutate `opts`; `sliderProperty()` mutates only its newly created return object.

## Type inference

### `PropertyDefinitionToValue<T>`

```ts
type PropertyDefinitionToValue<
  T extends WallpaperPropertyDefinition,
> = T extends { type: 'color' }
  ? WallpaperColorValue
  : T extends { type: 'slider' }
    ? WallpaperSliderValue
    : T extends { type: 'bool' }
      ? WallpaperBoolValue
      : T extends { type: 'combo' }
        ? WallpaperComboValue
        : T extends { type: 'textinput' }
          ? WallpaperTextValue
          : T extends { type: 'file' }
            ? WallpaperFileValue
            : T extends { type: 'directory' }
              ? WallpaperDirectoryValue
              : never;
```

Groups and unmatched definitions map to `never`.

### `WallpaperUserPropertiesOf<T>`

```ts
type WallpaperUserPropertiesOf<
  T extends Record<string, WallpaperPropertyDefinition>,
> = {
  readonly [K in keyof T as T[K] extends { type: 'group' }
    ? never
    : K]: PropertyDefinitionToValue<T[K]>;
};
```

Produces readonly runtime keys and removes groups. Host update parameters still need `Partial<...>`.

## Project-link type

```ts
interface WallpaperProjectLinkOptions {
  name: string;
  projectsDirectory?: string;
}
```

`name` is one destination directory segment. When `projectsDirectory` is supplied, the plugin validates that it is an existing absolute directory; the caller must ensure it is the intended Wallpaper Engine `projects/myprojects` directory. See [Project Links](../../build/project-links/) for platform link types and safety errors.

## Re-exported project-schema types (15)

The plugin re-exports these exact root-owned types so a Vite config can remain on one public entry:

- `WallpaperFileType`
- `WallpaperLocalization`
- `WallpaperColorProperty`
- `WallpaperSliderProperty`
- `WallpaperBoolProperty`
- `WallpaperComboOption`
- `WallpaperComboProperty`
- `WallpaperTextInputProperty`
- `WallpaperFileProperty`
- `WallpaperDirectoryProperty`
- `WallpaperGroupProperty`
- `WallpaperPropertyDefinition`
- `WallpaperProjectGeneral`
- `WallpaperProjectMetadata`
- `WallpaperProject`

Their definitions are documented in [Root Types](../root/#project-schema-types-15). Re-exporting does not create a second type identity.

## Source

Plugin exports, builders, types, and Vite hooks: [`src/plugin/index.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/plugin/index.ts). Link options and filesystem behavior: [`src/plugin/project-link.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/plugin/project-link.ts).

## Next steps

Use [Property Schemas](../../guides/property-schemas/) for task-oriented examples and [Project Metadata](../../build/project-metadata/) before enabling publishing output.
