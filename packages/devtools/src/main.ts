import { startRuntime } from './runtime';
import 'unfonts.css';
import './style.css';

declare global {
  // Populated at build time by the `we-inline-css` Rollup plugin.
  // In dev (when Vite handles CSS injection itself) this stays undefined
  // and we just rely on the document-level `<style>` tags Vite injects.

  // Global augmentation requires `var`; it is not an executable declaration.
  // eslint-disable-next-line vars-on-top
  var __WE_DEVTOOLS_CSS__: string | undefined;
}
// Host installation stays synchronous: wallpaper modules may register at once.
let dispose: (() => void) | undefined;
let stopped = false;
if (window.__WE_DEVTOOLS_ROLE__ === 'runtime') {
  dispose = startRuntime();
}
else {
  void import('./bridge/frontend').then(({ startFrontend, startStandalone }) => {
    if (!stopped) {
      dispose = window.__WE_DEVTOOLS_ROLE__ === 'frontend'
        ? startFrontend(globalThis.__WE_DEVTOOLS_CSS__)
        : startStandalone(globalThis.__WE_DEVTOOLS_CSS__);
    }
  });
}
import.meta.hot?.dispose(() => {
  stopped = true;
  dispose?.();
});
