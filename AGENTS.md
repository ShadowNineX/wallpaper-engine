# Repository Guidelines

## Project Overview

This Bun workspaces monorepo builds tooling for Wallpaper Engine web wallpapers. It contains one published npm package, `wallpaper-engine`, plus a private Vue devtools host simulator and a private Vue consumer demo.

The published package has three independent entry points:

- `wallpaper-engine`: types and Wallpaper Engine global augmentation; no runtime API.
- `wallpaper-engine/plugin`: Vite integration, property builders, inferred property types, and `project.json` generation. This is the only entry allowed to import Vite.
- `wallpaper-engine/helpers`: side-effect-free browser utilities; keep helpers individually tree-shakeable.

Do not cross-import between public entry points or add runtime dependencies to the published package.

## Architecture & Data Flow

1. A wallpaper defines one property record with builders from `wallpaper-engine/plugin` (see `demo/src/wallpaper.ts`).
2. `WallpaperUserPropertiesOf<typeof properties>` derives the runtime callback shape from that record.
3. During development, `wallpaperEnginePlugin()` injects the bundled devtools client. During production builds, it emits `project.json` and omits the simulator.
4. The devtools client installs Wallpaper Engine-compatible globals, stores simulated state in Pinia, and delivers property/audio/media callbacks to the wallpaper.
5. Wallpaper runtime code registers host listeners immediately at module scope and maps callback payloads into local Vue state. Do not defer host registration to `onMounted`, `window.onload`, or a timer; startup events may otherwise be missed.

The build order is load-bearing: devtools produces `packages/devtools/dist/client.js`; the library plugin build copies it to `packages/wallpaper-engine/dist/plugin/devtools/client.js`. Always use the root build for publishable output.

Runtime property callbacks are partial after initial delivery. Type them as `Partial<WallpaperUserPropertiesOf<...>>` and guard each key before reading it. Playback integers are host-defined; compare them through `window.wallpaperMediaIntegration` or `getMediaPlaybackStatus()`, never hard-code numbers.

## Key Directories

- `packages/wallpaper-engine/src/`: published types, helpers, property builders, and Vite plugin.
- `packages/wallpaper-engine/tests/`: public helper and plugin contracts.
- `packages/devtools/src/`: private Vue 3/Pinia host simulator.
- `packages/devtools/src/components/ui/`: reusable UI primitives; feature controls belong outside this directory.
- `packages/devtools/src/tabs/`: Properties, Runtime, Audio, and Media panels.
- `packages/devtools/tests/`: module, store, global-adapter, component, and tab tests.
- `demo/src/`: end-to-end consumer wallpaper. `wallpaper.ts` is the shared property schema; `App.vue` owns host integration and animation; `components/` is presentational.
- `.github/workflows/`: test/build and tag-based npm publication.

Generated `dist/`, coverage, tarballs, and the copied package README are not source. Use the root `bun.lock` as authoritative; do not install independently inside `demo/`.

## Development Commands

Run commands from the repository root with Bun:

```bash
bun install
bun run build          # devtools first, then the published package
bun run build:devtools
bun run build:lib       # unsafe as a clean standalone build if devtools dist is absent
bun run dev             # watched devtools bundle build
bun run dev:devtools    # interactive devtools Vite UI
bun run dev:demo        # consumer demo Vite server
bun run lint
bun run lint:fix
bun run typecheck       # devtools, library, and demo
bun run test:run        # devtools and library once
bun run test:coverage
```

The root build does not build the demo. For deployable demo output, run:

```bash
bun run --filter=demo build
```

Package-local commands use `bun run --filter=<workspace> <script>`, where workspace names are `wallpaper-engine`, `@wallpaper-engine/devtools`, and `demo`.

## Code Conventions & Common Patterns

