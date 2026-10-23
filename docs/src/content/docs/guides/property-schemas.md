---
title: Property Schemas
description: Define every Wallpaper Engine property kind, normalization rule, localization token, and editor ordering constraint.
---

Import property builders from `wallpaper-engine/plugin` and keep the resulting record shared between `vite.config.ts` and the wallpaper runtime.

```ts
import {
  boolProperty,
  colorProperty,
  comboProperty,
  directoryProperty,
  dividerProperty,
  fileProperty,
  groupProperty,
  sliderProperty,
  textInputProperty,
} from 'wallpaper-engine/plugin';
```

Each builder injects the `type` discriminant. Except for the documented color, slider, and group normalization, it passes the remaining options through unchanged.

## Common fields

Every property accepts these editor-facing fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `text` | `string` | Display label or `ui_` localization token; optional for dividers, required for other kinds |
| `icon` | `string` | Optional Font Awesome CSS class or class list for the native property label, such as `fa-palette` |
| `value` | Kind-specific | Required for value properties; `groupProperty()` injects `''`; dividers have no value |
| `order` | `number` | Optional sort order in the property panel |
| `index` | `number` | Optional internal editor index |
| `condition` | `string` | JavaScript visibility expression referencing another property, such as `showclock.value == true` |

When generating `project.json`, the plugin walks the record in JavaScript insertion order and assigns each missing `index` and `order` to its zero-based position. An explicitly defined `index` or `order` wins independently. Keep record order meaningful even when overriding one of those fields.

### Native property icons

All property builders accept `icon` and preserve it in `project.json`:

```ts
const accent = colorProperty({
  text: 'Accent',
  value: '#5b86ed',
  icon: 'fa-palette',
});
```

Wallpaper Engine's native wallpaper browser adds `fas fa-fw` to the icon element
and applies your class string. An omitted or empty `icon` hides the element.
Icon availability depends on the host's bundled Font Awesome version. This
metadata does not change the inferred runtime value type. The development
simulator does not load Wallpaper Engine's Font Awesome fonts.

This behavior was checked against the installed Wallpaper Engine **2.8.42**:
`ui/dist/scripts/scripts.js`, template `views/includes/browseruserproperties.html`,
binds `property.icon` on the property-label icon element. Its
`ui/dist/styles/main.css` bundles Font Awesome Pro **6.7.2**, including `fa-palette`.

## Builder and runtime matrix

| Builder | Definition-specific fields | Runtime `value` |
| --- | --- | --- |
| `colorProperty()` | `value: string` | Normalized `"R G B"` string; channels are 0–1 |
| `sliderProperty()` | `value`, `min`, `max`; optional `fraction`, `precision`, `step` | `number` |
| `boolProperty()` | `value: boolean` | `boolean` |
| `comboProperty()` | `value: string`, `options: { label, value }[]` | Selected hidden `value` plus display `text` |
| `textInputProperty()` | `value: string` | `string` |
| `fileProperty()` | `value: string`; optional `fileType: 'image' \| 'video'` | Native path or simulator `blob:` URL |
| `directoryProperty()` | `value: string`, `mode: 'ondemand' \| 'fetchall'`; optional `fileType` | Directory path; files arrive through mode-specific callbacks |
| `groupProperty()` | No caller-supplied `value` | No inferred value key; native callbacks may include layout metadata |
| `dividerProperty()` | Optional `text`, `icon`, `order`, `index`, `condition`; no `value` | No inferred value key; native callbacks may include layout metadata |

## Colors

