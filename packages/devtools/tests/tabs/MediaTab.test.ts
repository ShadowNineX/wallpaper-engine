import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'vue-sonner';

vi.mock('vue-sonner', () => ({ toast: vi.fn() }));
vi.mock('../../../wallpaper-engine/src/helpers', () => ({
  createAverageColorExtractor: () => ({
    getColorAsync: () => Promise.resolve({ hex: '#000000' }),
    destroy: () => undefined,
  }),
}));

beforeEach(() => {
  vi.resetModules();
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = { properties: {}, localization: {} };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('mediaTab', () => {
  it('reports a failed enable callback without skipping the remaining media state', async () => {
    const [{ default: MediaTab }, { listenerFns }] = await Promise.all([
      import('../../src/tabs/MediaTab.vue'),
      import('../../src/store'),
    ]);
    const metadata = vi.fn();
    listenerFns.mediaStatus.push(() => {
      throw new Error('wallpaper failed');
    });
    listenerFns.mediaProps.push(metadata);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const wrapper = mount(MediaTab);

    await wrapper.get('[data-media-enabled]').trigger('click');

    expect(metadata).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith(
      'Some media callbacks failed. Check the browser console for details.',
    );
    expect(toast).not.toHaveBeenCalledWith('Media integration enabled.');
    wrapper.unmount();
  });

  it('keeps finite timeline values when a numeric input is cleared', async () => {
    const [{ default: MediaTab }, { useDevtoolsStore }, { NumberField }] = await Promise.all([
      import('../../src/tabs/MediaTab.vue'),
      import('../../src/store'),
      import('../../src/components/ui/number-field'),
    ]);
    const wrapper = mount(MediaTab);
    const fields = wrapper.findAllComponents(NumberField);
    fields[0]?.vm.$emit('update:modelValue', Number.NaN);
    fields[1]?.vm.$emit('update:modelValue', Number.NaN);
    await flushPromises();

    expect(useDevtoolsStore().mediaTimeline).toEqual({ position: 30, duration: 180 });
    wrapper.unmount();
  });

  it('recovers artwork controls when object URL creation fails', async () => {
    const { default: MediaTab } = await import('../../src/tabs/MediaTab.vue');
    const wrapper = mount(MediaTab);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('Unable to allocate an object URL');
    });
    const input = wrapper.get<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['image'], 'artwork.png', { type: 'image/png' })],
    });

    await input.trigger('change');
    await flushPromises();

    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Unable to decode or convert'));
    const choose = wrapper.findAll('button').find(button => button.text() === 'Choose image');
    expect(choose?.attributes('disabled')).toBeUndefined();
    expect(wrapper.get('[aria-busy]').attributes('aria-busy')).toBe('false');
    wrapper.unmount();
  });

  it('edits content type through the native selector and sends metadata', async () => {
    const [{ default: MediaTab }, { listenerFns }] = await Promise.all([
      import('../../src/tabs/MediaTab.vue'),
      import('../../src/store'),
    ]);
    const mediaPropertiesListener = vi.fn();
    listenerFns.mediaProps.push(mediaPropertiesListener);
    const wrapper = mount(MediaTab);
    const buttons = wrapper.findAll('button');
    const enabled = wrapper.get('[data-media-enabled]');

    expect(enabled.attributes('data-state')).toBe('unchecked');
    expect(wrapper.get('#media-title').attributes('disabled')).toBeUndefined();

    await enabled.trigger('click');
    expect(enabled.attributes('data-state')).toBe('checked');
    mediaPropertiesListener.mockClear();
    await wrapper.get('select#media-content-type').setValue('video');
    await buttons
      .find(button => button.text().includes('Send metadata'))
      ?.trigger('click');

    expect(mediaPropertiesListener).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'video' }),
    );
    expect(
      wrapper.get('[data-slot="native-select-wrapper"]').attributes('data-slot'),
    ).toBe('native-select-wrapper');
  });

  it('associates artwork file and palette inputs with labels', async () => {
    const { default: MediaTab } = await import('../../src/tabs/MediaTab.vue');
    const wrapper = mount(MediaTab);

    expect(
      wrapper.get('label[for="media-thumbnail-input"]').text(),
    ).toBe('Artwork image');
    expect(wrapper.get('#media-thumbnail-input').attributes('type')).toBe('file');
    expect(wrapper.get('label[for="thumb-primaryColor"]').text()).toBe(
      'Primary',
    );
    expect(
      wrapper.get('label[for="thumb-primaryColor-value"]').text(),
    ).toBe('Primary color value');
    expect(
      wrapper.get<HTMLInputElement>('#thumb-primaryColor-value').element.value,
    ).toBe('#202020');
  });

  it('accepts browser-decodable artwork and emits a PNG callback', async () => {
    const [{ default: MediaTab }, { listenerFns }] = await Promise.all([
      import('../../src/tabs/MediaTab.vue'),
      import('../../src/store'),
    ]);
    const thumbnail = vi.fn();
    listenerFns.mediaThumb.push(thumbnail);
    const wrapper = mount(MediaTab);
    const button = (label: string) =>
      wrapper.findAll('button').find(candidate => candidate.text().includes(label));

    await wrapper.get('[data-media-enabled]').trigger('click');
    thumbnail.mockClear();

    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,converted',
    );
    const createObjectURL = vi.fn(() => 'blob:artwork-source');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 6400;
        naturalHeight = 3200;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        get src(): string {
          return '';
        }

        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );

    const input = wrapper.get<HTMLInputElement>('input[type="file"]');
    const jpeg = new File(['jpeg'], 'cover.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [jpeg],
    });

    expect(input.attributes('accept')).toBe('image/*');
    expect(button('Choose image')).toBeDefined();
    await input.trigger('change');
    await flushPromises();
    await button('Send artwork')?.trigger('click');

    expect(drawImage).toHaveBeenCalledOnce();
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1024, 512);
    expect(thumbnail).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnail: 'data:image/png;base64,converted',
      }),
    );
    expect(createObjectURL).toHaveBeenCalledWith(jpeg);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:artwork-source');
  });

  it('delivers status, playback, timeline, artwork, and disabled transitions', async () => {
    const [{ default: MediaTab }, { listenerFns }] = await Promise.all([
      import('../../src/tabs/MediaTab.vue'),
      import('../../src/store'),
    ]);
    const status = vi.fn();
    const properties = vi.fn();
    const thumbnail = vi.fn();
    const playback = vi.fn();
    const timeline = vi.fn();
    listenerFns.mediaStatus.push(status);
    listenerFns.mediaProps.push(properties);
    listenerFns.mediaThumb.push(thumbnail);
    listenerFns.mediaPlayback.push(playback);
    listenerFns.mediaTimeline.push(timeline);
    const wrapper = mount(MediaTab);
    const button = (label: string) =>
      wrapper.findAll('button').find(candidate => candidate.text().includes(label));

    await wrapper.get('[data-media-enabled]').trigger('click');
    expect(status).toHaveBeenLastCalledWith({ enabled: true });
    expect(properties).toHaveBeenCalledOnce();
    expect(thumbnail).toHaveBeenCalledOnce();
    expect(playback).toHaveBeenCalledWith({ state: 0 });
    expect(timeline).toHaveBeenCalledWith({ position: 30, duration: 180 });

    playback.mockClear();
    timeline.mockClear();
    thumbnail.mockClear();
    await button('Paused')?.trigger('click');
    expect(playback).toHaveBeenCalledWith({ state: 1 });

    const increases = wrapper.findAll('button[aria-label="Increase"]');
    const decreases = wrapper.findAll('button[aria-label="Decrease"]');
    await increases[0]?.trigger('pointerdown', { button: 0 });
    await increases[0]?.trigger('pointerup', { button: 0 });
    await decreases[1]?.trigger('pointerdown', { button: 0 });
    await decreases[1]?.trigger('pointerup', { button: 0 });
    await button('Send timeline')?.trigger('click');
    expect(timeline).toHaveBeenCalledWith({ position: 31, duration: 179 });

    await button('Send artwork')?.trigger('click');
    expect(thumbnail).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnail: expect.stringMatching(/^data:image\/png;base64,/),
        textColor: '#ffffff',
      }),
    );

    properties.mockClear();
    thumbnail.mockClear();
    playback.mockClear();
    timeline.mockClear();
    await wrapper.get('[data-media-enabled]').trigger('click');
    expect(status).toHaveBeenLastCalledWith({ enabled: false });
    expect(properties).not.toHaveBeenCalled();
    expect(thumbnail).not.toHaveBeenCalled();
    expect(playback).not.toHaveBeenCalled();
    expect(timeline).not.toHaveBeenCalled();
  });
});
