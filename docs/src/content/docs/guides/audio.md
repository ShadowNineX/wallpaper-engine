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

## Analyze one frame

`analyzeAudioFrame()` accepts any `ArrayLike<number>` containing exactly 128
samples and returns a fresh metrics object without changing the input:

```ts
import { analyzeAudioFrame } from 'wallpaper-engine/helpers';

window.wallpaperRegisterAudioListener((samples) => {
  const frame = analyzeAudioFrame(samples);
  levelMeter.value = frame.rmsVolume;
  balanceMeter.value = frame.stereoBalance;
});
```

Every sample follows `clampAudio()` semantics before analysis: finite values
are clamped to 0–1, while negative and non-finite values become `0`. Every
other frame length throws
`RangeError('Wallpaper Engine audio frames must contain exactly 128 samples.')`.

| Metric | Meaning |
| --- | --- |
| `averageVolume` | Arithmetic mean of all 128 clamped magnitudes |
| `rmsVolume` | Root-mean-square magnitude; useful as the current signal level |
| `peakVolume` | Largest current clamped magnitude |
| `leftVolume` / `rightVolume` | Arithmetic mean of each 64-bin channel |
| `stereoBalance` | `-1` for left-only, `0` for equal or silent, `1` for right-only |
| `bass` | Mean stereo-combined magnitude across bins 0–5 |
| `midrange` | Mean stereo-combined magnitude across bins 6–23 |
| `treble` | Mean stereo-combined magnitude across bins 24–63 |

The region names describe positions in Wallpaper Engine's ordered spectrum.
They are not fixed-Hz frequency ranges. Corresponding left/right values are
averaged before each region mean is calculated.

## Detect loudness envelopes and transients

Create one analyzer at module scope and reuse it for every callback:

```ts
import { createAudioAnalyzer } from 'wallpaper-engine/helpers';

const analyzer = createAudioAnalyzer({
  sensitivity: 0.65,
  eventCooldown: 0.13,
  peakDecayPerSecond: 1.5,
});
let previousAudioTime: number | undefined;

window.wallpaperRegisterAudioListener((samples) => {
  const now = performance.now();
  const deltaSeconds = previousAudioTime === undefined
    ? undefined
    : (now - previousAudioTime) / 1_000;
  previousAudioTime = now;

  analyzer.process(samples, deltaSeconds);
  renderLevel(analyzer.rmsVolume, analyzer.decayingPeakVolume);

  if (analyzer.beat > 0)
    pulse(analyzer.beat);
  if (analyzer.hiHat > 0)
    shimmer(analyzer.hiHat);
});
```

The analyzer exposes every current frame metric from `analyzeAudioFrame()`.
It also exposes:

| Field | Meaning |
| --- | --- |
| `decayingPeakVolume` | Current peak held and linearly decayed over time |
| `kick` | Estimated low-spectrum transient strength from 0–1 |
| `clap` | Estimated balanced mid/high-spectrum transient strength from 0–1 |
| `hiHat` | Estimated high-dominant transient strength from 0–1 |
| `beat` | `max(kick, clap)` |
| `bpm` | Smoothed onset-envelope autocorrelation estimate, or `0` until detected |
| `onset` | Strongest active spectrum-band transient, including unclassified events |

`kick`, `clap`, `hiHat`, `beat`, and `onset` describe only the latest
`process()` call. A steady or falling spectrum does not retrigger because
detection uses only positive spectral change. Each band has its own adaptive
baseline and cooldown. Kick may coexist with clap; clap and hi-hat are
mutually exclusive.

`bpm` is persistent rather than a current-call event. The analyzer records a
continuous positive log-spectral-flux onset envelope with an adaptive local
baseline at Wallpaper Engine's nominal 30 Hz callback cadence. Once four
seconds of history are available, it scores 40–240 BPM candidates against
fractional autocorrelation lags spanning one through four beats. Analysis
continues across a rolling eight-second window. Long-range lags preserve
bar-level structure; a broad tempo prior and evidence at the faster octave
resolve common meter ambiguities.

