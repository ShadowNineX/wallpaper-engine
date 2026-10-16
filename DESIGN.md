# Devtools design system

The Astro documentation has its own Read-mode surface guide in
[docs/DESIGN.md](docs/DESIGN.md). Its reading layout and interactive lessons do
not change the devtools controls described here.

## Direction

The devtools frontend is a compact engineering workbench inspired by browser framework tooling. Nuxt UI supplies component behavior and visual primitives. The shell uses a deep blue-black neutral palette, cool blue selection, restrained status color, and dense spacing suited to a panel that stays open beside live work.

The UI should feel built into the browser rather than floating above it. Docked and separate-window views use the full available frame. Placement, resizing, and window lifecycle belong to the host; the frontend concentrates on navigation and tools.

## Structure

- A slim command bar identifies the wallpaper, build, and window controls.
- Five persistent tabs expose Properties, Runtime, Audio, Media, and Performance.
- Runtime, Audio, and Media include concise live statuses. At narrow widths the text collapses visually to a colored dot while remaining available to assistive technology. Properties and Performance use their icons and labels without status indicators.
- Tab content scrolls independently below fixed navigation.
- Selecting a later tab brings content in from the right; selecting an earlier
  tab brings it in from the left. The navigation and scroll frame stay fixed.
  The 200 ms entrance uses transform and opacity, cancels naturally when its
  panel unmounts, and is disabled for reduced motion. Initial content is static.
- Sections use rhythm and separators. Cards are reserved for content that needs a bounded surface.

## Visual language

- Space Grotesk is the interface face; JetBrains Mono is reserved for versions, timing, sizes, and code-like values.
- Blue is reserved for selection, focus, and primary actions. Emerald means active or healthy; amber means attention or a missing listener.
- Borders carry separation; shadows are unnecessary inside the docked workbench.
- Corners stay modest. Pills are limited to badges, status, and the requested vertical slider handles.
- Motion is short and functional, and reduced-motion preferences remove it.

## Interaction and accessibility

- Tabs use native tab semantics with automatic keyboard activation.
- Icon-only window controls always have accessible labels and titles.
- Focus rings remain visible against every surface.
- Touch targets expand to 44 pixels on coarse pointers.
- Disconnected controls become inert while a visible status message explains recovery.
- The layout must remain readable at 320 pixels wide and at wide bottom-dock proportions.

## Island motion

The focal transition connects the compact island to the panel it controls. The
host keeps the iframe alive and uses its current island position as the motion
origin. Opening decelerates into the workbench; closing returns faster. Content
reveals with the expanding surface. Transform and opacity carry the transition,
with no per-frame layout work or new animation dependency. Rapid toggles cancel
stale transitions, and reduced motion uses an immediate state change.
