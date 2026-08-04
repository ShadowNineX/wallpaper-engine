import { templateCompilerOptions } from "@tresjs/core";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { wallpaperEnginePlugin } from "wallpaper-engine/plugin";
import { properties } from "./src/wallpaper.ts";

const workshopDescription = `[h1]Aether // Reactive Desktop[/h1]

Aether is the official test and showcase wallpaper for the open-source [b]wallpaper-engine[/b] TypeScript
project. It demonstrates the project’s typed host APIs, Vite plugin, property system, runtime helpers, media
integration, and development simulator in a complete Wallpaper Engine web wallpaper.

Source code and project documentation:
[url=https://github.com/ShadowNineX/wallpaper-engine]github.com/ShadowNineX/wallpaper-engine[/url]

[h2]About the Wallpaper[/h2]

A calm, futuristic desktop centered around an audio-reactive crystalline monolith, layered aurora ribbons,
drifting particles, and a deep atmospheric starfield.

Music brings the scene to life: bass moves the surrounding ribbons and strengthens the crystal’s glow,
midrange reveals its internal facets and reflections, and treble energizes the fine light threads and stars.
The response is smoothly damped for visible movement without frantic rotation or harsh percussion flashes.

[h2]Features[/h2]

[list]
[*][b]Audio-reactive crystal scene[/b] with separate bass, midrange, and treble responses
[*][b]Three visualizer styles:[/b] Silk Wave, Prism Bars, and Halo Ring
[*][b]Now-playing display[/b] with track information, timeline, and animated album artwork
[*][b]Artwork-derived colors[/b] that can automatically tint the wallpaper
[*][b]Custom backgrounds[/b] using an image, video, random directory, or timed gallery
[*][b]Customizable appearance[/b] with background, accent, and secondary glow colors
[*][b]Adjustable audio sensitivity, animation speed, and particle density[/b]
[*][b]12-hour or 24-hour clock[/b] with optional seconds
[*][b]Responsive layout[/b] for 16:9, ultrawide, 4K, portrait, and smaller displays
[*]Automatically respects Wallpaper Engine playback pausing
[/list]

[h2]Recommended Setup[/h2]

For the full effect, make sure audio recording is enabled in Wallpaper Engine. Start with the default [b]Silk
Wave[/b] visualizer and adjust [b]Audio sensitivity[/b] until the crystal and aurora respond comfortably to
your system volume.

The audio visualizer, clock, media display, and album-art color sampling can each be disabled independently.

[h2]Background Options[/h2]

Choose the generated Aether atmosphere or personalize the wallpaper with:

[list]
[*]A custom image
[*]A custom video
[*]A randomly selected image or video directory
[*]A rotating image or video gallery with an adjustable interval
[/list]

This wallpaper is primarily maintained as a real-world integration test and example for the project, but it is
also designed to work as a polished everyday desktop.

Issues, feedback, and contributions are welcome on GitHub:
[url=https://github.com/ShadowNineX/wallpaper-engine]ShadowNineX/wallpaper-engine[/url]`;

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    vue({
      ...templateCompilerOptions,
    }),
    wallpaperEnginePlugin({
      title: "Aether // Reactive Desktop",
      projectLink: {
        name: "aether-reactive-desktop",
      },
      metadata: {
        contentrating: "Everyone",
        description: workshopDescription,
        preview: "preview.jpg",
        ratingsex: "none",
        ratingviolence: "none",
        tags: ["Abstract"],
      },
      schemeColor: "#5994ff",
      properties,
    }),
  ],
});
