---
title: Project Metadata
description: Configure project.json generation, metadata precedence, preview preservation, and production formatting in the Vite plugin.
---

`wallpaperEnginePlugin()` emits `project.json` as a Vite asset. It combines generated build facts with source-controlled author metadata and preserves editor-owned fields from previous output.

```ts
import { wallpaperEnginePlugin } from 'wallpaper-engine/plugin';

wallpaperEnginePlugin({
  title: 'Night Sky',
  schemeColor: '#5994ff',
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
| `schemeColor` | `string` | Color.js syntax normalized into the reserved index-free `general.properties.schemecolor`; previous editor state is the fallback |
| `properties` | Property record | User properties written under `general.properties` |
| `localization` | Localization map | Labels written under `general.localization` |
| `supportsAudioProcessing` | `boolean` | Defined value overrides bundle-call detection |
| `metadata` | `WallpaperProjectMetadata` | Source-controlled description, preview, tags, ratings, and visibility |
| `metadataFile` | `string` | Auto-created, synchronized top-level JSON object plus a `<metadataFile>.assets/` preview sidecar, resolved from Vite's final project root |
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
- `metadataFile` replaces colliding author-owned fields from previous output.
- Each `metadata` field replaces lower-priority values only when it is not `undefined`.
- Generated `file`, `title`, `type`, and ordinary `general` fields always win.
- A defined `schemeColor` option wins over every previous `general.properties.schemecolor` value. When the option is omitted and the source property schema does not define that key, a valid editor-managed value is carried into regenerated properties.

Merging is otherwise top-level and shallow. `general` is removed from preservation sources and regenerated from plugin options and bundle audio detection. Put localization and ordinary properties in their defined options rather than an editor-owned `general` object.

Unknown top-level fields survive from previous output or a metadata file unless a higher source replaces them. This allows Wallpaper Engine editor state to coexist with build-owned fields.

## Metadata files

```ts
wallpaperEnginePlugin({
  title: 'Night Sky',
  metadataFile: 'wallpaper-engine.metadata.json',
});
```

The path resolves from Vite's final `root`. Before a written build cleans the output directory, the plugin creates a missing file (including parent directories) and synchronizes non-generated fields from the previous `project.json`. Existing author-owned fields (`description`, `preview`, `tags`, ratings, and visibility) stay authoritative in the metadata file. Wallpaper Engine-managed and unknown fields are updated from the editor output, including `workshopid`, `workshopurl`, and `version`. This makes the file a source-controlled handoff for clean builds on another machine.

The metadata file and each resolved sidecar preview must remain outside Vite's final `build.outDir`. Overlapping paths are rejected before output cleanup because Vite would otherwise delete the preservation source during the same build.

When the synchronized final preview path matches a preview captured from previous output, the same pre-clean step writes its exact bytes beneath a sibling directory named by appending `.assets` to the complete metadata filename. The project-relative preview path is retained below that directory. For example:

```text
config/wallpaper-engine.metadata.json
config/wallpaper-engine.metadata.json.assets/previews/editor.jpg
```

This convention applies only when `metadataFile` is configured and `build.write` is true. Check in both the JSON file and its `.assets/` directory. A metadata file at another path gets its own adjacent `<metadataFile>.assets/` directory; no global cache or `dist` file is consulted by a clean clone.

An existing file must contain valid JSON with a non-null, non-array top-level object. Unreadable, malformed, wrong-shaped, or unwritable metadata fails before output cleanup rather than silently discarding publishing state. Generated core keys are ignored during project generation even if an existing metadata file contains them.

## Preview paths and restoration

A non-empty final `preview` must be a safe project-relative file path inside the project output. `preview: ''` is preserved and skips path validation and restoration. For non-empty paths, the plugin rejects:

- POSIX, Windows drive, and UNC absolute paths.
- Traversal that resolves outside the project directory.
- `.` or another value that does not identify a project file.

Backslashes are normalized for preview lookup and emitted asset filenames, but the `preview` string serialized in `project.json` is preserved verbatim. Use forward slashes in metadata when that serialized form is required. During a written build, a non-empty final preview must come from one of these sources:

1. An asset already emitted into the Vite bundle at the final path.
2. A matching file under Vite's final `publicDir`.
3. The previous build output, captured before Vite cleans `outDir`.
4. The matching `<metadataFile>.assets/<preview>` sidecar.

Bundle and `publicDir` sources retain output precedence. Otherwise the plugin prefers a matching current capture over the persistent sidecar, synchronizes that capture into the sidecar, and emits the selected bytes back to the same normalized relative path. It does not decode, resize, or re-encode the preview. A changed higher-priority preview path never relabels bytes captured under a different path.

:::caution[Fail closed before cleanup]
Metadata and prior preview state are read during Vite configuration, before output cleanup. Unsafe paths, unreadable metadata or preview backups, and filesystem inspection failures stop the build before destructive cleanup. Preview paths are normalized and confined independently beneath both `outDir` and the metadata sidecar directory. If the final preview is referenced but unavailable from bundle, public directory, captured output, or the configured sidecar, the written build fails instead of emitting a broken project.
:::

A clean clone or CI job has no previous output. With `metadataFile`, check in `<metadataFile>.assets/<preview>` after one synchronization build. Alternatively, keep the preview under `publicDir` at the exact final path or explicitly emit/configure an asset whose final bundle `fileName` exactly matches `metadata.preview`.

The build lifecycle follows Vite's resolved `root`, `publicDir`, `build.outDir`, and `build.write` configuration. See [Vite's build guide](https://vite.dev/guide/build.html) for those host-owned settings.

## Source

Generation and preservation are implemented in [`src/plugin/index.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/plugin/index.ts).

## Next steps

Link safe written output with [Project Links](../project-links/), then follow the [Workshop Workflow](../workshop-workflow/) to preserve editor state.
