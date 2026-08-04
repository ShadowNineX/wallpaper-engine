import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = {
    properties: {
      second: { type: 'textinput', text: 'Second', value: 'b', order: 2 },
      first: { type: 'bool', text: 'First', value: true, order: 1 },
    },
    localization: {},
  };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
});

describe('propertiesTab', () => {
  it('sorts properties by order and replays complete startup state', async () => {
    const [{ default: PropertiesTab }, { listenerFns }] = await Promise.all([
      import('../../src/tabs/PropertiesTab.vue'),
      import('../../src/store'),
    ]);
    const applyUserProperties = vi.fn();
    const applyGeneralProperties = vi.fn();
    const setPaused = vi.fn();
    listenerFns.property = {
      applyUserProperties,
      applyGeneralProperties,
      setPaused,
    };
    const wrapper = mount(PropertiesTab);

    expect(wrapper.findAll('article').map(card => card.text())).toEqual([
      expect.stringContaining('First'),
      expect.stringContaining('Second'),
    ]);
    await wrapper
      .findAll('button')
      .find(button => button.text().includes('Replay all'))
      ?.trigger('click');

    expect(applyUserProperties).toHaveBeenCalledWith({
      first: { value: true },
      second: { value: 'b' },
    });
    expect(applyGeneralProperties).toHaveBeenCalledWith({ fps: 60 });
    expect(setPaused).toHaveBeenCalledWith(false);
  });

  it('restores edited controls to their configured defaults', async () => {
    const [
      { default: PropertiesTab },
      { listenerFns, useDevtoolsStore },
    ] = await Promise.all([
      import('../../src/tabs/PropertiesTab.vue'),
      import('../../src/store'),
    ]);
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };
    const store = useDevtoolsStore();
    store.currentValues.first = { value: false };
    store.currentValues.second = { value: 'changed' };
    const wrapper = mount(PropertiesTab);

    await wrapper
      .findAll('button')
      .find(button => button.text().includes('Reset defaults'))
      ?.trigger('click');

    expect(store.currentValues).toEqual({
      first: { value: true },
      second: { value: 'b' },
    });
    expect(applyUserProperties).toHaveBeenCalledOnce();
    expect(applyUserProperties).toHaveBeenCalledWith({
      first: { value: true },
      second: { value: 'b' },
    });
    expect(wrapper.text()).toContain('Reset defaults');
  });

  it('renders group boundaries as animated, initially closed sections', async () => {
    window.__WE_DEVTOOLS_CONFIG__ = {
      properties: {
        speed: {
          type: 'slider',
          text: 'Speed',
          value: 1,
          min: 0,
          max: 5,
          order: 5,
        },
        advanced: { type: 'group', text: 'Advanced', value: '', order: 4 },
        loose: { type: 'textinput', text: 'Loose', value: 'a', order: 0 },
        appearance: {
          type: 'group',
          text: 'ui_appearance',
          value: '',
          order: 1,
        },
        color: {
          type: 'color',
          text: 'Color',
          value: '0 0 0',
          order: 2,
        },
        enabled: { type: 'bool', text: 'Enabled', value: true, order: 3 },
      },
      localization: { 'en-us': { ui_appearance: 'Appearance' } },
    };
    const { default: PropertiesTab } = await import(
      '../../src/tabs/PropertiesTab.vue',
    );
    const wrapper = mount(PropertiesTab);

    expect(
      wrapper
        .get('[data-ungrouped-properties]')
        .findAll('article')
        .map(row => row.text()),
    ).toEqual([expect.stringContaining('Loose')]);

    const appearance = wrapper.get('[data-property-group="appearance"]');
    const advanced = wrapper.get('[data-property-group="advanced"]');
    const appearanceToggle = appearance.get('[data-property-group-toggle]');
    const advancedToggle = advanced.get('[data-property-group-toggle]');
    const appearanceContent = appearance.get(
      '[data-property-group-content="appearance"]',
    );
    expect(appearanceToggle.attributes('aria-expanded')).toBe('false');
    expect(advancedToggle.attributes('aria-expanded')).toBe('false');
    expect(appearanceContent.attributes('aria-hidden')).toBe('true');
    expect(appearanceContent.attributes()).toHaveProperty('inert');
    expect(appearanceToggle.text()).toBe('Appearance');
    expect(advancedToggle.text()).toBe('Advanced');
    expect(appearance.findAll('article').map(row => row.text())).toEqual([
      expect.stringContaining('Color'),
      expect.stringContaining('Enabled'),
    ]);
    expect(advanced.findAll('article').map(row => row.text())).toEqual([
      expect.stringContaining('Speed'),
    ]);

    await appearanceToggle.trigger('click');
    expect(appearanceToggle.attributes('aria-expanded')).toBe('true');
    expect(appearanceContent.attributes('aria-hidden')).toBe('false');
    expect(appearanceContent.attributes()).not.toHaveProperty('inert');
    expect(advancedToggle.attributes('aria-expanded')).toBe('false');

    await appearanceToggle.trigger('click');
    expect(appearanceToggle.attributes('aria-expanded')).toBe('false');
    expect(appearanceContent.attributes('aria-hidden')).toBe('true');
    expect(appearanceContent.attributes()).toHaveProperty('inert');
  });

  it('shows an explicit empty state without configured properties', async () => {
    window.__WE_DEVTOOLS_CONFIG__ = { properties: {}, localization: {} };
    const { default: PropertiesTab } = await import(
      '../../src/tabs/PropertiesTab.vue',
    );

    expect(mount(PropertiesTab).text()).toContain(
      'No user properties are configured',
    );
  });
});
