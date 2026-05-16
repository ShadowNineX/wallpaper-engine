import { createApp } from "vue";
import { createPinia } from "pinia";
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

let mount: HTMLElement;

if (globalThis.__WE_DEVTOOLS_CSS__) {
  // Production: mount inside a Shadow DOM with inlined CSS.
  const host = document.createElement("div");
  host.id = "we-devtools-root";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = globalThis.__WE_DEVTOOLS_CSS__;
  shadow.appendChild(style);

  mount = document.createElement("div");
  mount.className = "dark";
  shadow.appendChild(mount);
  document.body.appendChild(host);
} else {
  // Dev mode: mount directly so Vite's injected <style> tags apply.
  document.documentElement.classList.add("dark");
  mount = document.createElement("div");
  mount.id = "we-devtools-root";
  mount.className = "dark";
  document.body.appendChild(mount);
}

const app = createApp(App);
app.use(createPinia());
app.mount(mount);
