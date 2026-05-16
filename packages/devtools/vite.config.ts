import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

/**
 * Rollup plugin: take any emitted `.css` asset, remove it from the bundle,
 * and expose its contents as `globalThis.__WE_DEVTOOLS_CSS__` at the top of
 * the entry chunk so `main.ts` can inject it into the Shadow DOM root.
 */
function inlineCss(): Plugin {
  return {
    name: "we-inline-css",
    enforce: "post",
    apply: "build",
    generateBundle(_, bundle) {
      let css = "";
      for (const [name, asset] of Object.entries(bundle)) {
        if (asset.type === "asset" && name.endsWith(".css")) {
          css +=
            typeof asset.source === "string"
              ? asset.source
              : Buffer.from(asset.source).toString("utf8");
          delete bundle[name];
        }
      }
      if (!css) return;
      const prelude =
        "globalThis.__WE_DEVTOOLS_CSS__=" + JSON.stringify(css) + ";\n";
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.isEntry) {
          chunk.code = prelude + chunk.code;
        }
      }
    },
  };
}

/**
 * Builds the Vue 3 devtools UI into a single self-contained ES module at
 * `dist/client.js`. The `wallpaper-engine` package copies this artifact into
 * its own dist at build time; the Vite plugin reads it at dev-server load
 * time and injects it into the consumer's index.html.
 *
 * Vue is bundled (not externalized) so consumers don't need Vue installed.
 */
export default defineConfig({
  plugins: [vue(), tailwindcss(), inlineCss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    __VUE_OPTIONS_API__: "false",
    __VUE_PROD_DEVTOOLS__: "false",
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
  },
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    minify: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL("./src/main.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "client.js",
    },
  },
});
