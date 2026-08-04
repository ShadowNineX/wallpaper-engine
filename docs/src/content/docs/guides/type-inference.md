---
title: Type Inference
description: Derive host runtime values from property definitions and handle partial callbacks without losing type safety.
---

Property definitions describe `project.json`; Wallpaper Engine callbacks deliver smaller runtime wrappers. The plugin entry exports two type utilities that connect those layers.

```ts
import type {
  PropertyDefinitionToValue,
  WallpaperUserPropertiesOf,
} from 'wallpaper-engine/plugin';
```

## Map one definition

`PropertyDefinitionToValue<T>` maps a property discriminant to its host callback wrapper:

| Definition | Runtime wrapper |
| --- | --- |
| `WallpaperColorProperty` | `WallpaperColorValue` (`{ value: string }`) |
| `WallpaperSliderProperty` | `WallpaperSliderValue` (`{ value: number }`) |
| `WallpaperBoolProperty` | `WallpaperBoolValue` (`{ value: boolean }`) |
| `WallpaperComboProperty` | `WallpaperComboValue` (`{ value: string; text: string }`) |
| `WallpaperTextInputProperty` | `WallpaperTextValue` (`{ value: string }`) |
| `WallpaperFileProperty` | `WallpaperFileValue` (`{ value: string }`) |
| `WallpaperDirectoryProperty` | `WallpaperDirectoryValue` (`{ value: string }`) |
| `WallpaperGroupProperty` | `never` |

This is useful for generic helpers operating on one definition kind.

```ts
import type { WallpaperColorProperty } from 'wallpaper-engine';
import type { PropertyDefinitionToValue } from 'wallpaper-engine/plugin';

type RuntimeColor = PropertyDefinitionToValue<WallpaperColorProperty>;
// { value: string }
```

## Infer a complete record

`WallpaperUserPropertiesOf<T>` maps every record key through `PropertyDefinitionToValue` and removes keys whose definition is a group.

```ts
import type { WallpaperUserPropertiesOf } from 'wallpaper-engine/plugin';
import type { properties } from './properties';

type UserProperties = WallpaperUserPropertiesOf<typeof properties>;
```

Given color `accent`, slider `speed`, and group `appearance`, the result is equivalent to:

```ts
interface UserProperties {
  readonly accent: { value: string };
  readonly speed: { value: number };
}
```

The group is layout metadata, so there is no `appearance` runtime key.

## Definitions are not callback values

A definition includes editor configuration such as `type`, `text`, default `value`, range, options, ordering, and conditions. A callback wrapper contains the current host value and, for combos, its current display text. Do not type `applyUserProperties` with the definition record itself.

:::caution[Callbacks are partial]
Wallpaper Engine supplies all user properties during initial delivery, then only changed properties. The inferred record describes all possible keys; annotate each callback argument as `Partial<UserProperties>` and guard each key before use.
:::

```ts
function applyProperties(values: Partial<UserProperties>): void {
  if (values.accent) {
    setAccent(values.accent.value);
  }

  if (values.speed) {
    setSpeed(values.speed.value);
  }
}

window.wallpaperPropertyListener = {
  applyUserProperties(values) {
    applyProperties(values as Partial<UserProperties>);
  },
};
```

The ambient listener accepts the open-ended `WallpaperUserProperties` host type because it cannot know your build-time schema. The narrow assertion belongs at the boundary, after which key guards preserve safety.

## Apply updates without resetting state

Treat a missing key as “unchanged,” not “use the default.” A safe state reducer copies only values present in the callback:

```ts
interface State {
  accent: string;
  speed: number;
}

function updateState(state: State, values: Partial<UserProperties>): void {
  if (values.accent)
    state.accent = values.accent.value;
  if (values.speed)
    state.speed = values.speed.value;
}
```

This pattern survives startup delivery, one-property updates, and simulator replay without accidentally resetting unrelated values.

## Narrow combo strings in the application

Combo values remain `string` because the builder return type follows the public Wallpaper Engine schema rather than retaining every literal option. Validate before narrowing:

```ts
type VisualStyle = 'bars' | 'wave' | 'off';

function isVisualStyle(value: string): value is VisualStyle {
  return value === 'bars' || value === 'wave' || value === 'off';
}

if (values.visualStyle && isVisualStyle(values.visualStyle.value)) {
  setVisualStyle(values.visualStyle.value);
}
```

Avoid a blind cast when the host or an older saved project could supply a value outside the current options.

## Source

The conditional and mapped types live in [`src/plugin/index.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/plugin/index.ts). Runtime wrapper contracts live in [`src/types/listeners.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/listeners.ts).

## Next steps

Register these callbacks at the correct time in [Host Listeners](../host-listeners/), then handle native and simulated paths in [Files & Directories](../files-and-directories/).
