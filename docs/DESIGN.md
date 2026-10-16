# Documentation Surface

## Intent

The documentation is a **Read** surface: readers should understand the package,
copy a working pattern, and see the result without losing their place. It extends
the existing wallpaper-engine identity rather than introducing a separate visual
brand.

The visual thesis is a focused browser workshop: cool blue controls and previews
sit on quiet ink surfaces, while prose stays calm, spacious, and easy to scan.
The property playground is the single authored interactive moment.

## Tokens

- Brand blue: `#60a5fa` in dark mode; `#2563eb` in light mode.
- Dark canvas: `#0b111b`; dark navigation: `#0f1724`.
- Light canvas: `#fbfdff`; light navigation: `#f7faff`.
- Raised surfaces use Starlight navigation and inline-code variables so theme
  changes remain coherent.
- Borders use `--sl-color-hairline-light`. Elevation is reserved for the fixed
  header and code or preview surfaces that genuinely sit above the reading plane.
- Corners are `0.75rem` to `1rem` for substantial surfaces. Pills are limited to
  compact statuses and controls.

## Typography and rhythm

- Keep Starlight's system font stack. Documentation must not depend on a remote
  font request.
- Body copy stays at `1rem`, approximately `72ch`, with `1.72` line height.
- Headings use stronger weight, tighter tracking, and more space above than below.
- The base content rhythm is `1.25rem`. Section headings open larger breaks, and
  tabs and callouts keep enough separation to remain distinct while scanning.
- Code and numeric outputs use the existing Starlight monospace stack with
  tabular numerals where values change.
- Markdown tables retain Starlight's native horizontal scrolling. Their frames
  fit the table grid up to the column width, and every cell keeps its edge
  padding. Short tables never leave an empty frame beside the last column.
- Prefer semantic sections, ordered processes, and meaningful diagrams over
  repeated same-size cards.

## Components

### `PropertyPlayground`

- Uses the quick-start defaults: accent `#60a5fa`, intensity `0.5`, and title
  visible.
- Standard color, range, checkbox, and reset controls update a real miniature
  wallpaper DOM.
- The default preview remains coherent without JavaScript. JavaScript only binds
  local input and reset listeners; it creates no globals, timers, or host claims.
- Preview ink adapts to the selected accent; the intensity control still
  deliberately fades the title, including fully hiding it at zero.

### `ExampleGallery`

- Shows three visually distinct recipes: typed properties, audio-reactive glow,
  and now-playing media.
- Routes are derived from `import.meta.env.BASE_URL` for local and GitHub Pages
  builds.
- Recipe headings are H3 beneath the home section and H2 directly beneath the
  Examples page title, with the same visual styling.
- Visuals represent states and behavior already described by the examples. They
  are not screenshots or claims of a live host connection.

## Accessibility and responsive behavior

- Preserve Starlight search, theme selection, sidebars, table of contents, focus
  order, and keyboard behavior.
- Controls keep native semantics and visible focus rings. Color is never the only
  control label or state cue.
- The playground and recipe gallery respond to their available container width,
  so standard reading columns stay single-column even on wide screens. The home
  page uses the gallery mosaic only when its content column is wide enough. The
  three-step process becomes a vertical sequence on narrow screens.
- Wide screens center each content panel inside Starlight's main pane. The
  shell can hold previews, code, and tables, while prose and callout text stay
  near `72ch`; desktop space improves composition without creating long lines.
- Respect `prefers-reduced-motion`. No required meaning depends on hover or motion.
- Light and dark modes must both meet readable text and control contrast.
- Below Starlight's `50rem` navigation breakpoint, search, menu, theme controls,
  and sidebar rows have at least `44px` tap targets. Keep the native drawer's
  preferences visible at its bottom, with safe-area padding and space for the
  last navigation item to scroll above them.
- The mobile home mark is centered and capped at `9rem`; headings and both
  starting links take priority over decorative logo size.
- Heading rhythm belongs to Starlight's generated `.sl-heading-wrapper` elements.
  Authored heading and table overrides live in `starlight.components` so native
  Markdown rules cannot silently replace them later in `starlight.content`.
  On small phones, source tabs inside numbered steps reclaim the step gutter;
  their labels and code retain native horizontal scrolling.
- Gallery card internals and playground controls use named container queries,
  including when the reading column is narrower than the browser viewport.

## Guardrails

- Declare Starlight's `base`, `reset`, `core`, `content`, `components`, and
  `utils` sublayer order before defining any custom Starlight layer. The custom
  stylesheet loads early, so an implicit order would let the later reset erase
  component spacing.
- Preserve verified API content and code examples.
- Use one purposeful interaction rather than decorative animation throughout.
- Avoid gradient text, decorative grids, fake terminals, generic icon-card grids,
  and invented runtime or hardware claims.
- No external fonts, new UI dependencies, or raster assets are required.
