---
title: Host Listeners
description: Register Wallpaper Engine property, plugin, audio, media, pause, FPS, and directory callbacks without missing startup events.
---

Wallpaper Engine discovers callbacks through browser globals. Register them as the runtime module evaluates—never inside `window.onload`, a component mount hook, or a timer.

```ts
import 'wallpaper-engine';

window.wallpaperPropertyListener = {
  applyUserProperties(properties) {
    if (properties.accent) {
      // Apply only the changed key.
    }
  },
};
```

Deferring registration can miss startup events. Import the module containing these assignments from the browser entry point before creating framework state that depends on them.

## Singleton objects and registration functions

The host surface has two ownership models:

| API | Model | Consequence |
| --- | --- | --- |
| `wallpaperPropertyListener` | Assign one object | A later assignment replaces the previous object's callbacks |
| `wallpaperPluginListener` | Assign one object | A later assignment replaces plugin-load handling |
| `wallpaperRegisterAudioListener()` | Registration function | Registers a callback; the simulator supports multiple listeners |
| Five `wallpaperRegisterMedia*Listener()` functions | Registration functions | Each registers callbacks for one media event stream; the simulator supports multiple listeners |

Own each singleton assignment in one integration module. If several subsystems need a property event, dispatch from that object rather than letting modules overwrite one another. Treat host behavior as authoritative; multi-listener registration and replay details described by the devtools are simulator behavior unless Wallpaper Engine documents them.

## Property listener callbacks

`WallpaperPropertyListener` exposes five optional callbacks:

| Callback | Payload | Responsibility |
| --- | --- | --- |
| `applyUserProperties` | Property-key map | Initial settings and later partial changes |
| `applyGeneralProperties` | `{ fps?: number }` | Apply the host's app-level FPS limit |
| `setPaused` | `boolean` | Stop or resume animation, timers, audio processing, and other work |
| `userDirectoryFilesAddedOrChanged` | Property name and file paths | Update a `fetchall` directory collection |
| `userDirectoryFilesRemoved` | Property name and file paths | Remove entries from a `fetchall` collection |

```ts
window.wallpaperPropertyListener = {
  applyGeneralProperties(properties) {
    if (properties.fps !== undefined) {
      renderLoop.setLimit(Math.max(0, properties.fps));
    }
  },
  setPaused(isPaused) {
    if (isPaused)
      renderLoop.stop();
    else renderLoop.start();
  },
  userDirectoryFilesAddedOrChanged(propertyName, changedFiles) {
    const files = directoryFiles.get(propertyName) ?? new Set<string>();
    for (const path of changedFiles) files.add(path);
    directoryFiles.set(propertyName, files);
  },
  userDirectoryFilesRemoved(propertyName, paths) {
    removeDirectoryFiles(propertyName, paths);
  },
};
```

An FPS of `0` means unlimited. Preserve that meaning instead of substituting an arbitrary cap. Pause handling should stop expensive work and resume cleanly rather than merely hiding output.

### Partial user-property deliveries

The initial host callback contains all user properties; later callbacks contain only changed keys. With an inferred schema:

```ts
function applyUserPropertyUpdate(
  values: Partial<WallpaperUserPropertiesOf<typeof properties>>,
): void {
  if (values.background)
    setBackground(values.background.value);
  if (values.speed)
    setSpeed(values.speed.value);
}
```

A missing key means unchanged. See [Type Inference](../type-inference/) for the full boundary pattern.

## Plugin listener

Assign `wallpaperPluginListener` to learn when RGB integrations become available:

```ts
window.wallpaperPluginListener = {
  onPluginLoaded(name, version) {
    if (name === 'led') {
      // General RGB hardware is available through window.wpPlugins.led.
    }
    if (name === 'cue') {
      // Advanced Corsair iCUE SDK access is available through window.cue.
    }
  },
};
```

`version` is host supplied. Use the general `led` integration unless direct iCUE features are required.

## Audio and media registration

Audio and media use registration functions rather than singleton objects:

```ts
window.wallpaperRegisterAudioListener((samples) => {
  if (!paused)
    updateVisualizer(samples);
});

window.wallpaperRegisterMediaStatusListener((event) => {
  mediaEnabled = event.enabled;
});
```

Register each function immediately for the same startup-event reason. Detailed payloads and safe patterns are in [Audio](../audio/) and [Media](../media/).

## Callback ownership and errors

Keep raw host callbacks thin:

1. Validate or narrow the host-shaped payload.
2. Forward it to one application state function.
3. Isolate optional integrations so one failing consumer does not corrupt another callback path.
4. Release resources when a new event replaces them or the page shuts down.

The development simulator guards and logs failures from audio/media fanout, directory notifications, random-file callbacks, and registration replay. Explicit property, general, and plugin UI delivery is not universally isolated, so application callbacks must still own their failure handling.

## Replay ordering

Property, general, and pause state replays when a property listener registers in development, and current media state can replay when media listeners register. Plugin-load events do not replay; fire them explicitly from the Runtime tab. The Properties tab also has a replay-all action. These conveniences make late-listener bugs easier to diagnose, but they are not host ordering guarantees. Production code must still register immediately and tolerate independently arriving streams.

Refer to Wallpaper Engine's official [property listener documentation](https://docs.wallpaperengine.io/en/web/api/propertylistener.html) for host-owned timing and callback behavior.

## Source

The public listener contracts are in [`src/types/listeners.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/listeners.ts) and ambient globals in [`src/types/window.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/window.ts).

## Next steps

Implement directory delivery in [Files & Directories](../files-and-directories/), audio visualization in [Audio](../audio/), and media state in [Media](../media/).
