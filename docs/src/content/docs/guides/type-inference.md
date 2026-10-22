---
title: Type Inference
description: Infer typed partial host callbacks directly from your property schema.
---

Use `WallpaperPropertyListenerOf` from the root type entry and `satisfies` on the
listener object. TypeScript infers each callback parameter, so `applyUserProperties`
needs no local value-type alias, cast, or manual `Partial`.

## Recommended listener pattern

Start with the property record from the [quick start](../../getting-started/quick-start/),
then connect its type to your listener:

```ts
import type { WallpaperPropertyListenerOf } from 'wallpaper-engine';
import type { properties } from './properties';
import { wallpaperColorToHex } from 'wallpaper-engine/helpers';
import 'wallpaper-engine';

window.wallpaperPropertyListener = {
  applyUserProperties(values) {
    if (values.accent) {
      document.body.style.backgroundColor = wallpaperColorToHex(values.accent.value);
    }
    if (values.intensity) {
      // A slider's value is inferred as number.
      document.documentElement.style.setProperty('--intensity', String(values.intensity.value));
    }
    if (values.showTitle) {
      // A boolean property's value is inferred as boolean.
      document.body.classList.toggle('title-hidden', !values.showTitle.value);
    }
  },
} satisfies WallpaperPropertyListenerOf<typeof properties>;
```

Here `properties` contains `accent`, `intensity`, and `showTitle`. Unknown property keys and incorrect value types are
compile-time errors. Group and divider markers are excluded from the inferred value keys. The native host may still include their layout metadata in the raw callback object.

The inferred listener describes known editable keys for direct access; it does
not filter the host's callback object. To enumerate the complete payload with
`Object.values()` or `Object.entries()`, use the broad `WallpaperPropertyListener`
type and check `'value' in property` before reading a value.

The schema reference remains necessary: the ambient browser global cannot know
which properties a project defines. `import type` connects the schema without
loading its builders or Vite integration at runtime. The listener type is also
erased, so this pattern adds no JavaScript.

:::caution[Keep the guards]
Wallpaper Engine sends all values on initial delivery, then only changed keys.
The listener type makes every user-property key optional automatically. A missing
key means unchanged; do not reset it to a default or dereference it without a guard.
:::

Register the listener immediately at module scope, before framework lifecycle
hooks. See [Host Listeners](../host-listeners/) for startup timing.

## Built-in properties and defaults

`WallpaperPropertyListenerOf<T>` includes Wallpaper Engine's built-in keys even
when they are absent from your property record:

| Keys | Value type | Fallback default |
| --- | --- | --- |
| `schemecolor` | `string` | `'0.5 0.5 0.5'` when no scheme color is configured |
| `audioprocessing` | `boolean` | `true` for audio-capable wallpapers |
| `alignmentfliph`, `wec_e` | `boolean` | `false` |
| `wec_brs`, `wec_con`, `wec_sa`, `wec_hue` | `number` | `50` |

All callback keys remain optional. `audioprocessing` is absent when the wallpaper
does not support audio processing. Explicit definitions in your record take
precedence over the built-in types for matching keys.

The root exports the `DefaultWEProps` definition type. The helpers entry exports
the matching default definitions, including the audio-capable fallback:

```ts
import type { WallpaperPropertyListenerOf } from 'wallpaper-engine';
import type { properties } from './properties';
import { DefaultWEProps } from 'wallpaper-engine/helpers';

let brightness = DefaultWEProps.wec_brs.value;
let audioRecording = DefaultWEProps.audioprocessing.value;

window.wallpaperPropertyListener = {
  applyUserProperties(values) {
    if (values.wec_brs)
      brightness = values.wec_brs.value;
    if (values.audioprocessing)
      audioRecording = values.audioprocessing.value;
  },
} satisfies WallpaperPropertyListenerOf<typeof properties>;
```

Use these values to initialize local state, then apply host updates. Saved user
settings and the plugin's `schemeColor` option can override the defaults. These
exports do not add built-in definitions to the generated `project.json`.

Devtools provides the built-in controls alongside custom properties. Audio
recording is enabled in development's automatic mode; set
`supportsAudioProcessing: false` to omit it. Production audio support continues
to use the configured override or built-output detection.

## Inferred runtime values

Definitions include editor metadata; callbacks contain host-shaped wrappers:

| Property kind | Callback wrapper |
| --- | --- |
| `color` | `{ value: string }`, normalized host color |
| `slider` | `{ value: number }` |
| `bool` | `{ value: boolean }` |
| `combo` | `{ value: string; text: string }` |
| `textinput` | `{ value: string }` |
| `file` | `{ value: string }` |
| `directory` | `{ value: string }` |
| `group`, `divider` | No inferred value key |

Combo values remain `string`; validate a host value before narrowing it to an
application-specific literal union. Definitions describe possible editor choices,
while older saved settings or external hosts may deliver other strings.

## Reuse a callback or update type

For a separate handler, extract the already-inferred callback type:

```ts
type Listener = WallpaperPropertyListenerOf<typeof properties>;
type ApplyProperties = NonNullable<Listener['applyUserProperties']>;

const applyProperties: ApplyProperties = (values) => {
  if (values.intensity)
    document.documentElement.style.setProperty('--intensity', String(values.intensity.value));
};

window.wallpaperPropertyListener = {
  applyUserProperties: applyProperties,
} satisfies Listener;

// Only needed when another helper accepts the update object itself:
type PropertyUpdate = Parameters<ApplyProperties>[0];
```

`PropertyUpdate` is already partial. Do not wrap it in another `Partial`.

## Deprecated utility

`WallpaperUserPropertiesOf` from `wallpaper-engine/plugin` remains available but
is deprecated. Existing code continues to compile. Migrate to the
[recommended listener pattern](#recommended-listener-pattern) by replacing the
import, removing the local value-type alias and callback parameter annotation,
and adding `satisfies WallpaperPropertyListenerOf<typeof properties>`.

## Source

Inference is shared internally in [`src/types/inference.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/inference.ts).
Host callback contracts live in [`src/types/listeners.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/listeners.ts).
