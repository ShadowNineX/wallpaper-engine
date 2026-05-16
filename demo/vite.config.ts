import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { wallpaperEnginePlugin } from "wallpaper-engine/plugin";
import { properties } from "./src/wallpaper";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    vue(),
    wallpaperEnginePlugin({
      title: "Example Wallpaper",
      supportsAudioProcessing: false,
      properties,
    }),
  ],
});
