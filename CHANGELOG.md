# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Release boundaries follow the `version` field of the published package's
`package.json` (`packages/wallpaper-engine/package.json` after the monorepo
migration); tags are used where they exist.

## [Unreleased]

### Added

- Added typed Steam Workshop author metadata, optional metadata-file merging,
  and pre-clean preservation of editor state and preview assets across Vite
  builds.
- Added opt-in `projectLink` support that discovers Wallpaper Engine
  installations and safely links a written Vite output into `projects/myprojects`.

### Changed

- Split the demo into focused UI components and expanded its color-property
  examples with HSL, hex, and LCH defaults.
- Added Antfu ESLint configurations, workspace lint scripts, and matching editor
  settings for the library and devtools.

## [1.1.1] - 2026-08-01

### Fixed

- Resolve media playback states against the constants supplied by Wallpaper
  Engine at runtime, with a `getMediaPlaybackStatus` helper, instead of relying
  on incorrect hard-coded numeric states.

## [1.1.0] - 2026-08-01

### Added

- Added collapsible property groups, including typed definitions and animated
  expansion in the devtools.
- Detect `wallpaperRegisterAudioListener` calls in emitted JavaScript and HTML
  and write `general.supportsaudioprocessing` automatically, while retaining an
  explicit override.
- Added browser-native file and directory simulation to the devtools, including
  Wallpaper Engine's on-demand and fetch-all routing, extension filtering, and
  local blob URL handling.
- Added Color.js-compatible property defaults and helpers for normalized
  Wallpaper Engine colors, plus reusable average-color extraction for images,
  video, canvases, image bitmaps, video frames, and raw pixel arrays.
- Display the published package version and Git revision in the devtools.

### Changed

- Overhauled the draggable devtools interface, property controls, audio and
  media simulation, responsive behavior, state management, and automated test
  coverage. The demo now exercises the FPS limiter and reports its configured
  limit, measured rate, and rendered-frame delta.
- Migrated the library build from tsup to tsdown, reorganized its tests, and
  refined the package outputs and embedded devtools build.
- Minify generated `project.json` files in production while keeping development
  output readable; an explicit `minify` option can override either default.
- Derive a slider's `step` from `precision` when no step is supplied and clarify
  how Wallpaper Engine combines both fields.
- Hardened runtime helpers: color parsing now validates, rounds, and clamps
  channels; audio clamping handles non-finite samples without mutating input;
  file URL and color-extraction behavior is more robust.
- Reworked the README around the current package entry points, devtools,
  properties, helpers, host types, and development workflow.

### Fixed

- Report the FPS limiter delta between rendered frames rather than between raw
  animation-frame callbacks.

## [1.0.3] - 2026-05-17

### Changed

- Improved README navigation, status badges, section anchors, and the guidance
  for enabling Wallpaper Engine audio listeners.

## [1.0.2] - 2026-05-16

### Changed

- Include the repository README in local and CI-published npm packages.

## [1.0.1] - 2026-05-16

- Version-only release with no user-facing changes.

## [1.0.0] - 2026-05-16

### Added

- Added an in-browser Vue devtools panel for properties, runtime settings,
  audio, media, and file events, with persistent draggable panel state.
- Expanded the demo with responsive styling, a clock, media controls, and live
  audio visualization.
- Added the MIT license and contributor guidance.

### Changed

- Converted the repository to a Bun workspaces monorepo with separate
  `wallpaper-engine`, devtools, and demo workspaces.
- Updated package metadata and publishing CI for the first stable npm release.
- Use relative Vite asset paths so packaged wallpapers load correctly outside a
  site root.

## [0.0.1] - 2026-05-16

### Added

- Added TypeScript coverage for Wallpaper Engine properties, listeners, media,
  audio, plugin events, iCUE/LED integrations, and browser globals.
- Added a Vite plugin that generates `project.json`, typed property builders,
  localization support, and inferred runtime property values.
- Added runtime helpers for color conversion, audio channels, file URLs, LED
  canvas encoding, and FPS-limited animation loops.
- Added an example wallpaper, automated tests, build configuration, and CI.

[Unreleased]: https://github.com/ShadowNineX/wallpaper-engine/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/ShadowNineX/wallpaper-engine/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/ShadowNineX/wallpaper-engine/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/ShadowNineX/wallpaper-engine/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/ShadowNineX/wallpaper-engine/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/ShadowNineX/wallpaper-engine/compare/6d99330fd1996e3dd34fab26e4ce7e2b130c0b18...v1.0.1
[1.0.0]: https://github.com/ShadowNineX/wallpaper-engine/compare/129a65621d544e085e8e45bdc717125ee2265241...6d99330fd1996e3dd34fab26e4ce7e2b130c0b18
[0.0.1]: https://github.com/ShadowNineX/wallpaper-engine/commit/129a65621d544e085e8e45bdc717125ee2265241
