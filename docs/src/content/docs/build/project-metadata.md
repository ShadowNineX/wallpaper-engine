---
title: Project Metadata
description: Configure project.json generation, metadata precedence, preview preservation, and production formatting in the Vite plugin.
---

`wallpaperEnginePlugin()` emits `project.json` as a Vite asset. It combines generated build facts with source-controlled author metadata and preserves editor-owned fields from previous output.

```ts
import { wallpaperEnginePlugin } from 'wallpaper-engine/plugin';

wallpaperEnginePlugin({
  title: 'Night Sky',
  metadata: {
    description: 'An animated night sky.',
    preview: 'preview.jpg',
    tags: ['Landscape'],
  },
});
```

## Options

| Option | Type | Default / role |
| --- | --- | --- |
| `title` | `string` | Required Wallpaper Engine title |
| `file` | `string` | Entry HTML path; defaults to `'index.html'` |
| `properties` | Property record | User properties written under `general.properties` |
| `localization` | Localization map | Labels written under `general.localization` |
| `supportsAudioProcessing` | `boolean` | Defined value overrides bundle-call detection |
| `metadata` | `WallpaperProjectMetadata` | Source-controlled description, preview, tags, ratings, and visibility |
| `metadataFile` | `string` | Non-null, non-array top-level JSON object resolved from Vite's final project root |
| `projectLink` | `WallpaperProjectLinkOptions` | Persistent link to written output; see [Project Links](../project-links/) |
| `minify` | `boolean` | Build output defaults to minified JSON; `false` uses tab indentation |
| `devtools` | `boolean` | Development overlay; defaults to `true`, always omitted from production |

## Generated shape

The plugin always generates these core fields:

```json
{
  "file": "index.html",
  "title": "Night Sky",
  "type": "web"
}
```

It generates `general` only when at least one applicable field exists:

```json
{
  "general": {
    "properties": {},
    "localization": {},
    "supportsaudioprocessing": true
  }
}
```

`properties` are normalized with zero-based `index` and `order` according to record insertion order; explicit values win. `supportsaudioprocessing` is included only when an explicit `true` or emitted-bundle detection enables it. A false/absent result does not write a false field.

Written build JSON is one line by default. Set `minify: false` to use tab indentation. Serve mode does not emit `project.json`.

## Ownership and precedence

Merge precedence is exact:

```text
previous output < metadata file < defined metadata options < generated fields
```

- Existing `dist/project.json` is the lowest-priority preservation source.
- `metadataFile` replaces colliding top-level keys from previous output.
- Each `metadata` field replaces lower-priority values only when it is not `undefined`.
- Generated `file`, `title`, `type`, and `general` always win.

Merging is top-level and shallow. `general` is not merged: it is removed from preservation sources and regenerated from plugin options and bundle audio detection. Put localization and properties in their defined options rather than an editor-owned `general` object.

Unknown top-level fields survive from previous output or a metadata file unless a higher source replaces them. This allows Wallpaper Engine editor state to coexist with build-owned fields.

## Metadata files

```ts
wallpaperEnginePlugin({
  title: 'Night Sky',
  metadataFile: 'wallpaper-engine.metadata.json',
});
```

The path resolves from Vite's final `root`. The file is required when configured and must contain valid JSON with a non-null, non-array top-level object. Missing, unreadable, malformed, or wrong-shaped input fails the build with a specific error rather than silently discarding publishing state.

## Preview paths and restoration

A non-empty final `preview` must be a safe project-relative file path inside the project output. `preview: ''` is preserved and skips path validation and restoration. For non-empty paths, the plugin rejects:

- POSIX, Windows drive, and UNC absolute paths.
- Traversal that resolves outside the project directory.
- `.` or another value that does not identify a project file.

Backslashes are normalized for preview lookup and emitted asset filenames, but the `preview` string serialized in `project.json` is preserved verbatim. Use forward slashes in metadata when that serialized form is required. During a written build, a non-empty final preview must come from one of these sources:

1. An asset already emitted into the Vite bundle at the final path.
2. A matching file under Vite's final `publicDir`.
3. The previous build output, captured before Vite cleans `outDir`.

When restoring from previous output, the plugin reads the file as bytes and emits those exact bytes back to the same normalized relative path. It does not decode, resize, or re-encode the preview.

:::caution[Fail closed before cleanup]
Metadata and prior preview state are read during Vite configuration, before output cleanup. Unsafe paths, unreadable metadata, and filesystem inspection failures stop the build before destructive cleanup. If the final preview is referenced but unavailable from bundle, public directory, or captured output, the written build fails instead of emitting a broken project.
:::

A clean clone or CI job has no previous output. Keep the preview under `publicDir` at the exact final path, or explicitly emit/configure an asset whose final bundle `fileName` exactly matches `metadata.preview`.

The build lifecycle follows Vite's resolved `root`, `publicDir`, `build.outDir`, and `build.write` configuration. See [Vite's build guide](https://vite.dev/guide/build.html) for those host-owned settings.

## Source

Generation and preservation are implemented in [`src/plugin/index.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/plugin/index.ts).

## Next steps

Link safe written output with [Project Links](../project-links/), then follow the [Workshop Workflow](../workshop-workflow/) to preserve editor state.