- ESLint uses `@antfu/eslint-config` with single quotes and required semicolons. Run `bun run lint:fix` rather than introducing a second formatter; workspace VS Code settings disable Prettier.
- TypeScript is strict with bundler resolution, `verbatimModuleSyntax`, and unchecked indexed access. Use `import type` and guard indexed values (`array[0]` is possibly `undefined`).
- Every public exported symbol in `wallpaper-engine` requires JSDoc with an `@example`.
- Property builders follow `xxxProperty(opts)`: inject the discriminant and pass remaining options through. Update `PropertyDefinitionToValue` for new property kinds.
- Add host APIs to both `Window` and matching bare `var`/`function` declarations in `packages/wallpaper-engine/src/types/window.ts`.
- Devtools uses Vue 3 `<script setup>`, setup-style Pinia stores, and thin controls: typed props, computed state lookup, direct reactive mutation, then one store delivery action.
- Keep raw listener callbacks at module scope so host globals are independent of component lifecycles.
- Isolate external callbacks with `try/catch` and `[WE Dev]` logging. Use `try/finally` for loading flags, extractor destruction, object-URL revocation, and other resource cleanup.
- Library input errors should throw specific `TypeError`, `RangeError`, or `Error` values rather than silently accepting malformed data.
- Devtools may import library source by relative path because it builds first. Consumer and demo code must use public package entry points instead.

## Important Files

- `package.json`: workspace orchestration and root commands.
- `packages/wallpaper-engine/package.json`: public exports, package contents, optional Vite peer, and publish hook.
- `packages/wallpaper-engine/src/index.ts`: root type entry and global augmentation import.
- `packages/wallpaper-engine/src/helpers.ts`: browser helper entry.
- `packages/wallpaper-engine/src/plugin/index.ts`: builders, inferred types, devtools injection, and `project.json` emission.
- `packages/wallpaper-engine/src/types/{project,listeners,window}.ts`: project schema and host contracts.
- `packages/wallpaper-engine/tsdown.config.ts`: two-stage package build and devtools copy guard.
- `packages/devtools/src/{main,globals,store}.ts`: simulator bootstrap, host adapter, and central state/event flow.
- `packages/devtools/vite.config.ts`: single-file bundle and Shadow DOM CSS inlining.
- `demo/src/{wallpaper,App}.ts`: use `wallpaper.ts` for definitions; note the runtime file is `App.vue`.
- `README.md`: public API documentation; update it with public API changes.
- `CHANGELOG.md`: Keep a Changelog release notes.

## Runtime/Tooling Preferences

- Bun is the required package manager and script runner. Use `bun install` and `bun run`; do not generate npm/pnpm lockfiles.
- All packages are ESM. The plugin export is ESM-only; root and helpers also provide CommonJS builds.
- Vite is an optional peer (`>=5`) and belongs only to plugin consumers.
- Library builds use tsdown; devtools/demo use Vite; Vue workspaces use `vue-tsc`; tests use Vitest; coverage uses V8.
- Vue, icons, fonts, Tailwind CSS, and devtools dependencies are bundled into the self-contained client. Consumers do not install Vue for devtools.
- Tailwind v4 CSS is isolated in an open Shadow DOM and inlined into the client JavaScript. Do not assume a separate production CSS asset exists.
- Do not reorder or parallelize the root devtools/library build stages; the library clean/copy hooks can erase or race the embedded client.

## Testing & QA

Tests live only under each package's `tests/**/*.test.ts` and import Vitest APIs explicitly.

- `packages/wallpaper-engine`: Node environment. Test public outputs, errors, boundaries, generated `project.json`, Vite hook effects, and type inference.
- `packages/devtools`: Happy DOM plus Vue Test Utils. Mount real components, drive controls, and assert rendered/accessibility state and host-shaped callback payloads.
- For modules that read globals or create Pinia singletons at import time: reset modules, install globals/config, activate a fresh Pinia, then dynamically import the subject.
- Mock unavailable boundaries (Wallpaper Engine globals, canvas, URL/file pickers, filesystem, timers), not the behavior under test. Prefer deterministic fake timers and mocked randomness.
- Avoid snapshots and source-text assertions. Tests should fail on plausible behavioral regressions and verify cleanup/failure isolation.

Coverage thresholds:

- Library: 85% statements, 80% branches, 95% functions, 85% lines.
- Devtools: 80% statements, 70% branches, 80% functions, 80% lines; `src/components/ui/**` and `src/main.ts` are excluded.

Before finishing a library or devtools change, run the affected package's lint, typecheck, and targeted tests. Before publishing or changing build integration, run the root `bun run lint`, `bun run typecheck`, `bun run test:run`, and `bun run build`.
