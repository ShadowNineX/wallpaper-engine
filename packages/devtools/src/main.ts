import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { installGlobals } from './globals';
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
const FONT_STYLE_ID = 'we-devtools-fonts';

function installDocumentFonts(css: string): void {
  // Chromium does not register @font-face rules from a shadow-root stylesheet
  // in the document FontFaceSet. Hoist only those rules; all UI styles remain
  // isolated inside the shadow root.
  const fontFaces = css.match(/@font-face\s*\{[^{}]*\}/g);
  if (!fontFaces?.length)
    return;

  let style = document.getElementById(FONT_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = FONT_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = fontFaces.join('\n');
}

installGlobals();

let mount: HTMLElement;

if (globalThis.__WE_DEVTOOLS_CSS__) {
  installDocumentFonts(globalThis.__WE_DEVTOOLS_CSS__);
  // Production: mount inside a Shadow DOM with inlined CSS.
  const host = document.createElement('div');
  host.id = 'we-devtools-root';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = globalThis.__WE_DEVTOOLS_CSS__;
  shadow.appendChild(style);

  mount = document.createElement('div');
  mount.className = 'dark';
  shadow.appendChild(mount);
  document.body.appendChild(host);
}
else {
  // Dev mode: mount directly so Vite's injected <style> tags apply.
  document.documentElement.classList.add('dark');
  mount = document.createElement('div');
  mount.id = 'we-devtools-root';
  mount.className = 'dark';
  document.body.appendChild(mount);
}

const app = createApp(App);
app.use(createPinia());
app.mount(mount);
