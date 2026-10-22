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
    expect(propDefs.schemecolor?.value).toBe('0 0 0');
    expect(propDefs.audioprocessing?.value).toBe(true);
    expect(propDefs.wec_brs?.value).toBe(50);
    expect(tr('ui_browse_properties_brightness')).toBe('Brightness');
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
    expect(propDefs.schemecolor?.value).toBe('0 0 0');
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
