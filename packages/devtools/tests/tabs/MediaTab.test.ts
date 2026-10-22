import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const averageColor = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock('../../../wallpaper-engine/src/helpers', () => ({
  createAverageColorExtractor: averageColor.create,
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function installDelayedImages(): Array<() => void> {
  const loads: Array<() => void> = [];
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 1280;
      naturalHeight = 720;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      get src(): string {
        return '';
      }

      set src(_value: string) {
        loads.push(() => this.onload?.());
      }
    },
  );
  return loads;
}

function setArtworkFile(
  wrapper: ReturnType<typeof mount>,
  name: string,
): Promise<void> {
  const input = wrapper.get<HTMLInputElement>('input[type="file"]');
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [new File(['image'], name, { type: 'image/png' })],
  });
  return input.trigger('change');
}

function defaultAverageColorExtractor(): {
  getColorAsync: () => Promise<{ hex: string; isDark: boolean }>;
  destroy: () => undefined;
} {
  return {
    getColorAsync: () => Promise.resolve({ hex: '#000000', isDark: true }),
    destroy: () => undefined,
  };
}

let messages: string[] = [];
let releaseNotifications: (() => void) | undefined;

beforeEach(async () => {
  vi.resetModules();
  setActivePinia(createPinia());
  averageColor.create.mockReset().mockImplementation(defaultAverageColorExtractor);
  messages = [];
  const { setNotificationHandler } = await import('../../src/notifications');
  releaseNotifications = setNotificationHandler(message => messages.push(message));
  window.__WE_DEVTOOLS_CONFIG__ = { properties: {}, localization: {} };
});

