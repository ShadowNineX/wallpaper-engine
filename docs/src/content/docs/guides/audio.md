---
title: Audio
description: Register Wallpaper Engine audio visualization safely, process its stereo spectrum, and test every simulator mode.
---

Register the audio callback while the runtime module evaluates:

```ts
import { clampAudio, leftChannel, rightChannel } from 'wallpaper-engine/helpers';

window.wallpaperRegisterAudioListener((rawSamples) => {
  if (paused)
    return;

  const samples = clampAudio(rawSamples);
  renderSpectrum({
    left: leftChannel(samples),
    right: rightChannel(samples),
  });
});
```

Do not defer registration to a mount hook or load event; startup audio delivery can otherwise be missed.

## Frame layout

Each callback receives 128 spectrum samples:

| Indices | Channel | Frequency order |
| --- | --- | --- |
| 0–63 | Left | Bass to treble |
| 64–127 | Right | Bass to treble |

Wallpaper Engine normally supplies values near 0–1, but its FFT can produce values above `1`. Values can also be malformed at an integration boundary. `clampAudio()` returns a new 128-element-compatible array with finite values clamped to 0–1 and non-finite values replaced with `0`. `leftChannel()` and `rightChannel()` each return a new 64-element slice.

If allocations matter in an animation hot path, clamp and copy into preallocated application buffers instead of calling the convenience helpers on every frame.

## Pause handling

Audio callbacks and rendering state are separate. Record host pause state through `setPaused`, skip audio processing while paused, and stop the render loop:

```ts
let paused = false;

window.wallpaperPropertyListener = {
  setPaused(value) {
    paused = value;
    if (paused)
      renderLoop.stop();
    else renderLoop.start();
  },
};
```

Resume from current state rather than expecting the host to replay older audio frames.

## Enable processing in `project.json`

Wallpaper Engine requires `general.supportsaudioprocessing: true`. During production builds, `wallpaperEnginePlugin()` scans emitted JavaScript and HTML for direct calls to `wallpaperRegisterAudioListener` and enables the flag automatically.

Automatic detection can miss indirect or transformed usage, such as storing the registration function in another variable before calling it. It may also find a call that is not part of the active wallpaper path. Override deliberately:

```ts
wallpaperEnginePlugin({
  title: 'Audio wallpaper',
  supportsAudioProcessing: true,
});
```

Set `supportsAudioProcessing: false` only when audio support must be disabled even if a call appears in output. A defined option wins over bundle-call detection.

## Simulator modes

The Audio tab sends development frames at approximately 30 Hz. These generators are simulator behavior, not a model of Wallpaper Engine's real FFT output.

| Control label | Internal mode | Development signal |
| --- | --- | --- |
| Off | `off` | Stops the timer and clears the displayed last frame |
| Silence | `silence` | 128 zeros |
| Noise | `random` | Random spectrum with exponential high-frequency decay |
| Sweep | `sine` | Matching left/right sinusoidal sweep |
| Bass pulse | `bass` | Matching left/right low-frequency pulse and harmonic |
| Stereo pan | `stereo` | Energy moves between left and right channels |

The tab displays the current spectrum and listener status. “Off” means no callbacks; “Silence” still delivers callbacks containing zeroes. Use both to test timeout and quiet-signal behavior separately.

:::note[Simulator cadence]
The simulator timer uses `1000 / 30` ms. Browsers may throttle background tabs. Wallpaper Engine owns production cadence and values.
:::

See Wallpaper Engine's official [audio visualizer documentation](https://docs.wallpaperengine.io/en/web/audio/visualizer.html) for host behavior.

## Source

Ambient audio registration is declared in [`src/types/window.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/window.ts), helpers in [`src/helpers.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/helpers.ts), and simulator generators in [`packages/devtools/src/audio.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/devtools/src/audio.ts).

## Next steps

Use [Media](../media/) for playback metadata and [Development Simulation](../../devtools/simulation/) for the complete host simulator surface.