The first estimate requires three consecutive analysis passes to agree, so
regular material normally resolves about five seconds after callbacks begin.
Once acquired, the last accepted BPM remains visible through low-confidence
non-silent passages; a substantially different tempo must remain both strong
and consistent before replacing it. This prevents marginal windows from
alternating between a number and `0`. The value returns to `0` after four
seconds without a significant onset or when `reset()` is called.

This follows the same log-spectral-flux → periodicity approach used by
[librosa's tempo estimator](https://librosa.org/doc/latest/generated/librosa.feature.tempo.html),
the [Percival BPM estimator](https://essentia.upf.edu/reference/streaming_PercivalBpmEstimator.html),
and the method described by
[Alonso, David, and Richard](https://www.ee.columbia.edu/~dpwe/ismir2004/CRFILES/paper191.pdf).
It operates directly on Wallpaper Engine's magnitude spectra rather than raw
PCM, so it cannot perform source separation. Meter is intrinsically ambiguous,
so a steady pulse can still have musically valid half- or double-tempo readings.

The first three valid calls warm up the previous spectrum and adaptive
statistics. Loudness fields are usable during warm-up, but every event field
remains `0`. `reset()` clears all public metrics, spectra, baselines,
cooldowns, and events, then restarts that three-call warm-up.

### Options and timing

| Option | Default | Valid values |
| --- | --- | --- |
| `sensitivity` | `0.65` | Finite number from 0–1 |
| `eventCooldown` | `0.13` seconds | Finite non-negative number |
| `peakDecayPerSecond` | `1.5` | Finite non-negative number |

Invalid options throw a `RangeError` when the analyzer is created.
`process()` defaults `deltaSeconds` to `1 / 30`. An explicitly supplied delta
must be finite and non-negative or it throws `RangeError`. Large valid deltas
are not capped, so cooldown and peak decay advance across a real pause.

The factory allocates reusable internal spectra and detector state once.
`process()` and `reset()` allocate no arrays or result objects.
`analyzeAudioFrame()`, `clampAudio()`, `leftChannel()`, and `rightChannel()`
are convenience helpers that return new objects or arrays.

### What “volume” and instrument names mean

All level values are normalized magnitudes derived from the spectrum delivered
to `wallpaperRegisterAudioListener`. Wallpaper Engine's web API does not expose
the Windows master-volume setting or an individual media player's volume
slider. Kick, clap, and hi-hat are spectrum-based transient estimates, not
source separation or recognition of the original instrument.

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

When using `createAudioAnalyzer()`, call `analyzer.reset()` and set your
previous callback timestamp to `undefined` when pausing. This clears held
events and prevents the first resumed callback from inheriting stale timing.

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
| Track loop | `track` | Repeating kick, clap, hi-hat, and bass pattern |

The tab displays the current spectrum and listener status. “Off” means no callbacks; “Silence” still delivers callbacks containing zeroes. Use both to test timeout and quiet-signal behavior separately.

Generated sound modes expose an **Output** slider that scales the final frame without changing its frequency profile. Sweep, Bass pulse, and Stereo pan also expose rate controls. Track loop adds:

- **Tempo** — 60–180 BPM.
- **Continuous bass** — sustained low-frequency bed.
- **Kick** — low-frequency transient.
- **Clap** — mid-frequency transient.
- **Hi-hat** — high-frequency transient.

Set an instrument to `0%` to isolate the remaining track components, or raise it to `150%` to stress the matching spectrum region. These controls only tune the deterministic simulator; they do not predict the values or cadence produced by Wallpaper Engine.

:::note[Simulator cadence]
The simulator timer uses `1000 / 30` ms. Browsers may throttle background tabs. Wallpaper Engine owns production cadence and values.
:::

See Wallpaper Engine's official [audio visualizer documentation](https://docs.wallpaperengine.io/en/web/audio/visualizer.html) for host behavior.

## Source

Ambient audio registration is declared in [`src/types/window.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/window.ts), reusable analysis in [`src/audio/`](https://github.com/ShadowNineX/wallpaper-engine/tree/main/packages/wallpaper-engine/src/audio), convenience helpers in [`src/helpers.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/helpers.ts), and simulator generators in [`packages/devtools/src/audio.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/devtools/src/audio.ts).

## Next steps

Use [Media](../media/) for playback metadata and [Development Simulation](../../devtools/simulation/) for the complete host simulator surface.
