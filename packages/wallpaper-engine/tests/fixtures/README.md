# Native web-property fixture

`native-web-properties.json` records the eight built-in value-bearing property
definitions and the `_d0` divider received by an isolated Wallpaper Engine
**2.8.42** web preview on
2026-10-22. The project enabled audio processing, supplied no scheme color, and
registered `wallpaperPropertyListener` at module scope. The values came from the
native CEF callback, rather than being generated from `DefaultWEProps` or the
simulator. The `_d0` descriptor is `{ "order": 0, "type": "divider" }`, with no
label or editable value. Font Awesome label classes are supplied through `icon`;
the native callback has no separate font metadata fields. Other layout
descriptors are covered separately by `runtime-properties.test.ts`.

Read-only IDA verification on 2026-10-23 confirmed divider construction in
`wallpaper64.exe` at `0x14010C650`. The loaded executable matched the installed
file (SHA-256
`40e2ce021e9352324fadb3b8f72b8ba2a7ee95b71cc571d5b9f84be75cd993b0`).
The web callback, rather than the constructor's type-dependent order branch,
is the evidence for this fixture's divider order `0`.

To refresh the fixture, build a temporary web project with those options and
capture its initial `applyUserProperties` payload. Use the official
[`openWallpaper -playInWindow` CLI](https://help.wallpaperengine.io/en/functionality/cli.html)
with a unique preview name; close that exact location afterward. Copy only the
built-in property definitions, excluding user preferences and media metadata.
Record the installed host version and inspect differences before updating.

The same native review verified partial property delivery, startup plugin
readiness, audio frames, media playback mapping, and image loading from both an
encoded file-property value and a raw on-demand directory callback. The image
filename contained spaces, `#`, literal `%20`, and Unicode. Physical RGB hardware
and media timeline delivery were not qualified by those previews.
