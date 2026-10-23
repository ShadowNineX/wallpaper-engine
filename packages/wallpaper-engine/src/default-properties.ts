import type { DefaultWEPropertyDefinitions } from './types/default-properties';

/**
 * Default definitions for Wallpaper Engine's built-in properties, usable in
 * browser code without importing the Vite plugin. These are fallback values;
 * saved host settings and the configured scheme color can override them.
 * `audioprocessing` defaults to enabled for audio-capable wallpapers.
 * Font Awesome label metadata is preserved in `icon`. The `_d0` separator has
 * no `value`; guard with `'value' in property` when collecting defaults.
 *
 * @example
 * import { DefaultWEProps } from 'wallpaper-engine/helpers';
 * let brightness = DefaultWEProps.wec_brs.value; // 50
 */
export const DefaultWEProps: Required<DefaultWEPropertyDefinitions> = {
  audioprocessing: {
    type: 'bool',
    order: -21,
    text: 'ui_browse_properties_audio_recording',
    icon: 'fa-microphone',
    value: true,
  },
  schemecolor: {
    type: 'color',
    order: -20,
    icon: 'fa-palette',
    text: 'ui_browse_properties_scheme_color',
    value: '0.5 0.5 0.5',
  },
  alignmentfliph: {
    type: 'bool',
    icon: 'fa-exchange',
    order: -12,
    text: 'ui_browse_properties_alignment_flip_horizontally',
    value: false,
  },
  wec_e: {
    type: 'bool',
    order: -8,
    text: 'ui_browse_properties_show_color_options',
    value: false,
  },
  wec_brs: {
    type: 'slider',
    icon: 'fa-sun',
    condition: 'wec_e.value',
    min: 0,
    max: 100,
    order: -7,
    text: 'ui_browse_properties_brightness',
    value: 50,
  },
  wec_con: {
    type: 'slider',
    icon: 'fa-adjust',
    condition: 'wec_e.value',
    min: 0,
    max: 100,
    order: -6,
    text: 'ui_browse_properties_contrast',
    value: 50,
  },
  wec_sa: {
    type: 'slider',
    icon: 'fa-tint',
    condition: 'wec_e.value',
    min: 0,
    max: 100,
    order: -5,
    text: 'ui_browse_properties_saturation',
    value: 50,
  },
  wec_hue: {
    type: 'slider',
    icon: 'fa-palette',
    condition: 'wec_e.value',
    min: 0,
    max: 100,
    order: -4,
    text: 'ui_browse_properties_hue_shift',
    value: 50,
  },
  _d0: {
    type: 'divider',
    order: 0,
  },
};
