import { templateCompilerOptions } from "@tresjs/core";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { wallpaperEnginePlugin } from "wallpaper-engine/plugin";
import { properties } from "./src/wallpaper.ts";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    vue({
      ...templateCompilerOptions,
    }),
    wallpaperEnginePlugin({
      title: "Aether // Reactive Desktop",
      metadataFile: "metadata.json",
      projectLink: {
        name: "aether-reactive-desktop",
      },
      schemeColor: "#5994ff",
      properties,
    }),
  ],
});
