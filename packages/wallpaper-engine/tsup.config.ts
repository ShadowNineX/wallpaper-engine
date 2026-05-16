import { defineConfig } from "tsup";
import { cp, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DEVTOOLS_CLIENT = fileURLToPath(
  new URL("../devtools/dist/client.js", import.meta.url),
);

export default defineConfig([
  // Browser-consumable entries get both ESM + CJS.
  {
    entry: ["src/index.ts", "src/helpers.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  // The Vite plugin is ESM-only — it uses `import.meta.url` to locate the
  // bundled devtools client. Modern Vite loads plugins as ESM regardless.
  {
    entry: { "plugin/index": "src/plugin/index.ts" },
    format: ["esm"],
    dts: true,
    clean: false,
    sourcemap: true,
    async onSuccess() {
      try {
        await access(DEVTOOLS_CLIENT);
      } catch {
        throw new Error(
          `Devtools client not found at ${DEVTOOLS_CLIENT}. Run \`bun run build:devtools\` from the repo root first.`,
        );
      }
      await mkdir("dist/plugin/devtools", { recursive: true });
      await cp(DEVTOOLS_CLIENT, "dist/plugin/devtools/client.js");
    },
  },
]);
