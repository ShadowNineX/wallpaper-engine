import type { Component } from 'vue';
import type { mountDevtools } from '../src/mount';
import { flushPromises } from '@vue/test-utils';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, onBeforeUnmount, onMounted, onUnmounted } from 'vue';

const instances: ReturnType<typeof mountDevtools>[] = [];
const Panel = defineComponent({ render: () => h('button', 'Simulator control') });

beforeEach(() => {
  vi.resetModules();
  window.__WE_DEVTOOLS_CONFIG__ = { properties: {}, localization: {} };
});

afterEach(() => {
  for (const instance of instances.splice(0))
    instance.unmount();
  delete window.__WE_DEVTOOLS_CONFIG__;
  setActivePinia(undefined);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function boot(component: Component = Panel, css = 'body { color: white; }') {
  const { mountDevtools } = await import('../src/mount');
  const instance = mountDevtools(component, css);
  instances.push(instance);
  return instance;
}

describe('devtools mounting', () => {
  it('mounts one isolated app when the client executes twice', async () => {
    const mounted = vi.fn();
    const unmounted = vi.fn();
    const component = defineComponent({
      setup() {
        onMounted(mounted);
        onUnmounted(unmounted);
        return () => h('button', 'Simulator control');
      },
    });
    const first = await boot(component);
    const second = await boot(component);

    expect(second).toBe(first);
    expect(document.querySelectorAll('wallpaper-engine-devtools')).toHaveLength(1);
    expect(first.host.shadowRoot).toBeNull();
    expect(first.host.querySelector('button')?.textContent).toBe('Simulator control');
    expect(mounted).toHaveBeenCalledOnce();
    first.unmount();
    second.unmount();
    expect(unmounted).toHaveBeenCalledOnce();
    expect(first.host.isConnected).toBe(false);
  });

  it('preserves the wallpaper active Pinia while mounting its own UI', async () => {
    const wallpaperPinia = createPinia();
    setActivePinia(wallpaperPinia);
    const instance = await boot();
    expect(getActivePinia()).toBe(wallpaperPinia);
    instance.unmount();
    expect(getActivePinia()).toBe(wallpaperPinia);
  });

  it('rolls back globals and document styles when mounting the shell fails', async () => {
    const wallpaperPinia = createPinia();
    setActivePinia(wallpaperPinia);
    const original = Object.getOwnPropertyDescriptor(window, 'wallpaperRegisterAudioListener');
    vi.spyOn(document.body, 'appendChild').mockImplementationOnce(() => {
      throw new Error('Shell unavailable');
    });

    await expect(boot(Panel, '@font-face { font-family: Simulator; src: url(simulator.woff2); }'))
      .rejects
      .toThrow('Shell unavailable');
    expect(getActivePinia()).toBe(wallpaperPinia);
    expect(document.querySelector('[data-we-devtools-styles]')).toBeNull();
    expect(document.getElementById('we-devtools-root')).toBeNull();
    expect(Object.getOwnPropertyDescriptor(window, 'wallpaperRegisterAudioListener')).toEqual(original);
    const replacement = await boot();
    expect(replacement.host.isConnected).toBe(true);
  });

  it('revokes selected media and cancels open pickers on teardown', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:simulator/selection');
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementationOnce(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: [new File(['image'], 'cover.png')] });
      this.dispatchEvent(new Event('change'));
    });
    const instance = await boot();
    const { pickDevFile, pickDevDirectory } = await import('../src/dev-files');
    const selection = await pickDevFile('image');
    click.mockImplementation(() => {});
    const pending = pickDevDirectory('image');
    expect(document.querySelector('input[type="file"]')).not.toBeNull();

    instance.unmount();
    await expect(pending).resolves.toBeNull();
    expect(revoke).toHaveBeenCalledExactlyOnceWith(selection!.url);
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('stops simulation and cancels queued startup work on teardown', async () => {
    vi.useFakeTimers();
    const original = Object.getOwnPropertyDescriptor(window, 'wallpaperRegisterAudioListener');
    const nativeRegister = vi.fn();
    Object.defineProperty(window, 'wallpaperRegisterAudioListener', {
      configurable: true,
      writable: true,
      value: nativeRegister,
    });
    try {
      const instance = await boot();
      const { setAudioMode } = await import('../src/audio');
      const audio = vi.fn();
      const startup = vi.fn();
      window.wallpaperRegisterAudioListener(audio);
      setAudioMode('track');
      vi.advanceTimersByTime(34);
      expect(audio).toHaveBeenCalledOnce();
      window.wallpaperPropertyListener = { applyUserProperties: startup };

      instance.unmount();
      await Promise.resolve();
      vi.advanceTimersByTime(100);
      expect(audio).toHaveBeenCalledOnce();
      expect(startup).not.toHaveBeenCalled();
      expect(window.wallpaperRegisterAudioListener).toBe(nativeRegister);
    }
    finally {
      if (original)
        Object.defineProperty(window, 'wallpaperRegisterAudioListener', original);
      else
        Reflect.deleteProperty(window, 'wallpaperRegisterAudioListener');
    }
  });

  it('reinstalls without stale audio listeners after teardown', async () => {
    vi.useFakeTimers();
    const first = await boot();
    const { setAudioMode } = await import('../src/audio');
    const oldAudio = vi.fn();
    window.wallpaperRegisterAudioListener(oldAudio);
    first.unmount();
    const second = await boot();
    const newAudio = vi.fn();
    window.wallpaperRegisterAudioListener(newAudio);
    setAudioMode('track');
    vi.advanceTimersByTime(34);

    expect(second).not.toBe(first);
    expect(document.querySelectorAll('wallpaper-engine-devtools')).toHaveLength(1);
    expect(oldAudio).not.toHaveBeenCalled();
    expect(newAudio).toHaveBeenCalledOnce();
  });

  it('cleans up the shell and globals even when a teardown hook throws', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'wallpaperRegisterAudioListener');
    const failure = new Error('Teardown failed');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const component = defineComponent({
      setup() {
        onBeforeUnmount(() => {
          throw failure;
        });
        return () => h('div', 'Simulator');
      },
    });
    const instance = await boot(component, '@font-face { font-family: Simulator; src: url(simulator.woff2); }');

    expect(() => instance.unmount()).toThrow(failure);
    expect(warning).toHaveBeenCalled();
    expect(instance.host.isConnected).toBe(false);
    expect(document.querySelector('[data-we-devtools-styles]')).toBeNull();
    expect(Object.getOwnPropertyDescriptor(window, 'wallpaperRegisterAudioListener')).toEqual(original);
    const replacement = await boot();
    expect(replacement.host.isConnected).toBe(true);
  });

  it('preserves host globals replaced by the wallpaper after mounting', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'wallpaperRegisterAudioListener');
    const instance = await boot();
    const replacement = vi.fn();
    try {
      window.wallpaperRegisterAudioListener = replacement;
      instance.unmount();
      expect(window.wallpaperRegisterAudioListener).toBe(replacement);
    }
    finally {
      if (original)
        Object.defineProperty(window, 'wallpaperRegisterAudioListener', original);
      else
        Reflect.deleteProperty(window, 'wallpaperRegisterAudioListener');
    }
  });

  it('styles Nuxt dropdown portals in the document and removes only owned resources', async () => {
    const { default: USelect } = await import('@nuxt/ui/components/Select.vue');
    const unrelated = document.createElement('style');
    unrelated.dataset.wallpaperStyles = '';
    unrelated.textContent = 'body { background: purple; }';
    document.head.appendChild(unrelated);
    const component = defineComponent({
      render: () => h(USelect, {
        defaultOpen: true,
        items: [
          { label: 'One', value: 'one' },
          { label: 'Two', value: 'two' },
        ],
        modelValue: 'one',
      }),
    });
    try {
      const css = '[data-slot="content"] { color: white; }';
      const instance = await boot(component, css);
      await flushPromises();

      const ownedStyle = document.head.querySelector<HTMLStyleElement>('style[data-we-devtools-styles]');
      const listbox = document.body.querySelector('[role="listbox"]');
      expect(ownedStyle?.textContent).toBe(css);
      expect(listbox?.getAttribute('data-slot')).toBe('content');
      expect(listbox?.textContent).toContain('Two');
      expect(instance.host.contains(listbox)).toBe(false);
      expect(unrelated.isConnected).toBe(true);

      instance.unmount();
      expect(document.querySelector('[role="listbox"]')).toBeNull();
      expect(document.querySelector('[data-we-devtools-styles]')).toBeNull();
      expect(unrelated.isConnected).toBe(true);
      expect(unrelated.textContent).toBe('body { background: purple; }');
    }
    finally {
      unrelated.remove();
    }
  });

  it('owns only the document styles and theme class it adds', async () => {
    const originalDark = document.documentElement.classList.contains('dark');
    const wallpaperStyle = document.createElement('style');
    wallpaperStyle.textContent = '.wallpaper { color: rebeccapurple; }';
    document.head.appendChild(wallpaperStyle);
    try {
      document.documentElement.classList.remove('dark');
      const instance = await boot(Panel, '.devtools { color: white; }');
      expect(document.head.querySelector('[data-we-devtools-styles]')?.textContent).toContain('.devtools');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      instance.unmount();
      expect(wallpaperStyle.isConnected).toBe(true);
      expect(wallpaperStyle.textContent).toContain('rebeccapurple');
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      document.documentElement.classList.add('dark');
      const prethemed = await boot(Panel, '');
      expect(prethemed.host.shadowRoot).toBeNull();
      prethemed.unmount();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    }
    finally {
      document.documentElement.classList.toggle('dark', originalDark);
      wallpaperStyle.remove();
    }
  });
});
