import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'vue-sonner';

vi.mock('vue-sonner', () => ({ toast: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = { properties: {}, localization: {} };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
});

describe('generalTab', () => {
  it('sends FPS, pause, resume, and plugin events after user interaction', async () => {
    const [{ default: GeneralTab }, { listenerFns }] = await Promise.all([
      import('../../src/tabs/GeneralTab.vue'),
      import('../../src/store'),
    ]);
    const applyGeneralProperties = vi.fn();
    const setPaused = vi.fn();
    const onPluginLoaded = vi.fn();
    listenerFns.property = { applyGeneralProperties, setPaused };
    listenerFns.plugin = { onPluginLoaded };
    const wrapper = mount(GeneralTab);
    const buttons = wrapper.findAll('button');

    await buttons.find(button => button.text().trim() === 'Send')?.trigger('click');
    await buttons.find(button => button.text().includes('Paused'))?.trigger('click');
    await buttons.find(button => button.text().includes('Running'))?.trigger('click');
    await buttons
      .find(button => button.text().includes('Load LED plugin'))
      ?.trigger('click');
    await buttons
      .find(button => button.text().includes('Load iCUE plugin'))
      ?.trigger('click');

    expect(applyGeneralProperties).toHaveBeenCalledWith({ fps: 60 });
    expect(setPaused.mock.calls).toEqual([[true], [false]]);
    expect(onPluginLoaded.mock.calls).toEqual([
      ['led', '0.0.0-dev'],
      ['cue', '0.0.0-dev'],
    ]);
  });

  it('shows actionable feedback when runtime listeners are missing', async () => {
    const { default: GeneralTab } = await import('../../src/tabs/GeneralTab.vue');
    const wrapper = mount(GeneralTab);
    const buttons = wrapper.findAll('button');

    await buttons.find(button => button.text().trim() === 'Send')?.trigger('click');
    await buttons.find(button => button.text().includes('Paused'))?.trigger('click');
    await buttons
      .find(button => button.text().includes('Load LED plugin'))
      ?.trigger('click');

    expect(toast).toHaveBeenCalledWith(
      'No applyGeneralProperties listener registered.',
    );
    expect(toast).toHaveBeenCalledWith('No setPaused listener registered.');
    expect(toast).toHaveBeenCalledWith('No onPluginLoaded listener registered.');
  });
});