afterEach(() => {
  releaseNotifications?.();
  releaseNotifications = undefined;
  delete window.__WE_DEVTOOLS_CONFIG__;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('mediaTab', () => {
  it('associates the media integration label with the named switch', async () => {
    const [{ default: MediaTab }, { listenerFns }] = await Promise.all([
      import('../../src/tabs/MediaTab.vue'),
      import('../../src/store'),
    ]);
    const onStatus = vi.fn();
    listenerFns.mediaStatus.push(onStatus);
    const wrapper = mount(MediaTab);
    const toggle = wrapper.get('button[role="switch"]');
    expect(toggle.attributes('id')).toBe('media-integration-enabled');
    expect(toggle.attributes('aria-label')).toBe('Media integration');
    expect(wrapper.get('label[for="media-integration-enabled"]').text()).toBe('Disabled');
    await toggle.trigger('click');
    expect(toggle.attributes('aria-checked')).toBe('true');
    expect(wrapper.get('label[for="media-integration-enabled"]').text()).toBe('Enabled');
    expect(onStatus).toHaveBeenCalledWith({ enabled: true });
    wrapper.unmount();
  });

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
    expect(messages).toContain(
      'Some media callbacks failed. Check the browser console for details.',
    );
    expect(messages).not.toContain('Media integration enabled.');
    wrapper.unmount();
  });

  it('keeps finite timeline values when a numeric input is cleared', async () => {
    const [{ default: MediaTab }, { useDevtoolsStore }, { default: UInputNumber }] = await Promise.all([
      import('../../src/tabs/MediaTab.vue'),
      import('../../src/store'),
      import('@nuxt/ui/components/InputNumber.vue'),
    ]);
    const wrapper = mount(MediaTab);
    const fields = wrapper.findAllComponents(UInputNumber);
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

    expect(messages.some(message => message.includes('Unable to decode or convert'))).toBe(true);
    const choose = wrapper.findAll('button').find(button => button.text() === 'Choose image');
    expect(choose?.attributes('disabled')).toBeUndefined();
    expect(wrapper.get('[aria-busy]').attributes('aria-busy')).toBe('false');
    wrapper.unmount();
  });

  it('edits content type through the Nuxt select and sends metadata', async () => {
    const [{ default: MediaTab }, { listenerFns }, { default: USelect }] = await Promise.all([
      import('../../src/tabs/MediaTab.vue'),
      import('../../src/store'),
      import('@nuxt/ui/components/Select.vue'),
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
    wrapper.findComponent(USelect).vm.$emit('update:modelValue', 'video');
    await flushPromises();
    await buttons
      .find(button => button.text().includes('Send metadata'))
      ?.trigger('click');

    expect(mediaPropertiesListener).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'video' }),
    );
    expect(wrapper.get('button#media-content-type').attributes('role')).toBe('combobox');
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

  it('ignores a delayed artwork decode after unmount and preserves newer artwork', async () => {
    const [{ default: MediaTab }, { useDevtoolsStore }] = await Promise.all([
      import('../../src/tabs/MediaTab.vue'),
      import('../../src/store'),
    ]);
    const loads = installDelayedImages();
    const createObjectURL = vi.fn()
      .mockReturnValueOnce('blob:old')
      .mockReturnValueOnce('blob:new');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValueOnce('data:image/png;base64,new')
      .mockReturnValueOnce('data:image/png;base64,old');

    const oldWrapper = mount(MediaTab);
    await setArtworkFile(oldWrapper, 'old.png');
    oldWrapper.unmount();

    const currentWrapper = mount(MediaTab);
    await setArtworkFile(currentWrapper, 'new.png');
    loads[1]?.();
    await flushPromises();

    expect(useDevtoolsStore().mediaThumb.thumbnail).toBe('data:image/png;base64,new');

    loads[0]?.();
    await flushPromises();

    expect(useDevtoolsStore().mediaThumb.thumbnail).toBe('data:image/png;base64,new');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:old');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:new');
    currentWrapper.unmount();
  });

  it('ignores a delayed palette after unmount and preserves newer artwork', async () => {
    const [{ default: MediaTab }, { useDevtoolsStore }] = await Promise.all([
      import('../../src/tabs/MediaTab.vue'),
      import('../../src/store'),
    ]);
    const oldPalette = [deferred<{ hex: string; isDark: boolean }>(), deferred<{ hex: string; isDark: boolean }>(), deferred<{ hex: string; isDark: boolean }>()];
    const newPalette = [deferred<{ hex: string; isDark: boolean }>(), deferred<{ hex: string; isDark: boolean }>(), deferred<{ hex: string; isDark: boolean }>()];
    const destroyOld = vi.fn();
    const destroyNew = vi.fn();
    let extractorIndex = 0;
    averageColor.create.mockImplementation(() => {
      const palette = [...[oldPalette, newPalette][extractorIndex++]!];
      return {
        getColorAsync: vi.fn(() => palette.shift()!.promise),
        destroy: extractorIndex === 1 ? destroyOld : destroyNew,
      };
    });
    const loads = installDelayedImages();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn()
        .mockReturnValueOnce('blob:old')
        .mockReturnValueOnce('blob:new'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValueOnce('data:image/png;base64,old')
      .mockReturnValueOnce('data:image/png;base64,new');

    const oldWrapper = mount(MediaTab);
    await setArtworkFile(oldWrapper, 'old.png');
    loads[0]?.();
    await flushPromises();
    oldWrapper.unmount();

    const currentWrapper = mount(MediaTab);
    await setArtworkFile(currentWrapper, 'new.png');
    loads[1]?.();
    await flushPromises();

    for (const color of oldPalette)
      color.resolve({ hex: '#111111', isDark: true });
    await flushPromises();

    expect(useDevtoolsStore().mediaThumb).toMatchObject({
      thumbnail: 'data:image/png;base64,new',
      primaryColor: '#202020',
    });
    expect(destroyOld).toHaveBeenCalledOnce();

    newPalette[0]?.resolve({ hex: '#222222', isDark: false });
    newPalette[1]?.resolve({ hex: '#333333', isDark: false });
    newPalette[2]?.resolve({ hex: '#444444', isDark: false });
    await flushPromises();

    expect(useDevtoolsStore().mediaThumb).toMatchObject({
      primaryColor: '#222222',
      secondaryColor: '#333333',
      tertiaryColor: '#444444',
    });
    expect(destroyNew).toHaveBeenCalledOnce();
    currentWrapper.unmount();
  });

  it('delivers status, playback, timeline, artwork, and disabled transitions', async () => {
    const [{ default: MediaTab }, { listenerFns }, { default: UInputNumber }] = await Promise.all([
      import('../../src/tabs/MediaTab.vue'),
      import('../../src/store'),
      import('@nuxt/ui/components/InputNumber.vue'),
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

    const fields = wrapper.findAllComponents(UInputNumber);
    fields[0]?.vm.$emit('update:modelValue', 31);
    fields[1]?.vm.$emit('update:modelValue', 179);
    await flushPromises();
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
