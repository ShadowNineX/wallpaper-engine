---
title: Workshop Workflow
description: Combine source-controlled metadata, linked build output, Wallpaper Engine editor state, and preview restoration safely.
---

The build plugin supports two preservation sources: source-controlled metadata for reproducible builds and previous output for Wallpaper Engine editor state. Use both deliberately.

## Ownership model

| Field or artifact | Owner | Recommended source |
| --- | --- | --- |
| `file`, `title`, `type` | Build | Plugin options and generated output |
| Ordinary `general.properties`, `general.localization`, `general.supportsaudioprocessing` | Build | Property schema, localization option, and audio configuration/detection |
| `general.properties.schemecolor` | Author/build, then editor fallback | Source-owned `schemeColor`; a valid previous editor property is preserved only when the option and source schema key are absent |
| `description`, `preview`, `tags`, ratings, visibility | Author/build | `metadata` or a checked-in `metadataFile` |
| Unknown Workshop/editor top-level fields | Wallpaper Engine editor | Preserved previous `project.json` or checked-in metadata file after review |
| Preview image bytes | Author/editor | Vite `publicDir`, emitted asset, or previous linked output |
| `project.json` in `outDir` | Generated artifact | Never hand-maintain as the only source of truth |

Generated core and ordinary `general` fields replace editor copies. The `schemeColor` option emits the special index-free `general.properties.schemecolor`; otherwise a valid editor-managed value and other top-level fields can round-trip through previous output.

## Fresh clone flow

A clean clone has no previous output to preserve:

1. Install dependencies from the repository root.
2. Configure and check in a metadata JSON file. The first written build creates it automatically when missing; a fresh clone then restores the synchronized state from that file.
3. Keep the preview under Vite's `publicDir` at the exact preview path, or explicitly emit/configure an asset whose final bundle `fileName` exactly matches `metadata.preview`.
4. Configure `projectLink` if this machine should expose output to Wallpaper Engine.
5. Run the written Vite build.
6. Open the linked project in Wallpaper Engine and verify it before publishing.

```ts
wallpaperEnginePlugin({
  title: 'Night Sky',
  metadataFile: 'wallpaper-engine.metadata.json',
  projectLink: {
    name: 'night-sky',
  },
});
```

`wallpaper-engine.metadata.json` is a top-level object. Nested object and array values are accepted, but source precedence merges only top-level keys:

```json
{
  "description": "An animated night sky.",
  "preview": "preview.jpg",
  "tags": ["Landscape"]
}
```

## Existing project flow

For a project already edited through Wallpaper Engine:

1. Point `projectLink.name` at a new or already-correct link to the Vite output.
2. Before cleanup, the plugin reads the existing output `project.json`, synchronizes its editor-managed and unknown top-level state into `metadataFile`, and captures its referenced preview bytes when available.
3. The build regenerates core fields and `general` while preserving other top-level editor state. Existing author-owned fields in the metadata file and explicit Vite metadata options keep their precedence.
4. The preview is restored byte-for-byte when it is not already supplied by the bundle or public directory.
5. Wallpaper Engine sees the rebuilt files through the same persistent link.

If an existing destination is a real project directory rather than the expected link, the plugin refuses to replace it. Move or migrate that project intentionally; the build will not delete it for you.

## Edit, build, publish round trip

```text
source schema + metadata + preview
              ↓ build
linked outDir/project.json ──→ Wallpaper Engine editor
              ↑                        │
              └── preserve editor state and preview before next cleanup
                                       ↓
                              verify and publish in host
```

A practical loop:

1. Change application code or source-owned metadata.
2. Build; the plugin captures previous state before Vite cleans output.
3. Open the linked local project and test host-only behavior.
4. Make Workshop/editor changes if needed.
5. Build again; preserved unknown fields and preview survive unless a higher-precedence source replaces them.
6. Publish through Wallpaper Engine after reviewing the generated project.

:::note[Shallow top-level preservation]
The plugin does not generally merge `general`; it regenerates that object. Configure the special browser color with `schemeColor`. When that option and a same-key source property are absent, a valid editor-managed `general.properties.schemecolor` is carried into regenerated properties. Other editor changes under `general` must move into supported plugin options or they will be replaced on the next build.
:::

## Preview restoration rules

The final `preview` path comes from metadata precedence. The build then accepts a matching bundled asset, `publicDir` file, or byte capture from previous output. If a higher-priority metadata source changes the path, old preview bytes are not silently written under the new name.

This prevents a stale editor preview from being mislabeled. Put the new preview at its final project-relative path before building.

## Clean clone and CI fallback

Previous output is an optimization and editor-state preservation source, not a reproducibility guarantee. CI and fresh clones should succeed from source alone:

- Check in the auto-created metadata file so editor-owned top-level values survive clean builds.
- Check in or generate the preview through Vite's public/bundle inputs.
- Set `projectLink` only where linking is intended; omit it in portable CI configuration or provide a valid environment-specific absolute parent.
- Never depend on an ignored `dist/project.json` as the only copy of publication metadata.

## Source

Metadata capture and output generation live in [`src/plugin/index.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/plugin/index.ts); safe links live in [`src/plugin/project-link.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/plugin/project-link.ts).

## Next steps

Review [Project Metadata](../project-metadata/) for exact precedence and [Project Links](../project-links/) for filesystem guarantees before enabling the loop.
