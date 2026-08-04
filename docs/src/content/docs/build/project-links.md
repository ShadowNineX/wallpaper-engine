---
title: Project Links
description: Link Vite build output into Wallpaper Engine projects with deterministic discovery and fail-closed filesystem safety.
---

A project link makes Vite's final output directory appear as one Wallpaper Engine local project:

```ts
wallpaperEnginePlugin({
  title: 'Night Sky',
  projectLink: {
    name: 'night-sky',
  },
});
```

The destination becomes:

```text
<projects/myprojects>/night-sky → <resolved Vite outDir>
```

The plugin prepares or validates the link during a build only when Vite's final `build.write` is true. `write: false` builds do not touch the filesystem link. The target is the final resolved `root + build.outDir`, not a hard-coded `dist` directory.

## Options

```ts
interface WallpaperProjectLinkOptions {
  name: string;
  projectsDirectory?: string;
}
```

- `name` is the one directory entry created below `projects/myprojects`.
- `projectsDirectory` is an explicit existing absolute directory that should point to Wallpaper Engine's `projects/myprojects`. The plugin validates the path, but cannot prove that it belongs to Wallpaper Engine.

## Windows discovery

When `projectsDirectory` is omitted on Windows, the plugin:

1. Collects Steam roots from Windows installation discovery.
2. Reads each root's `steamapps/libraryfolders.vdf`.
3. Looks in every distinct Steam library for `steamapps/common/wallpaper_engine/projects/myprojects`.
4. Resolves matching directories to real paths.

Exactly one match succeeds. No match fails with guidance to set `projectsDirectory`. Multiple matches fail and list them so the build never guesses which Wallpaper Engine installation to modify.

Automatic discovery is Windows-only. On macOS and Linux, configure an explicit absolute directory.

```ts
wallpaperEnginePlugin({
  title: 'Night Sky',
  projectLink: {
    name: 'night-sky',
    projectsDirectory: '/absolute/path/to/projects/myprojects',
  },
});
```

## Link type by platform

| Platform | Created link |
| --- | --- |
| Windows | Directory junction |
| Other platforms | Directory symbolic link (`type: 'dir'`) |

The configured projects directory must already exist and be a directory. The plugin does not create or guess a missing parent. It creates the resolved output target directory recursively so the link has a real target before link creation.

## Name validation

`projectLink.name` must be one non-empty directory name. It rejects:

- Leading or trailing whitespace.
- `.` and `..`.
- NUL characters.
- `/` or `\` path separators.
- Non-string or empty values at runtime.

A link name cannot escape the configured projects directory.

## Collision and overlap protection

Before creating anything, the plugin rejects a target and destination that are equal or where either contains the other. This prevents recursive build output and cleanup paths.

At the destination:

- No existing path: create the link.
- Existing symbolic link or junction resolving to the same target: succeed without changing it.
- Existing file, real directory, broken link, or link to another target: fail.

Path comparison is case-insensitive on Windows and case-sensitive elsewhere. Real paths are checked so equivalent links remain idempotent.

:::caution[Never replaced or deleted]
The plugin never unlinks, replaces, redirects, or automatically cleans an existing destination. A wrong-target or colliding path fails closed. Inspect it yourself and remove it manually only when you intentionally own that path.
:::

Filesystem and permission failures include both the intended destination and target. Fix the parent directory, permissions, or existing path; do not bypass the checks by nesting output inside `projects/myprojects`.

## Written-build timing

The link is prepared after Vite resolves configuration and only for a written build. `project.json` and other assets are then written into the linked target through normal Vite output. A build failure can therefore leave a correctly targeted but incomplete output directory; rerun the build after fixing the error.

The link itself persists across builds, allowing Wallpaper Engine to edit project state in the same output directory. [Project Metadata](../project-metadata/) captures that state before Vite cleanup.

## Source

Discovery, validation, and link creation are implemented in [`src/plugin/project-link.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/plugin/project-link.ts).

## Next steps

Follow the [Workshop Workflow](../workshop-workflow/) for a linked edit/build/publish loop and use [Troubleshooting](../../troubleshooting/) for discovery or collision failures.
