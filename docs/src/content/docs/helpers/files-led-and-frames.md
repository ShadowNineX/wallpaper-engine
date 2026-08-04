---
title: Files, LED & Frames Helpers
description: Normalize browser file URLs, encode canvas RGB data, and pace animation frames with Wallpaper Engine limits.
---

```ts
import {
  createFpsLimiter,
  encodeCanvasForLed,
  toFileUrl,
} from 'wallpaper-engine/helpers';
```

## File URLs

`toFileUrl(path)` converts host filesystem values without breaking browser-ready URLs:

| Input | Output |
| --- | --- |
| `''` | `''` |
| `C:/Images/background.png` | `file:///C:/Images/background.png` |
| `/assets/background.png` | Preserved |
| `https://…`, `http://…`, `data:…`, `blob:…`, `file:…` | Preserved, case-insensitively by scheme |

```ts
image.src = toFileUrl(property.value);
```

The function returns either the original string or one newly prefixed string. It performs no filesystem lookup or URL encoding. See [Files & Directories](../../guides/files-and-directories/) for host paths and simulator-owned object URLs.

## LED canvas encoding

`encodeCanvasForLed(canvas)` reads the full 2D canvas and returns the concatenated RGB byte string expected by both hardware surfaces:

```ts
const encoded = encodeCanvasForLed(canvas);
window.wpPlugins.led.setAllDevicesByImageData(
  encoded,
  canvas.width,
  canvas.height,
);
```

For every pixel, the output contains three code points in row-major order:

```text
canvas RGBA bytes: R G B A | R G B A | …
encoded string:    R G B   | R G B   | …
```

Alpha is discarded. The result length is `canvas.width * canvas.height * 3`. The helper allocates the browser's `ImageData` and builds a new string, so use a small canvas such as 100×20 rather than the full wallpaper frame.

If `canvas.getContext('2d')` returns `null`, the helper throws `Error('Could not get 2D context from canvas')`. Errors from `getImageData()`, including a tainted canvas, propagate.

### Wait for hardware readiness

Do not call hardware APIs before the host reports their plugin:

```ts
window.wallpaperPluginListener = {
  onPluginLoaded(name) {
    if (name === 'led') {
      sendGeneralLedFrame();
    }
    if (name === 'cue') {
      sendAdvancedCueFrame();
    }
  },
};
```

Use `window.wpPlugins.led.setAllDevicesByImageData()` for general RGB hardware. Use `window.cue.setLedColorsByImageData()` only after the `cue` plugin loads and direct Corsair iCUE access is required. The helper only encodes bytes; it does not check readiness or send data.

## Frame limiting

`createFpsLimiter(draw)` owns one `requestAnimationFrame` chain and passes elapsed seconds to each allowed draw:

```ts
const loop = createFpsLimiter((dt) => {
  updateSimulation(dt);
  renderFrame();
});

window.wallpaperPropertyListener = {
  applyGeneralProperties(properties) {
    if (properties.fps !== undefined) {
      loop.setLimit(properties.fps);
    }
  },
  setPaused(paused) {
    if (paused) {
      loop.stop();
    }
    else {
      loop.start();
    }
  },
};

loop.start();
```

### Lifecycle

| Method | Behavior |
| --- | --- |
| `start()` | Cancels an existing scheduled frame, resets timing and the cap accumulator, then schedules a fresh frame |
| `stop()` | Cancels the scheduled frame and becomes a no-op when already stopped |
| `setLimit(fps)` | Updates the cap for the next frame; changing the value resets accumulated threshold time |

A limit greater than `0` caps drawing. `0` and all negative/non-positive values are uncapped, matching the host's `0 = unlimited` convention without rejecting defensive values.

### Elapsed time and stalls

- `dt` is seconds since the last allowed draw, clamped to 0–1.
- Backward or duplicate timestamps therefore produce `0`, not a negative step.
- Long background-tab stalls produce at most `1` second of simulation progress on the next draw, avoiding a spiral of death.
- Under a cap, elapsed tick time accumulates until a frame duration is reached; the remainder is retained to reduce drift.
- Restarting after pause resets both timing baselines, so paused wall-clock time is not delivered as `dt`.

The limiter controls draw frequency, not browser animation-frame scheduling. It maintains one RAF callback while running and skips `draw` calls that arrive before the cap threshold.

## Related audio and media helpers

Use the dedicated [Audio guide](../../guides/audio/) for `clampAudio()`, `leftChannel()`, and `rightChannel()`. Use the [Media guide](../../guides/media/) for `getMediaPlaybackStatus()`. Those pages include the host callbacks that make the helpers meaningful.

## Source

All functions on this page are implemented in [`src/helpers.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/helpers.ts).

## Next steps

Connect the simulator's Runtime tab in [Development Simulation](../../devtools/simulation/) and check exact signatures in [Helpers API](../../reference/helpers/).
