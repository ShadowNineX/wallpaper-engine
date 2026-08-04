---
title: Files & Directories
description: Handle file properties, on-demand and fetch-all directories, native paths, and simulator object URLs safely.
---

Wallpaper Engine and the development simulator expose the same callbacks but cannot expose local files in the same way. Normalize a received path at the point where it becomes a browser URL.

```ts
import { toFileUrl } from 'wallpaper-engine/helpers';

image.src = toFileUrl(properties.background.value);
```

`toFileUrl()` prefixes a native path such as `C:/Wallpapers/image.png` with `file:///`. It preserves empty strings, root-relative paths, and existing `http:`, `https:`, `data:`, `blob:`, or `file:` URLs.

## File properties

```ts
const background = fileProperty({
  text: 'Background image',
  value: '',
  fileType: 'image',
});
```

`fileType: 'image' | 'video'` asks the editor and simulator to filter selectable files. The runtime wrapper is `{ value: string }`.

| Environment | Value shape | Browser use |
| --- | --- | --- |
| Wallpaper Engine | Native filesystem path | Pass through `toFileUrl()` to add `file:///` |
| Development simulator | Local `blob:` object URL | Pass through `toFileUrl()`; it remains unchanged |

The simulator does not upload the selected file or disclose its filesystem path. The browser creates a page-local object URL. The simulator revokes URLs when selections are replaced or cleared and on page unload; application code must not persist those URLs across reloads.

:::note[Object URL ownership]
If your own code creates an object URL, your code owns `URL.revokeObjectURL()`. Do not revoke a simulator-owned URL while simulator state still references it.
:::

## Directory modes

A directory property requires one delivery mode:

```ts
const randomImages = directoryProperty({
  text: 'Random images',
  value: '',
  fileType: 'image',
  mode: 'ondemand',
});

const gallery = directoryProperty({
  text: 'Gallery',
  value: '',
  fileType: 'image',
  mode: 'fetchall',
});
```

The property callback's `value` is the selected directory path. Route files through the callbacks for that mode.

| Mode | Request | Delivery | Application state |
| --- | --- | --- | --- |
| `ondemand` | `wallpaperRequestRandomFileForProperty(key, callback)` | One property name and file path | Current random file |
| `fetchall` | No request | `userDirectoryFilesAddedOrChanged` and `userDirectoryFilesRemoved` | Collection keyed by property name |

### `ondemand`: request one file

```ts
function requestRandomImage(): void {
  window.wallpaperRequestRandomFileForProperty(
    'randomimages',
    (propertyName, filePath) => {
      if (propertyName !== 'randomimages')
        return;
      randomImage.src = toFileUrl(filePath);
    },
  );
}
```

Request after the directory property becomes non-empty and whenever the application wants another random file. An empty path means no file is currently available; handle it without constructing a URL.

### `fetchall`: maintain a collection

```ts
const filesByProperty = new Map<string, Set<string>>();

window.wallpaperPropertyListener = {
  userDirectoryFilesAddedOrChanged(propertyName, changedFiles) {
    const files = filesByProperty.get(propertyName) ?? new Set<string>();
    for (const path of changedFiles) files.add(path);
    filesByProperty.set(propertyName, files);
  },
  userDirectoryFilesRemoved(propertyName, removedFiles) {
    const files = filesByProperty.get(propertyName);
    if (!files)
      return;
    for (const path of removedFiles) files.delete(path);
  },
};
```

Convert a path with `toFileUrl()` only when assigning it to an image, video, or fetch operation. Keeping native paths as collection identities lets removal callbacks match the original values.

## Lifecycle

```text
selection changes
  ├─ file property ───────────────→ partial user-property callback → render URL
  ├─ ondemand directory selected ─→ request random file → callback → render URL
  └─ fetchall directory selected ─→ add/change callbacks → collection
                                      remove callbacks → collection cleanup
```

In the simulator, changing a local file or directory selection also revokes obsolete `blob:` URLs. On the host, Wallpaper Engine owns native-path availability.

## Filtering

`fileType` filters images or videos. The simulator applies extension-based filtering to locally selected files; Wallpaper Engine owns its editor filtering rules. Always tolerate an empty collection and files that become unavailable between selection and use.

For official host semantics, see Wallpaper Engine's [custom property documentation](https://docs.wallpaperengine.io/en/web/customization/properties.html).

## Source

Property contracts live in [`src/types/project.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/project.ts), host callbacks in [`src/types/window.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/window.ts), and normalization in [`src/helpers.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/helpers.ts).

## Next steps

Use [Host Listeners](../host-listeners/) to centralize callback ownership and [Files, LED & Frames](../../helpers/files-led-and-frames/) for the exact `toFileUrl()` contract.
