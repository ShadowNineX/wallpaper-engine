import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/plugin/index.ts", "src/helpers.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
});
