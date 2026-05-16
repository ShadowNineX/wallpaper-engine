import { createApp } from "vue";
import App from "./App.vue";
import { installGlobals } from "./globals";
import "./style.css";

declare global {
  // Populated at build time by the `we-inline-css` Rollup plugin.
  // In dev (when Vite handles CSS injection itself) this stays undefined
  // and we just rely on the document-level `<style>` tags Vite injects.
  // eslint-disable-next-line no-var
  var __WE_DEVTOOLS_CSS__: string | undefined;
}

installGlobals();

const host = document.createElement("div");
host.id = "we-devtools-root";
const shadow = host.attachShadow({ mode: "open" });

if (globalThis.__WE_DEVTOOLS_CSS__) {
  const style = document.createElement("style");
  style.textContent = globalThis.__WE_DEVTOOLS_CSS__;
  shadow.appendChild(style);
}

const mount = document.createElement("div");
mount.className = "dark";
shadow.appendChild(mount);
document.body.appendChild(host);

createApp(App).mount(mount);
