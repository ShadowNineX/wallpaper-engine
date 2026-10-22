import { createPinia, defineStore, getActivePinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

describe('invokeHostCallback', () => {
  it('preserves a subscriber-selected Pinia and removes its temporary action scope', async () => {
    const { withCallbackPinia } = await import('../src/callbacks');
    const originalPinia = getActivePinia();
    const simulatorPinia = createPinia();
    const wallpaperPinia = createPinia();
    const subscriberPinia = createPinia();
    const useScopeStore = defineStore('callback-scope', {
      actions: { activePinia: () => getActivePinia() },
    });
    const store = useScopeStore(simulatorPinia);
    const stopSubscriber = store.$onAction(() => setActivePinia(subscriberPinia), true);
    try {
      setActivePinia(wallpaperPinia);

      expect(withCallbackPinia(store, simulatorPinia, wallpaperPinia, () => store.activePinia())).toBe(subscriberPinia);
      expect(getActivePinia()).toBe(subscriberPinia);

      stopSubscriber();
      setActivePinia(wallpaperPinia);
      expect(store.activePinia()).toBe(simulatorPinia);
    }
    finally {
      stopSubscriber();
      setActivePinia(originalPinia);
    }
  });

  it('queues wallpaper callback failures until a frontend claims notifications', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { invokeHostCallback } = await import('../src/callbacks');
    const { setNotificationHandler } = await import('../src/notifications');

    const callback = () => {
      throw new Error('wallpaper failure');
    };

    expect(invokeHostCallback(callback)).toBe(false);

    const frontend = vi.fn();
    setNotificationHandler(frontend);
    expect(frontend).toHaveBeenCalledWith('Wallpaper callback failed. Check the browser console for details.');
  });

  it('forwards wallpaper callback failures to the active bridge notification owner', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { invokeHostCallback } = await import('../src/callbacks');
    const { setNotificationHandler } = await import('../src/notifications');
    const notifyBridge = vi.fn();
    const release = setNotificationHandler(notifyBridge);

    invokeHostCallback(() => {
      throw new Error('wallpaper failure');
    });
    release();

    expect(notifyBridge).toHaveBeenCalledWith(
      'Wallpaper callback failed. Check the browser console for details.',
    );
  });
});
