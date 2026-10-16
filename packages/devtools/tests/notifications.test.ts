import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

describe('notifications', () => {
  it('retains only the latest twenty unowned notices and flushes them to a frontend', async () => {
    const { notify, setNotificationHandler } = await import('../src/notifications');

    for (let index = 1; index <= 22; index += 1)
      notify(`Notice ${index}`);

    const frontend = vi.fn();
    setNotificationHandler(frontend);

    expect(frontend.mock.calls.map(([message]) => message)).toEqual(
      Array.from({ length: 20 }, (_, index) => `Notice ${index + 3}`),
    );
  });

  it('keeps the active nested owner when an older frontend is released', async () => {
    const { notify, setNotificationHandler } = await import('../src/notifications');
    const first = vi.fn();
    const second = vi.fn();
    const releaseFirst = setNotificationHandler(first);
    const releaseSecond = setNotificationHandler(second);

    releaseFirst();
    notify('Owned by second');
    releaseSecond();
    notify('Restored fallback');

    expect(second).toHaveBeenCalledWith('Owned by second');
    expect(first).not.toHaveBeenCalled();
    const replacement = vi.fn();
    setNotificationHandler(replacement);
    expect(replacement).toHaveBeenCalledWith('Restored fallback');
  });
});
