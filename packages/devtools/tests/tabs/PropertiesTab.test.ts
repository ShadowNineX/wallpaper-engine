import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { builtInValues } from '../fixtures/properties';

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
  it('sorts conditional dividers without breaking group boundaries', async () => {
    window.__WE_DEVTOOLS_CONFIG__ = {
      properties: {
        after: { type: 'textinput', text: 'After', value: '', order: 3 },
        outside: { type: 'divider', order: 2 },
        before: { type: 'textinput', text: 'Before', value: '', order: 1 },
        enabled: { type: 'bool', text: 'Enabled', value: false, order: 0 },
        appearance: { type: 'group', text: 'Appearance', value: '', order: 4 },
        first: { type: 'textinput', text: 'First in group', value: '', order: 5 },
        conditional: { type: 'divider', text: 'Advanced options', condition: 'enabled.value', order: 6 },
        last: { type: 'textinput', text: 'Last in group', value: '', order: 7 },
      },
      localization: {},
    };
    const [{ default: PropertiesTab }, { useDevtoolsStore, listenerFns }] = await Promise.all([
      import('../../src/tabs/PropertiesTab.vue'),
      import('../../src/store'),
    ]);
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };
    const store = useDevtoolsStore();
    const wrapper = mount(PropertiesTab);
    const outside = wrapper.get('[data-ungrouped-properties] [data-property-divider="outside"]');
    expect(outside.element.previousElementSibling?.getAttribute('title')).toBe('before · textinput');
    expect(outside.element.nextElementSibling?.getAttribute('title')).toBe('after · textinput');
    const group = wrapper.get('[data-property-group="appearance"]');
    expect(group.find('[data-property-divider="conditional"]').exists()).toBe(false);
    expect(group.text()).toContain('Last in group');

    store.currentValues.enabled = { value: true };
    await nextTick();
    const divider = group.get('[data-property-divider="conditional"]');
    expect(divider.get('hr').element.tagName).toBe('HR');
    expect(divider.element.previousElementSibling?.getAttribute('title')).toBe('first · textinput');
    expect(divider.element.nextElementSibling?.getAttribute('title')).toBe('last · textinput');
    store.deliverAllProperties(false);
    expect(applyUserProperties.mock.calls[0]?.[0]).not.toHaveProperty('outside');
    expect(applyUserProperties.mock.calls[0]?.[0]).not.toHaveProperty('conditional');

    store.currentValues.enabled = { value: false };
    await nextTick();
    expect(group.find('[data-property-divider="conditional"]').exists()).toBe(false);
    expect(group.text()).toContain('Last in group');
    wrapper.unmount();
  });

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
      expect.stringContaining('Audio recording'),
      expect.stringContaining('Scheme color'),
      expect.stringContaining('Flip'),
      expect.stringContaining('Show color options'),
      expect.stringContaining('First'),
      expect.stringContaining('Second'),
    ]);
    await wrapper
      .findAll('button')
      .find(button => button.text().includes('Replay all'))
      ?.trigger('click');

    expect(applyUserProperties).toHaveBeenCalledWith({
      ...builtInValues,
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
      ...builtInValues,
      first: { value: true },
      second: { value: 'b' },
    });
    expect(applyUserProperties).toHaveBeenCalledOnce();
    expect(applyUserProperties).toHaveBeenCalledWith({
      ...builtInValues,
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
    ).toEqual([
      expect.stringContaining('Audio recording'),
      expect.stringContaining('Scheme color'),
      expect.stringContaining('Flip'),
      expect.stringContaining('Show color options'),
      expect.stringContaining('Loose'),
    ]);

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

  it('renders and delivers built-in controls without custom properties', async () => {
    window.__WE_DEVTOOLS_CONFIG__ = { properties: {}, localization: {} };
    const [{ default: PropertiesTab }, { listenerFns }] = await Promise.all([
      import('../../src/tabs/PropertiesTab.vue'),
      import('../../src/store'),
    ]);
    const applyUserProperties = vi.fn();
    listenerFns.property = { applyUserProperties };
    const wrapper = mount(PropertiesTab);
    expect(wrapper.text()).toContain('Audio recording');
    expect(wrapper.text()).not.toContain('Brightness');
    const colorOptions = wrapper.findAll('article').find(row => row.text().includes('Show color options'))!;
    await colorOptions.get('button[role="switch"]').trigger('click');
    expect(wrapper.text()).toContain('Brightness');
    expect(wrapper.text()).toContain('Contrast');
    expect(wrapper.text()).toContain('Saturation');
    expect(wrapper.text()).toContain('Hue shift');
    expect(applyUserProperties).toHaveBeenLastCalledWith({ wec_e: { value: true } });
  });

  it('reactively hides conditional properties and keeps them in callback delivery', async () => {
    window.__WE_DEVTOOLS_CONFIG__ = {
      properties: {
        enabled: { type: 'bool', text: 'Enabled', value: false, order: 1 },
        mode: {
          type: 'combo',
          text: 'Mode',
          value: 'basic',
          options: [
            { label: 'Basic', value: 'basic' },
            { label: 'Advanced', value: 'advanced' },
          ],
          order: 2,
        },
        advanced: {
          type: 'textinput',
          text: 'Advanced setting',
          value: 'kept',
          condition: 'enabled.value == true && mode.value == \'advanced\'',
          order: 3,
        },
      },
      localization: {},
    };
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
    const wrapper = mount(PropertiesTab);

    expect(wrapper.text()).not.toContain('Advanced setting');

    store.currentValues.enabled = { value: true };
    store.currentValues.mode = { value: 'advanced', text: 'Advanced' };
    await nextTick();

    expect(wrapper.text()).toContain('Advanced setting');

    store.currentValues.enabled = { value: false };
    await nextTick();

    expect(wrapper.text()).not.toContain('Advanced setting');
    await wrapper
      .findAll('button')
      .find(button => button.text().includes('Replay all'))
      ?.trigger('click');
    expect(applyUserProperties).toHaveBeenCalledWith({
      ...builtInValues,
      enabled: { value: false },
      mode: { value: 'advanced', text: 'Advanced' },
      advanced: { value: 'kept' },
    });
  });

  it('hides groups whose display condition is false with their contained properties', async () => {
    window.__WE_DEVTOOLS_CONFIG__ = {
      properties: {
        enabled: { type: 'bool', text: 'Enabled', value: false, order: 1 },
        optional: {
          type: 'group',
          text: 'Optional',
          value: '',
          condition: 'enabled.value == true',
          order: 2,
        },
        separator: { type: 'divider', order: 2.5 },
        secret: { type: 'textinput', text: 'Secret', value: 'value', order: 3 },
        following: { type: 'group', text: 'Following', value: '', order: 4 },
        visible: { type: 'textinput', text: 'Visible', value: 'yes', order: 5 },
      },
      localization: {},
    };
    const [{ default: PropertiesTab }, { useDevtoolsStore }] = await Promise.all([
      import('../../src/tabs/PropertiesTab.vue'),
      import('../../src/store'),
    ]);
    const store = useDevtoolsStore();
    const wrapper = mount(PropertiesTab);

    expect(wrapper.find('[data-property-group="optional"]').exists()).toBe(false);
    expect(wrapper.find('[data-property-divider="separator"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Secret');
    expect(wrapper.get('[data-property-group="following"]').text()).toContain('Visible');

    store.currentValues.enabled = { value: true };
    await nextTick();

    expect(wrapper.get('[data-property-group="optional"]').text()).toContain('Secret');
    expect(wrapper.get('[data-property-group="optional"] [data-property-divider="separator"] hr').element.tagName).toBe('HR');
  });
});
