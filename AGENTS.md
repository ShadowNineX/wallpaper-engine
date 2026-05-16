# Agent Instructions

Bun workspaces monorepo. Publishes a single npm package (`wallpaper-engine`) providing types, a Vite plugin, and runtime helpers for [Wallpaper Engine](https://www.wallpaperengine.io/) web wallpapers. See [README.md](README.md) for the full public API surface.

## Runtime & Commands (run at repo root)

- **Bun** is the package manager and script runner. Use `bun install`, `bun run <script>`.
- Root scripts delegate to workspaces via `bun run --filter=<name> <script>`.
- Build: `bun run build` — builds `@wallpaper-engine/devtools` first, then `wallpaper-engine` (tsup's `onSuccess` copies the devtools client artifact into the published dist).
- Watch: `bun run dev`
- Typecheck: `bun run typecheck`
- Tests: `bun run test` (watch) / `bun run test:run` (single)

## Monorepo Layout

```
packages/
  wallpaper-engine/   # the ONLY published package (name: "wallpaper-engine")
  devtools/           # private workspace (name: "@wallpaper-engine/devtools")
demo/                 # private workspace; consumes wallpaper-engine via workspace:*
```

Root [package.json](package.json) has no runtime deps — it is workspace orchestration only. Workspaces: `["packages/*", "demo"]`.

### `packages/wallpaper-engine/` — the published package

Three independent entry points in [packages/wallpaper-engine/package.json](packages/wallpaper-engine/package.json) `exports`. Keep them isolated — do not cross-import between them.

| Entry | File | Rule |
|---|---|---|
| `wallpaper-engine` | [packages/wallpaper-engine/src/index.ts](packages/wallpaper-engine/src/index.ts) | Re-exports types only + imports [packages/wallpaper-engine/src/types/window.ts](packages/wallpaper-engine/src/types/window.ts) for global `Window` augmentation. No runtime code. |
| `wallpaper-engine/plugin` | [packages/wallpaper-engine/src/plugin/index.ts](packages/wallpaper-engine/src/plugin/index.ts) | The **only** file allowed to import from `vite`. `vite` is an optional peer dep. At runtime it reads the bundled devtools client from `./devtools/client.js` (relative to the built `dist/plugin/index.js`). |
| `wallpaper-engine/helpers` | [packages/wallpaper-engine/src/helpers.ts](packages/wallpaper-engine/src/helpers.ts) | Side-effect-free, individually tree-shakeable runtime utilities. No imports from other entry points. |

Build is configured in [packages/wallpaper-engine/tsup.config.ts](packages/wallpaper-engine/tsup.config.ts): two configs — browser entries (ESM+CJS+dts) and a plugin entry (ESM only) whose `onSuccess` hook copies `../devtools/dist/client.js` to `dist/plugin/devtools/client.js`. Always run the root `bun run build` (not the package script directly) so devtools is built first.

Tests live in [packages/wallpaper-engine/src/__tests__/](packages/wallpaper-engine/src/__tests__/) and mirror the source structure (`plugin.test.ts`, `helpers.test.ts`).

### `packages/devtools/` — private Vue UI

Vue 3 + Tailwind v4 devtools UI built with Vite into a single self-contained ES module at `packages/devtools/dist/client.js`. Vue is **bundled**, not externalized — consumers don't need Vue installed.

- Entry: [packages/devtools/src/main.ts](packages/devtools/src/main.ts). Creates a host `<div id="we-devtools-root">`, attaches an **open Shadow DOM**, injects compiled CSS into a `<style>` element inside the shadow root (sourced from `globalThis.__WE_DEVTOOLS_CSS__`, set by the `inlineCss` rollup plugin in [packages/devtools/vite.config.ts](packages/devtools/vite.config.ts)), and mounts the Vue app inside the shadow root. Full Tailwind preflight is safe because everything is isolated.
- Cross-package imports go to the **source** of `wallpaper-engine` via relative paths like `../../wallpaper-engine/src/types/...` (do not import from `wallpaper-engine`'s dist — devtools builds before wallpaper-engine).
- Tokens in [packages/devtools/src/style.css](packages/devtools/src/style.css) `@theme` block use the `--color-we-*` namespace.

### `demo/` — consumer demo

Vue 3 demo wallpaper. Depends on `"wallpaper-engine": "workspace:*"` ([demo/package.json](demo/package.json)); `bun install` symlinks the workspace package into `demo/node_modules`. The demo has its own toolchain — never run root-level commands inside it, and never import from `demo/` in any `packages/*/src/`.

## Conventions

- **TS config** is strict with `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`. Always use `import type` for type-only imports. Guard array/index access (`arr[0]` is `T | undefined`).
- **Public API docs**: every exported symbol in `wallpaper-engine` has a JSDoc block with an `@example`. Match this style for new exports.
- **Property builders** in [packages/wallpaper-engine/src/plugin/index.ts](packages/wallpaper-engine/src/plugin/index.ts) follow the `xxxProperty(opts)` pattern that injects `type` and passes the rest through. Add new builders the same way and update the `PropertyDefinitionToValue` mapped type.
- **No runtime dependencies in the published package.** Vite is a peer dep; everything else is dev-only.
- Tests use `vitest` with `environment: 'node'` ([packages/wallpaper-engine/vitest.config.ts](packages/wallpaper-engine/vitest.config.ts)).

## Wallpaper Engine Runtime

The Wallpaper Engine host injects globals (`window.wallpaperPropertyListener`, `wallpaperRegisterAudioListener`, `wpPlugins.led`, `cue`, media listeners, etc.) — all typed in [packages/wallpaper-engine/src/types/window.ts](packages/wallpaper-engine/src/types/window.ts) via `declare global`. When adding new host APIs, augment both the `Window` interface and the matching `var`/`function` declaration so both `window.xxx` and bare `xxx` access type-check.
