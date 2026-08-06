---
title: Troubleshooting
description: Diagnose listener timing, build metadata, previews, Steam links, color parsing, CORS, and extractor lifecycle failures.
---

## Controls report no listener

**Symptom:** The simulator shows “No listener,” changes cannot be delivered, or a host startup value never reaches the application.

**Cause:** `wallpaperPropertyListener`, `wallpaperPluginListener`, or a registration function was assigned after a mount/load hook, or another module replaced a singleton listener object.

**Fix:** Register host globals immediately at module scope. Own each singleton object in one integration module and dispatch to other subsystems. See [Host Listeners](../guides/host-listeners/).

## Audio works in development but not Wallpaper Engine

**Symptom:** The simulator sends audio, but production receives none and `general.supportsaudioprocessing` is absent.

**Cause:** Production detection scans emitted JavaScript and HTML for direct `wallpaperRegisterAudioListener` calls. Aliasing, unusual transforms, or a dynamically hidden call can evade it.

**Fix:** Set `supportsAudioProcessing: true` explicitly. Inspect generated `project.json` rather than assuming simulator registration enables host audio. Set `false` only to intentionally override a detected call.

## File works in one environment only

**Symptom:** A simulator-selected image uses `blob:` and works, while a host path does not—or code adds `file:///` in front of a `blob:` URL.

**Cause:** Wallpaper Engine supplies native paths; browser file pickers produce temporary object URLs.

**Fix:** Pass both through `toFileUrl()`. Do not persist simulator object URLs or infer a private native path from them. See [Files & Directories](../guides/files-and-directories/).

## Directory callbacks never arrive

**Symptom:** Calling `wallpaperRequestRandomFileForProperty()` does nothing, or add/remove handlers never receive files.

**Cause:** The directory definition and runtime flow use different modes.

**Fix:** For `mode: 'ondemand'`, request one file with the property key and callback. For `mode: 'fetchall'`, maintain state from `userDirectoryFilesAddedOrChanged` and `userDirectoryFilesRemoved`; do not issue random requests. Confirm the key matches the schema and the property has a selected directory.

## Metadata file is malformed or unreadable

**Symptom:** The build reports invalid JSON, a non-object top level, a filesystem error, or an overlap with `build.outDir` for configured metadata.

**Cause:** `metadataFile` paths resolve from Vite's final project root. A missing file is created automatically, but an existing file must have a non-null, non-array top-level object and must be readable and writable. The metadata file and resolved sibling `<metadata stem>.assets/<preview>` backup must stay outside the final output directory so Vite cleanup cannot delete them. Nested values are accepted, while source precedence merges top-level keys shallowly.

**Fix:** Correct the path, permissions, and JSON. Move overlapping metadata and its sidecar outside `build.outDir`; do not disable output cleanup or remove the option to bypass state preservation. Recover the author/editor metadata first. See [Project Metadata](../build/project-metadata/).

## Preview path is unsafe

**Symptom:** The build throws `Unsafe preview path`.

**Cause:** `preview` is absolute, drive-qualified, UNC, traversal outside output, or does not identify a project-relative file.

**Fix:** Use a relative path such as `preview.jpg` or `assets/preview.png`. Keep it inside the project output. Never weaken path checks or copy from outside the project as a workaround.

## Preview is referenced but unavailable

**Symptom:** A written build says the preview is unavailable in the Vite bundle, `publicDir`, previous output, or metadata preview backup.

**Cause:** The final metadata references bytes that none of the allowed sources can provide. A clean clone cannot rely on prior `dist` state.

**Fix:** Put the file under the final `publicDir` path, emit it through Vite, or restore `<metadata stem>.assets/<preview>`. If the previous output should own it, recover the missing file and run one synchronization build, then check in the generated metadata JSON and sidecar. The plugin fails instead of emitting broken metadata.

## Steam projects directory cannot be discovered

**Symptom:** Discovery is unsupported, finds nothing, or reports multiple `projects/myprojects` directories.

**Cause:** Automatic Steam discovery is Windows-only and requires exactly one matching Wallpaper Engine installation across discovered Steam libraries.

**Fix:** Set `projectLink.projectsDirectory` to the intended existing absolute `projects/myprojects` directory. On non-Windows platforms this is required. When multiple paths are listed, choose deliberately rather than deleting installations to make guessing succeed.

## Project link name or parent is invalid

**Symptom:** The build rejects `projectLink.name`, a relative parent, or a missing parent.

**Cause:** The name is not one trimmed directory segment, or `projectsDirectory` is not an existing absolute directory.

**Fix:** Use a name such as `night-sky` with no separators, `.`/`..`, NUL, or surrounding whitespace. Create and verify the parent separately, then pass its absolute path.

## Project link collides or targets the wrong directory

**Symptom:** The destination already exists, resolves elsewhere, or link paths overlap.

**Cause:** The destination is a real file/directory, a broken/wrong-target link, or is equal to/contains/is contained by the build target.

**Fix:** Stop and inspect both paths. The plugin never replaces or removes a destination. Remove or rename it manually only after confirming ownership and intent. Keep Vite output outside `projects/myprojects`; link into that parent rather than building inside it. See [Project Links](../build/project-links/).

## Wallpaper color parsing fails

**Symptom:** `parseWallpaperColor()` throws, a native default is rejected, or conversion produces a range error.

**Cause:** Runtime parsing requires exactly three finite whitespace-separated channels. Native builder input must also keep every channel in 0–1; CSS/Color.js syntax follows its parser.

**Fix:** Log the raw boundary value, validate its source, and use a supported color string. Do not catch and substitute black silently. `parseWallpaperColor()` clamps finite runtime channels before rounding, while `colorToWallpaperColor()` rejects out-of-range native input so invalid project defaults do not ship.

## Average-color extraction rejects or leaks resources

**Symptom:** URL extraction rejects with a canvas/CORS error, repeated video extraction grows resources, or later work uses a destroyed extractor.

**Cause:** The remote server does not permit canvas access, a source is not loaded for the synchronous API, or reusable extractor lifecycle is incomplete.

**Fix:** Configure server CORS and the appropriate `crossOrigin` option; use `getColorAsync()` for URLs and pending images. Put reusable extraction in `try/finally` and call `destroy()` exactly when all work is finished. `getAverageColor()` already destroys its one-shot extractor on success or rejection. See [Colors & Media Helpers](../helpers/colors-and-media/).

:::caution[Preserve fail-closed behavior]
Filesystem validation errors protect source and editor state. Fix the path, source file, ownership, or permissions. Do not suppress preview, metadata, collision, or overlap checks to make a build continue.
:::

## Next steps

Use the [API Reference](../reference/) to verify signatures, then reproduce host-only behavior in Wallpaper Engine after the [development simulator](../devtools/simulation/) passes.