`colorProperty()` accepts any syntax supported by [Color.js](https://colorjs.io/docs/), including named colors, hex, `rgb()`, HSL, HWB, Lab, LCH, OKLab, OKLCH, wide-gamut `color()`, and Wallpaper Engine's native three-channel format.

```ts
const accent = colorProperty({
  text: 'Accent',
  value: 'oklch(70% 0.18 250)',
});
```

The builder converts supported input to sRGB and stores Wallpaper Engine's native `"R G B"` form with channels in the 0–1 range. Native input such as `'0.1 0.5 1'` is validated and normalized by the same public color utility. Invalid or non-finite channels throw rather than producing malformed project metadata.

## Sliders

```ts
const opacity = sliderProperty({
  text: 'Opacity',
  value: 0.5,
  min: 0,
  max: 1,
  fraction: true,
  precision: 3,
});
// Emits step: 0.001 because no explicit step was supplied.
```

- `fraction: true` marks decimal values in Wallpaper Engine's property editor.
- `precision` declares the decimal places used when rounding slider interactions.
- With `precision` and no `step`, the builder derives `step` as $10^{-\text{precision}}$.
- An explicit `step` is emitted unchanged and takes precedence over derivation.
- The native runtime panel falls back to step `1` when `step` is absent or zero,
  independently of `fraction`. It uses precision `1` when `precision` is absent
  or zero. Devtools follows the same fallbacks and rounds values on interaction;
  it preserves an initial value until the user moves the slider.
- The installed property editor uses a separate authoring convention: fractional
  precision is clamped to 1–4 and its generated step is `1` for precision `1`,
  otherwise $10^{1-\text{precision}}$. Hand-authored explicit steps are still
  accepted by the runtime panel. Supply enough precision for the requested step.

## Combo boxes

```ts
const style = comboProperty({
  text: 'Visual style',
  value: 'bars',
  options: [
    { label: 'Bars', value: 'bars' },
    { label: 'Wave', value: 'wave' },
  ],
});
```

`label` is editor-visible and may be a localization token. `value` is the hidden string delivered at runtime. TypeScript intentionally keeps combo values as `string`; narrow application-specific choices after validation.

## Files and directories

Use `fileType: 'image'` or `'video'` to filter eligible files in the editor and simulator. An empty `value` means no selection.

Directory modes define how files are delivered:

- `ondemand`: call `wallpaperRequestRandomFileForProperty()` and receive one path in its callback.
- `fetchall`: maintain a collection from `userDirectoryFilesAddedOrChanged` and `userDirectoryFilesRemoved`.

The directory property update itself contains the selected directory path, not its file list. See [Files & Directories](../files-and-directories/) for both lifecycles.

## Group boundaries

```ts
const properties = {
  appearance: groupProperty({ text: 'Appearance' }),
  background: colorProperty({ text: 'Background', value: '0 0 0' }),
  playback: groupProperty({ text: 'Playback' }),
  speed: sliderProperty({ text: 'Speed', value: 1, min: 0, max: 5 }),
};
```

A group is a collapsible layout marker. Every following property belongs to it until the next group marker. The builder injects `type: 'group'` and `value: ''`; group keys are omitted from `WallpaperPropertyListenerOf` callback parameters. Native callbacks may include the group descriptor with its empty placeholder value.

## Dividers

Use a divider to insert a horizontal separator. Both its label and builder
options are optional:

```ts
const properties = {
  accent: colorProperty({ text: 'Accent', value: '#5b86ed' }),
  separator: dividerProperty(),
  advanced: boolProperty({ text: 'Advanced options', value: false }),
  advancedSeparator: dividerProperty({
    text: 'Advanced settings',
    condition: 'advanced.value',
  }),
};
```

The builder emits `{ type: 'divider', ...metadata }` without inventing `text` or
`value`. The plugin assigns missing `index` and `order` as usual. Dividers are
excluded from both property inference utilities, simulator callback values, and
editable bridge state. In the simulator they respect display conditions and
stay inside the current group; a divider does not start a new group.

Native `applyUserProperties` callbacks may include divider descriptors without
`value`. When using the broad `WallpaperPropertyListener` type, guard a property
with `'value' in property` before reading it. `WallpaperPropertyListenerOf<T>`
projects only editable value keys, so its existing value guards remain sufficient.

Native behavior was checked against Wallpaper Engine **2.8.42**. The
`views/includes/browseruserproperties.html` template in
`ui/dist/scripts/scripts.js` renders a divider as `<hr class="fullWidth">`
under the common display-condition check and supports an optional label.
Read-only inspection of `wallpaper64.exe` also found the `_d0` default
divider construction: the block at virtual address `0x14010CE32` sets `type`
to `divider` and sets `order`, without initializing a label or value.

## Localization

Use `ui_` tokens in property `text` and combo `label` values, then define translations under `general.localization`:

```ts
wallpaperEnginePlugin({
  title: 'Localized wallpaper',
  properties,
  localization: {
    'en-us': { ui_accent: 'Accent color' },
    'de-de': { ui_accent: 'Akzentfarbe' },
  },
});
```

The outer key is a Wallpaper Engine language identifier; the inner map resolves `ui_` tokens to display strings. Consult Wallpaper Engine's [property documentation](https://docs.wallpaperengine.io/en/web/customization/properties.html) for host-owned expression and localization behavior.

## Source

Builder behavior is defined in [`src/plugin/index.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/plugin/index.ts); stored property shapes live in [`src/types/project.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/project.ts).

## Next steps

Use [Type Inference](../type-inference/) to derive host callback values, then implement their delivery paths in [Host Listeners](../host-listeners/).
