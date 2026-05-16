import type {
  WallpaperLocalization,
  WallpaperPropertyDefinition,
} from "../../wallpaper-engine/src/types/project";

export interface DevtoolsConfig {
  properties: Record<string, WallpaperPropertyDefinition>;
  localization: WallpaperLocalization;
}

declare global {
  interface Window {
    __WE_DEVTOOLS_CONFIG__?: DevtoolsConfig;
  }
}

export const cfg: DevtoolsConfig = globalThis.window.__WE_DEVTOOLS_CONFIG__ ?? {
  properties: {},
  localization: {},
};

export const propDefs = cfg.properties;

/** Translate a `ui_*` key via the first available locale, else return as-is. */
export function tr(text: string): string {
  if (!text.startsWith("ui_")) return text;
  for (const locale of Object.values(cfg.localization)) {
    const v = locale[text];
    if (v) return v;
  }
  return text;
}
