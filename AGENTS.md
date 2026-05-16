# Agent Instructions

TypeScript library providing types, a Vite plugin, and runtime helpers for [Wallpaper Engine](https://www.wallpaperengine.io/) web wallpapers. See [README.md](README.md) for the full public API surface, examples, and exported symbol list — do not duplicate that content here.

## Runtime & Commands

- **Bun** is the package manager and script runner (see [package.json](package.json)). Use `bun install`, `bun run <script>`, `bunx`.
- Build: `bun run build` (tsup, emits ESM + CJS + `.d.ts` to `dist/`)
- Watch: `bun run dev`
- Typecheck: `bun run typecheck`
- Tests: `bun run test` (watch) / `bun run test:run` (single)

## Project Layout

Three independent entry points, each exported separately in [package.json](package.json) under `exports`. Keep them isolated — do not cross-import between them.

| Entry | File | Rule |
|---|---|---|
| `wallpaper-engine` | [src/index.ts](src/index.ts) | Re-exports types only + imports [src/types/window.ts](src/types/window.ts) for global `Window` augmentation. No runtime code. |
| `wallpaper-engine/plugin` | [src/plugin/index.ts](src/plugin/index.ts) | The **only** file allowed to import from `vite`. `vite` is an optional peer dep. |
| `wallpaper-engine/helpers` | [src/helpers.ts](src/helpers.ts) | Side-effect-free, individually tree-shakeable runtime utilities. No imports from other entry points. |

Tests live in [src/__tests__/](src/__tests__/) and mirror the source structure (`plugin.test.ts`, `helpers.test.ts`).

## Conventions

- **TS config** ([tsconfig.json](tsconfig.json)) is strict with `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`. Always use `import type` for type-only imports. Guard array/index access (`arr[0]` is `T | undefined`).
- **Public API docs**: every exported symbol has a JSDoc block with an `@example`. Match this style for new exports.
- **Property builders** in [src/plugin/index.ts](src/plugin/index.ts) follow the `xxxProperty(opts)` pattern that injects `type` and passes the rest through. Add new builders the same way and update the `PropertyDefinitionToValue` mapped type.
- **No runtime dependencies.** Vite is a peer dep; everything else is dev-only.
- Tests use `vitest` with `environment: 'node'` ([vitest.config.ts](vitest.config.ts)).

## The `example/` Directory

Vue 3 demo wallpaper that consumes the library via `"wallpaper-engine": "link:.."` ([example/package.json](example/package.json)). It is **excluded** from the root [tsconfig.json](tsconfig.json) and has its own toolchain — never run root-level commands inside it, and never import from `example/` in `src/`.

## Wallpaper Engine Runtime

The Wallpaper Engine host injects globals (`window.wallpaperPropertyListener`, `wallpaperRegisterAudioListener`, `wpPlugins.led`, `cue`, media listeners, etc.) — all typed in [src/types/window.ts](src/types/window.ts) via `declare global`. When adding new host APIs, augment both the `Window` interface and the matching `var`/`function` declaration so both `window.xxx` and bare `xxx` access type-check.
