import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = { properties: {}, localization: {} };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
  vi.useRealTimers();
});

describe('audioTab', () => {
  it('registers visible listener status and streams selected spectrum frames', async () => {
    const [{ default: AudioTab }, { installGlobals }] = await Promise.all([
      import('../../src/tabs/AudioTab.vue'),
      import('../../src/globals'),
    ]);
    installGlobals();
    const audioListener = vi.fn();
    window.wallpaperRegisterAudioListener(audioListener);
    const wrapper = mount(AudioTab);
    const buttons = wrapper.findAll('button');
    const noise = buttons.find(button => button.text().includes('Noise'));

    expect(wrapper.text()).toContain('1 registered audio listener');
    expect(wrapper.text()).toContain('Bass pulse');
    expect(wrapper.text()).toContain('Stereo pan');
    await noise?.trigger('click');
    vi.advanceTimersByTime(34);

    expect(noise?.attributes('data-state')).toBe('on');
    expect(audioListener).toHaveBeenCalledOnce();
    expect(audioListener.mock.calls[0]?.[0]).toHaveLength(128);

    await buttons.find(button => button.text().includes('Off'))?.trigger('click');
    vi.advanceTimersByTime(100);
    expect(audioListener).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
});
