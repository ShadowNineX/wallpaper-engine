import { access, cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsdown';

const DEVTOOLS_CLIENT = fileURLToPath(
  new URL('../devtools/dist/client.js', import.meta.url),
);

// npm excludes nested node_modules from tarballs, even below an included dist.
// Keep bundled dependency modules inside the published package's vendor tree.
const esmOutput = {
  sanitizeFileName: (name: string) => name.replaceAll('\\', '/')
    .replaceAll('\0', '_')
    .replaceAll(':', '_')
    .replaceAll(/node_modules\/\.bun\/[^/]+\/node_modules\//g, 'vendor/')
    .replaceAll('node_modules/', 'vendor/'),
};

export default defineConfig([
  // Keep ESM module boundaries so a helper import can drop unrelated libraries.
  {
    entry: ['src/index.ts', 'src/helpers.ts'],
    format: ['esm'],
    unbundle: true,
    root: 'src',
    outputOptions: esmOutput,
    fixedExtension: false,
    dts: true,
    clean: true,
    sourcemap: true,
    deps: {
      alwaysBundle: ['colorjs.io', 'fast-average-color'],
      onlyBundle: false,
    },
  },
  // CommonJS consumers retain a self-contained bundle.
  {
    entry: ['src/index.ts', 'src/helpers.ts'],
    format: ['cjs'],
    fixedExtension: false,
    dts: true,
    clean: false,
    sourcemap: true,
    deps: {
      alwaysBundle: ['colorjs.io', 'fast-average-color'],
      onlyBundle: false,
    },
  },
  // The Vite plugin is ESM-only — it uses `import.meta.url` to locate the
  // bundled devtools client. Modern Vite loads plugins as ESM regardless.
  {
    entry: { 'plugin/index': 'src/plugin/index.ts' },
    format: ['esm'],
    unbundle: true,
    root: 'src',
    outputOptions: esmOutput,
    fixedExtension: false,
    dts: true,
    clean: false,
    sourcemap: true,
    deps: {
      alwaysBundle: ['colorjs.io'],
      onlyBundle: false,
    },
    hooks: {
      'build:done': async () => {
        try {
          await access(DEVTOOLS_CLIENT);
        }
        catch {
          throw new Error(
            `Devtools client not found at ${DEVTOOLS_CLIENT}. Run \`bun run build:devtools\` from the repo root first.`,
          );
        }
        await mkdir('dist/plugin/devtools', { recursive: true });
        await cp(DEVTOOLS_CLIENT, 'dist/plugin/devtools/client.js');
      },
    },
  },
]);
