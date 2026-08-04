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
    expect(wrapper.text()).toContain('Track loop');
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

  it('shows adjustable controls for the selected track simulation', async () => {
    const [
      { default: AudioTab },
      { Slider },
      { audioSettings, setAudioMode },
    ] = await Promise.all([
      import('../../src/tabs/AudioTab.vue'),
      import('../../src/components/ui/slider'),
      import('../../src/audio'),
    ]);
    const wrapper = mount(AudioTab);
    const track = wrapper
      .findAll('button')
      .find(button => button.text().includes('Track loop'));

    await track?.trigger('click');

    expect(wrapper.text()).toContain('Simulation controls');
    expect(wrapper.text()).toContain('Output');
    expect(wrapper.text()).toContain('Tempo');
    expect(wrapper.text()).toContain('Continuous bass');
    expect(wrapper.text()).toContain('Kick');
    expect(wrapper.text()).toContain('Clap');
    expect(wrapper.text()).toContain('Hi-hat');
    const sliders = wrapper.findAllComponents(Slider);
    expect(sliders).toHaveLength(6);

    sliders[2]?.vm.$emit('update:modelValue', [0.4]);
    await wrapper.vm.$nextTick();
    expect(audioSettings.trackBassline).toBe(0.4);
    expect(wrapper.text()).toContain('40%');

    setAudioMode('off');
    wrapper.unmount();
  });
});
