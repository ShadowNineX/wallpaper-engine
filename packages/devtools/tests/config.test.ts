import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
  vi.resetModules();
});

describe('devtools config', () => {
  it('provides built-in defaults when the plugin did not inject config', async () => {
    delete window.__WE_DEVTOOLS_CONFIG__;

    const { cfg, propDefs, tr } = await import('../src/config');

    expect(cfg).toEqual({ properties: {}, localization: {} });
    expect(propDefs.schemecolor).toHaveProperty('value', '0.5 0.5 0.5');
    expect(propDefs.audioprocessing).toHaveProperty('value', true);
    expect(propDefs.wec_brs).toHaveProperty('value', 50);
    expect(tr('ui_browse_properties_brightness')).toBe('Brightness');
    expect(tr('ui_browse_properties_audio_recording')).toBe('Audio recording');
    expect(tr('ui_missing')).toBe('ui_missing');
  });

  it('omits the audio property when audio support is disabled', async () => {
    window.__WE_DEVTOOLS_CONFIG__ = {
      properties: {},
      localization: {},
      supportsAudioProcessing: false,
    };
    const { propDefs } = await import('../src/config');
    expect(propDefs).not.toHaveProperty('audioprocessing');
    expect(propDefs.schemecolor).toHaveProperty('value', '0.5 0.5 0.5');
  });

  it('preserves explicit built-in definitions and label translations', async () => {
    window.__WE_DEVTOOLS_CONFIG__ = {
      properties: { schemecolor: { type: 'color', text: 'My scheme', value: '1 0 0' } },
      localization: { 'de-de': { ui_browse_properties_brightness: 'Helligkeit' } },
    };
    const { propDefs, tr } = await import('../src/config');
    expect(propDefs.schemecolor).toEqual({ type: 'color', text: 'My scheme', value: '1 0 0' });
    expect(tr('ui_browse_properties_brightness')).toBe('Helligkeit');
  });

  it('normalizes custom native orders without mutating injected configuration', async () => {
    window.__WE_DEVTOOLS_CONFIG__ = {
      properties: {
        negative: { type: 'bool', text: 'Negative', value: true, order: -50 },
        positive: { type: 'bool', text: 'Positive', value: true, order: 5 },
        implicit: { type: 'bool', text: 'Implicit', value: true },
        separator: { type: 'divider' },
        layout: { type: 'group', text: 'Layout', value: '' },
        audioprocessing: { type: 'bool', text: 'Audio', value: false, order: -1 },
      },
      localization: {},
    };

    const { cfg, propDefs } = await import('../src/config');

    expect(propDefs.negative?.order).toBe(50);
    expect(propDefs.positive?.order).toBe(105);
    expect(propDefs.implicit?.order).toBe(102);
    expect(propDefs.separator?.order).toBe(103);
    expect(propDefs.layout?.order).toBe(104);
    expect(propDefs.audioprocessing).toEqual({ type: 'bool', text: 'Audio', value: false, order: -1 });
    expect(cfg.properties.implicit?.order).toBeUndefined();
    expect(cfg.properties.separator?.order).toBeUndefined();
  });

  it('reads injected properties and translates UI tokens from the first matching locale', async () => {
    window.__WE_DEVTOOLS_CONFIG__ = {
      title: 'Test wallpaper',
      properties: {
        mode: {
          type: 'combo',
          text: 'ui_mode',
          value: 'bars',
          options: [{ label: 'ui_bars', value: 'bars' }],
        },
      },
      localization: {
        'en-us': { ui_mode: 'Mode', ui_bars: 'Bars' },
        'de-de': { ui_mode: 'Modus', ui_bars: 'Balken' },
      },
    };

    const { cfg, propDefs, tr } = await import('../src/config');

    expect(cfg.title).toBe('Test wallpaper');
    expect(propDefs.mode?.type).toBe('combo');
    expect(tr('ui_mode')).toBe('Mode');
    expect(tr('plain text')).toBe('plain text');
  });
});
