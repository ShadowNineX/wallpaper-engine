# Wallpaper Engine Devtools

Wallpaper Engine Devtools is a development-only simulator for web wallpapers. It lets wallpaper authors exercise user properties, runtime state, audio input, media integration, and page performance without repeatedly launching Wallpaper Engine.

The host adapter stays inside the wallpaper document so Wallpaper Engine-compatible globals and browser-owned resources remain synchronous and local. A docked or separate-window frontend controls that host through a schema-validated bridge.

The primary user is a wallpaper author who keeps the panel open while iterating. They need dense, dependable controls, immediate listener and connection feedback, keyboard access, and measurements that clearly distinguish simulated state from observed browser data.

The interface must work in a narrow right dock, a wide bottom dock, and a separate window. It uses Nuxt UI as its component system and keeps the published `wallpaper-engine` package free of runtime dependencies.

## Documentation

The Astro/Starlight site teaches wallpaper authors through complete examples,
typed host contracts, and practical build workflows. Readers should be able to
try a visual result, copy its files, and understand how the host callbacks drive
it. The documentation preserves search, navigation, light and dark themes, and
copyable source while using interactive previews and shorter lessons to make
learning more inviting.
