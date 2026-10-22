import type {
  WallpaperLocalization,
  WallpaperPropertyDefinition,
} from '../../wallpaper-engine/src/types/project';
import { DefaultWEProps } from '../../wallpaper-engine/src/default-properties';

export interface DevtoolsConfig {
  title?: string;
  supportsAudioProcessing?: boolean;
  properties: Record<string, WallpaperPropertyDefinition>;
  localization: WallpaperLocalization;
}

declare global {
  interface Window {
    __WE_DEVTOOLS_CONFIG__?: DevtoolsConfig;
    __WE_DEVTOOLS_ROLE__?: 'runtime' | 'frontend';
    __WE_DEVTOOLS_FRONTEND_URL__?: string;
  }
}

export const cfg: DevtoolsConfig = globalThis.window.__WE_DEVTOOLS_CONFIG__ ?? {
  properties: {},
  localization: {},
};

const { audioprocessing, ...defaultProperties } = DefaultWEProps;
export const propDefs: Record<string, WallpaperPropertyDefinition> = {
  ...defaultProperties,
  ...(cfg.supportsAudioProcessing !== false ? { audioprocessing } : {}),
  ...cfg.properties,
};

const defaultLabels: Record<string, string> = {
  ui_browse_properties_audioprocessing: 'Audio recording',
  ui_browse_properties_scheme_color: 'Scheme color',
  ui_browse_properties_alignment_flip_horizontally: 'Flip',
  ui_browse_properties_show_color_options: 'Show color options',
  ui_browse_properties_brightness: 'Brightness',
  ui_browse_properties_contrast: 'Contrast',
  ui_browse_properties_saturation: 'Saturation',
  ui_browse_properties_hue_shift: 'Hue shift',
};

/** Translate a `ui_*` key via configured locales, built-in labels, or the key itself. */
export function tr(text: string): string {
  if (!text.startsWith('ui_'))
    return text;
  for (const locale of Object.values(cfg.localization)) {
    const v = locale[text];
    if (v)
      return v;
  }
  return defaultLabels[text] ?? text;
}
