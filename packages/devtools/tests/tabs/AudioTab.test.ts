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
  it('selects simulation modes with Nuxt buttons and streams spectrum frames', async () => {
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
    expect(wrapper.get('output#we-audio-spectrum-status').text()).toContain('Stopped');
    expect(wrapper.get('canvas').attributes('aria-label')).toContain('left channel above, right channel below');
    expect(wrapper.text()).toContain('Bass pulse');
    expect(wrapper.text()).toContain('Stereo pan');
    expect(wrapper.text()).toContain('Track loop');
    await noise?.trigger('click');
    vi.advanceTimersByTime(34);
    await wrapper.vm.$nextTick();

    expect(noise?.attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('output#we-audio-spectrum-status').text()).toContain('Live');
    expect(wrapper.get('output#we-audio-spectrum-status').text()).toContain('Streaming Noise');
    expect(audioListener).toHaveBeenCalledOnce();
    expect(audioListener.mock.calls[0]?.[0]).toHaveLength(128);

    await buttons.find(button => button.text().includes('Silence'))?.trigger('click');
    expect(wrapper.get('output#we-audio-spectrum-status').text()).toContain('Silence');
    expect(wrapper.get('output#we-audio-spectrum-status').text()).toContain('Sending a zeroed spectrum');

    await buttons.find(button => button.text().includes('Off'))?.trigger('click');
    vi.advanceTimersByTime(100);
    expect(audioListener).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('uses Nuxt slider number models for the selected track simulation', async () => {
    const [
      { default: AudioTab },
      { default: USlider },
      { audioSettings, setAudioMode },
    ] = await Promise.all([
      import('../../src/tabs/AudioTab.vue'),
      import('@nuxt/ui/components/Slider.vue'),
      import('../../src/audio'),
    ]);
    const wrapper = mount(AudioTab);
    const track = wrapper
      .findAll('button')
      .find(button => button.text().includes('Track loop'));

    await track?.trigger('click');

    expect(wrapper.text()).toContain('Output');
    expect(wrapper.text()).toContain('Tempo');
    expect(wrapper.text()).toContain('Continuous bass');
    expect(wrapper.text()).toContain('Kick');
    expect(wrapper.text()).toContain('Clap');
    expect(wrapper.text()).toContain('Hi-hat');
    expect(wrapper.get('output#we-audio-spectrum-status').text()).toContain('Waiting');
    expect(wrapper.get('output#we-audio-spectrum-status').text()).toContain('No audio listener');
    const sliders = wrapper.findAllComponents(USlider);
    expect(sliders).toHaveLength(6);
    expect(
      wrapper.findAll('[role="slider"]').map(slider => slider.attributes('aria-valuetext')),
    ).toEqual(['100%', '120 BPM', '100%', '100%', '100%', '100%']);

    const tempo = wrapper.get('[role="slider"][aria-label="Tempo"]');
    await tempo.trigger('keydown', { key: 'ArrowRight' });
    expect(audioSettings.trackTempo).toBe(125);
    expect(tempo.attributes('aria-valuetext')).toBe('125 BPM');

    sliders[2]?.vm.$emit('update:modelValue', 0.4);
    await wrapper.vm.$nextTick();
    expect(audioSettings.trackBassline).toBe(0.4);
    expect(wrapper.text()).toContain('40%');

    setAudioMode('off');
    wrapper.unmount();
  });
});
