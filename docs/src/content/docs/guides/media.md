---
title: Media
description: Consume media status, metadata, artwork, playback, and timeline events using host-defined playback constants.
---

Wallpaper Engine exposes five independent media streams. Register every stream your wallpaper needs at module scope so startup state is not missed.

## Event inventory

| Registration function | Event fields | Meaning |
| --- | --- | --- |
| `wallpaperRegisterMediaStatusListener` | `enabled: boolean` | Whether media integration is enabled in Wallpaper Engine settings |
| `wallpaperRegisterMediaPropertiesListener` | `title`, `artist`, optional `subTitle`, `albumTitle`, `albumArtist`, `genres`, and `contentType` | Current media metadata; `contentType` is `music`, `video`, or `image` |
| `wallpaperRegisterMediaThumbnailListener` | `thumbnail`, `primaryColor`, `secondaryColor`, `tertiaryColor`, `textColor`, `highContrastColor` | Base64 PNG artwork and host-supplied palette strings |
| `wallpaperRegisterMediaPlaybackListener` | `state` | Host-defined numeric playback state |
| `wallpaperRegisterMediaTimelineListener` | `position`, `duration` | Current position and total duration in seconds |

Not every media player supplies timeline events. Keep the UI valid when the timeline callback never runs.

## Compare playback through host constants

Playback integers are defined by Wallpaper Engine at runtime. Never hard-code `0`, `1`, or another guessed value.

```ts
window.wallpaperRegisterMediaPlaybackListener((event) => {
  if (
    event.state === window.wallpaperMediaIntegration.PLAYBACK_PLAYING
  ) {
    resumeMediaAnimation();
  }
});
```

Or normalize them through the helper:

```ts
import { getMediaPlaybackStatus } from 'wallpaper-engine/helpers';

window.wallpaperRegisterMediaPlaybackListener((event) => {
  const status = getMediaPlaybackStatus(event.state);
  setPlaybackStatus(status); // 'playing' | 'paused' | 'stopped'
});
```

`getMediaPlaybackStatus()` compares against the host's `PLAYBACK_PLAYING` and `PLAYBACK_PAUSED` constants. Any other state resolves to `stopped`.

## Build one media state flow

Keep streams independent but merge them into one application-owned state object:

```ts
import type {
  WallpaperMediaPlaybackState,
  WallpaperMediaPropertiesEvent,
  WallpaperMediaThumbnailEvent,
} from 'wallpaper-engine';

interface MediaState {
  enabled: boolean;
  properties?: WallpaperMediaPropertiesEvent;
  artwork?: WallpaperMediaThumbnailEvent;
  playback: WallpaperMediaPlaybackState;
  position: number;
  duration: number;
}

const media: MediaState = {
  enabled: false,
  playback: window.wallpaperMediaIntegration.PLAYBACK_STOPPED,
  position: 0,
  duration: 0,
};

window.wallpaperRegisterMediaStatusListener((event) => {
  media.enabled = event.enabled;
  if (event.enabled)
    return;
  media.properties = undefined;
  media.artwork = undefined;
  media.playback = window.wallpaperMediaIntegration.PLAYBACK_STOPPED;
  media.position = 0;
  media.duration = 0;
});

window.wallpaperRegisterMediaPropertiesListener((event) => {
  media.properties = event;
});

window.wallpaperRegisterMediaThumbnailListener((event) => {
  media.artwork = event;
  cover.src = event.thumbnail;
});

window.wallpaperRegisterMediaPlaybackListener((event) => {
  media.playback = event.state;
});

window.wallpaperRegisterMediaTimelineListener((event) => {
  media.position = Math.max(0, event.position);
  media.duration = Math.max(0, event.duration);
});
```

```text
status ───────────────→ enable/clear media state
metadata ─────────────→ title, artist, album, genres, content type
thumbnail + palette ──→ artwork and theme colors
playback ─────────────→ playing/paused/stopped UI
optional timeline ────→ progress UI
```

Events can arrive independently. Do not require metadata to arrive before artwork or playback state.

## Thumbnail and palette fields

`thumbnail` is a base64-encoded PNG suitable for direct assignment to `img.src`. The remaining strings are colors selected by the host:

- `primaryColor`: dominant artwork color.
- `secondaryColor` and `tertiaryColor`: additional palette colors.
- `textColor`: a color intended to contrast with `primaryColor`; it may reuse a palette color.
- `highContrastColor`: black or white, whichever contrasts more with `primaryColor`.

Validate or provide application fallbacks before using any external color in custom rendering.

## Host contracts versus simulator behavior

| Concern | Wallpaper Engine contract | Development simulator |
| --- | --- | --- |
| Status and metadata | Supplied by the active system media session | Controls cover title, artist, album title, and content type; `subTitle`, `albumArtist`, and `genres` are not currently simulated |
| Playback constants | Supplied on `wallpaperMediaIntegration` | Compatible simulator constants |
| Artwork | Base64 PNG from media integration | A locally selected image is decoded and converted to PNG |
| Palette | Host-selected thumbnail colors | Colors are derived from selected artwork and exposed for editing/testing |
| Timeline cadence/support | Player dependent; may be absent | Controlled synthetic state for development |
| Listener replay | Do not assume ordering beyond host documentation | Current simulator state may replay when listeners register |

Simulator artwork remains local to the browser. Its image conversion and palette extraction are development conveniences, not promises about Wallpaper Engine's palette algorithm.

See Wallpaper Engine's official [media integration documentation](https://docs.wallpaperengine.io/en/web/audio/media.html) for host behavior.

## Source

Event types live in [`src/types/listeners.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/listeners.ts), ambient registration functions in [`src/types/window.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/types/window.ts), and normalization in [`src/helpers.ts`](https://github.com/ShadowNineX/wallpaper-engine/blob/main/packages/wallpaper-engine/src/helpers.ts).

## Next steps

Test each stream in [Development Simulation](../../devtools/simulation/) and use [Colors & Media](../../helpers/colors-and-media/) when extracting colors from application-owned images.
