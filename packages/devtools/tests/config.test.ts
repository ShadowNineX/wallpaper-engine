import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
  vi.resetModules();
});

describe('devtools config', () => {
  it('uses empty defaults when the plugin did not inject config', async () => {
    delete window.__WE_DEVTOOLS_CONFIG__;

    const { cfg, propDefs, tr } = await import('../src/config');

    expect(cfg).toEqual({ properties: {}, localization: {} });
    expect(propDefs).toEqual({});
    expect(tr('ui_missing')).toBe('ui_missing');
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
