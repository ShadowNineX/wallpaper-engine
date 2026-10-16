import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

describe('invokeHostCallback', () => {
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
