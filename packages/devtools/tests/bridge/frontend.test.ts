import type { Pinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Value from 'typebox/value';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { notifyMock, mountedPinia } = vi.hoisted(() => ({
  notifyMock: vi.fn(),
  mountedPinia: { value: undefined as Pinia | undefined },
}));

vi.mock('../../src/notifications', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/notifications')>(),
  notify: notifyMock,
}));

vi.mock('../../src/mount', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/mount')>();
  return {
    ...actual,
    mountDevtools(component: Parameters<typeof actual.mountDevtools>[0], css?: string, options?: Parameters<typeof actual.mountDevtools>[2]) {
      mountedPinia.value = options?.pinia;
      return actual.mountDevtools(component, css, options);
    },
  };
});

interface FakePort {
  readonly sent: unknown[];
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  starts: number;
  closes: number;
  postMessage: (message: unknown) => void;
  start: () => void;
  close: () => void;
  receive: (message: unknown) => void;
}

function createPort(): FakePort {
  const port: FakePort = {
    sent: [],
    onmessage: null,
    starts: 0,
    closes: 0,
    postMessage(message) { port.sent.push(message); },
    start() { port.starts += 1; },
    close() { port.closes += 1; },
    receive(message) { port.onmessage?.({ data: message } as MessageEvent<unknown>); },
  };
  return port;
}

function dispatchConnection(source: Window, port: FakePort, origin = window.location.origin, data: unknown = {
  source: 'wallpaper-engine-devtools',
  version: 1,
  kind: 'connected',
}): void {
  const event = new Event('message') as MessageEvent<unknown>;
  Object.defineProperties(event, {
    data: { value: data },
    origin: { value: origin },
    ports: { value: [port] },
    source: { value: source },
  });
  window.dispatchEvent(event);
}

function commandMessages(port: FakePort): Array<Record<string, unknown>> {
  return port.sent.filter((message): message is Record<string, unknown> =>
    typeof message === 'object' && message !== null && (message as Record<string, unknown>).kind === 'command');
}

function root(): HTMLElement {
  const host = document.querySelector<HTMLElement>('wallpaper-engine-devtools');
  if (!host)
    throw new Error('Devtools frontend did not mount.');
  return host;
}

async function fpsField(): Promise<HTMLInputElement> {
  const runtimeTab = [...root().querySelectorAll<HTMLButtonElement>('.we-tab-trigger')]
    .find(button => button.textContent?.includes('Runtime'));
  runtimeTab?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  runtimeTab?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
  runtimeTab?.click();
  await flushPromises();
  const field = root().querySelector<HTMLInputElement>('#general-fps-input, #general-fps');
  if (!field)
    throw new Error('Runtime FPS field did not render.');
  return field;
}

let stop: (() => void) | undefined;
let restoreParent: (() => void) | undefined;
let restoreOpener: (() => void) | undefined;
let originalUrl = '';
let animationFrameId = 0;
let animationFrames = new Map<number, FrameRequestCallback>();

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  notifyMock.mockReset();
  mountedPinia.value = undefined;
  animationFrameId = 0;
  animationFrames = new Map();
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = ++animationFrameId;
    animationFrames.set(id, callback);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => animationFrames.delete(id)));
  vi.stubGlobal('__WE_DEVTOOLS_VERSION__', '1.2.3');
  vi.stubGlobal('__WE_DEVTOOLS_GIT_VERSION__', 'abc1234-test');
  window.__WE_DEVTOOLS_CONFIG__ = {
    properties: { speed: { type: 'slider', text: 'Speed', value: 2, min: 0, max: 5 } },
    localization: {},
  };
  originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
});

afterEach(() => {
  stop?.();
  stop = undefined;
  restoreParent?.();
  restoreParent = undefined;
  restoreOpener?.();
  restoreOpener = undefined;
  window.history.replaceState(null, '', originalUrl);
  delete window.__WE_DEVTOOLS_CONFIG__;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setActivePinia(undefined);
});

async function boot(options: { detached?: boolean } = {}) {
  const hostPostMessage = vi.fn();
  const host = { postMessage: hostPostMessage, closed: false } as unknown as Window;
  if (options.detached) {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'opener');
    Object.defineProperty(window, 'opener', { configurable: true, value: { parent: host } });
    restoreOpener = () => {
      if (descriptor)
        Object.defineProperty(window, 'opener', descriptor);
    };
  }
  else {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'parent');
    Object.defineProperty(window, 'parent', { configurable: true, value: host });
    restoreParent = () => {
      if (descriptor)
        Object.defineProperty(window, 'parent', descriptor);
    };
  }
  window.history.replaceState(null, '', options.detached ? '/#session=bridge-test&view=popup' : '/#session=bridge-test');

  const [{ startFrontend }, { HostSnapshotSchema, HostSnapshotValidator, makeHostPatch }, { useDevtoolsStore, listenerFns }, { audioSettings, audioState, resetAudioSettings }] = await Promise.all([
    import('../../src/bridge/frontend'),
    import('../../src/bridge/protocol'),
    import('../../src/store'),
    import('../../src/audio'),
  ]);
  const hostStore = useDevtoolsStore(createPinia());
  resetAudioSettings();
  audioState.mode = 'off';
  stop = startFrontend(':host { color: white; }');
  if (!mountedPinia.value)
    throw new Error('Frontend did not provide a Pinia instance to its mount.');
  const frontendStore = useDevtoolsStore(mountedPinia.value);
  const snapshot = (revision = 1) => ({
    kind: 'snapshot' as const,
    revision,
    snapshot: HostSnapshotValidator.Parse(Value.Clean(HostSnapshotSchema, Value.Clone({
      state: hostStore.$state,
      audioMode: audioState.mode,
      audioSettings: { ...audioSettings },
      placement: 'bottom' as const,
      detached: options.detached ?? false,
    }))),
  });
  return { host, hostPostMessage, hostStore, listenerFns, audioSettings, audioState, frontendStore, makeHostPatch, snapshot };
}

describe('bridge frontend', () => {
  it('keeps wallpaper globals out of the frontend and hydrates a validated host snapshot', async () => {
    const { host, snapshot } = await boot();
    const port = createPort();
    const propertyDescriptor = Object.getOwnPropertyDescriptor(window, 'wallpaperPropertyListener');
    dispatchConnection(host, port);
    port.receive(snapshot());
    await flushPromises();
    expect(propertyDescriptor).toBeUndefined();
    expect(port.starts).toBe(1);
    expect(root().textContent).toContain('Speed');
    expect(root().querySelector('button[aria-label="Dock devtools bottom"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('sends a typed property action with an incremental draft without invoking a local wallpaper listener', async () => {
    const { host, listenerFns, snapshot } = await boot();
    const port = createPort();
    const localListener = vi.fn();
    listenerFns.property = { applyUserProperties: localListener };
    dispatchConnection(host, port);
    port.receive(snapshot());
    await flushPromises();
    [...root().querySelectorAll('button')].find(button => button.textContent?.includes('Replay all'))?.click();
    const sent = commandMessages(port);
    expect(localListener).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ command: { type: 'action', call: { name: 'deliverAllProperties', args: [] } }, draft: [] });
  });

  it.each([
    { label: 'Send artwork', action: 'sendMediaArtwork', callback: 'artwork' },
    { label: 'Send metadata', action: 'sendMediaProperties', callback: 'metadata' },
    { label: 'Send timeline', action: 'sendMediaTimeline', callback: 'timeline' },
    { label: 'Send', action: 'applyFps', callback: 'fps' },
  ])('delivers $action from a real button click without forwarding the pointer event', async ({ label, action, callback }) => {
    const { host, hostStore, listenerFns, snapshot } = await boot();
    const [{ ClientMessageValidator }, { applyDraftUpdate, executeCommand }] = await Promise.all([
      import('../../src/bridge/protocol'),
      import('../../src/bridge/backend'),
    ]);
    const delivered = vi.fn();
    hostStore.mediaActive = true;
    hostStore.mediaThumb.thumbnail = 'data:image/png;base64,artwork';
    hostStore.mediaThumb.primaryColor = '#aabbcc';
    hostStore.mediaProps.title = 'Artwork test track';
    hostStore.mediaTimeline.position = 42;
    hostStore.general.fps = 90;
    if (callback === 'artwork')
      listenerFns.mediaThumb.push(delivered);
    else if (callback === 'metadata')
      listenerFns.mediaProps.push(delivered);
    else if (callback === 'timeline')
      listenerFns.mediaTimeline.push(delivered);
    else
      listenerFns.property = { applyGeneralProperties: delivered };
    const port = createPort();
    dispatchConnection(host, port);
    port.receive(snapshot());
    await flushPromises();
    if (callback === 'fps') {
      await fpsField();
    }
    else {
      const tab = [...root().querySelectorAll<HTMLButtonElement>('.we-tab-trigger')]
        .find(button => button.textContent?.includes('Media'));
      if (!tab)
        throw new Error('Media tab did not render.');
      tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      tab.click();
      await flushPromises();
    }
    const button = [...root().querySelectorAll('button')]
      .find(button => button.textContent?.trim() === label);
    if (!button)
      throw new Error('Simulator send button did not render.');
    button.dispatchEvent(new PointerEvent('click', { bubbles: true, button: 0 }));

    const sent = commandMessages(port);
    expect(sent).toHaveLength(1);
    expect(ClientMessageValidator.Check(sent[0])).toBe(true);
    const message = ClientMessageValidator.Parse(structuredClone(sent[0]));
    if (message.kind !== 'command')
      throw new Error('Send button did not send a command.');
    expect(message.command).toEqual({ type: 'action', call: { name: action, args: [] } });
    expect(delivered).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
    applyDraftUpdate(hostStore, message.draft);
    executeCommand(hostStore, message.command);
    const expected = callback === 'artwork'
      ? { thumbnail: 'data:image/png;base64,artwork', primaryColor: '#aabbcc' }
      : callback === 'metadata'
        ? { title: 'Artwork test track' }
        : callback === 'timeline' ? { position: 42, duration: 180 } : { fps: 90 };
    expect(delivered).toHaveBeenCalledOnce();
    expect(delivered).toHaveBeenCalledWith(expect.objectContaining(expected));
    expect(notifyMock).toHaveBeenCalledOnce();
  });

  it('forwards header drag phases as typed shell commands without local callbacks', async () => {
    const { host, listenerFns, snapshot } = await boot();
    const port = createPort();
    const localListener = vi.fn();
    listenerFns.property = { applyUserProperties: localListener };
    dispatchConnection(host, port);
    port.receive(snapshot());
    await flushPromises();

    const header = root().querySelector<HTMLElement>('.we-command-bar');
    if (!header)
      throw new Error('Devtools header did not render.');
    header.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 8, clientX: 10, clientY: 20 }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 8, clientX: 30, clientY: 40 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, clientX: 50, clientY: 60 }));

    expect(commandMessages(port).map(message => message.command)).toEqual([
      { type: 'shell-drag', phase: 'start', x: 10, y: 20 },
      { type: 'shell-drag', phase: 'move', x: 30, y: 40 },
      { type: 'shell-drag', phase: 'end', x: 50, y: 60 },
    ]);
    expect(localListener).not.toHaveBeenCalled();
  });

  it('coalesces a large-artwork drag burst without draft payloads or command timeouts', async () => {
    const { host, listenerFns, snapshot } = await boot();
    const port = createPort();
    const localListener = vi.fn();
    listenerFns.property = { applyUserProperties: localListener };
    dispatchConnection(host, port);
    const initial = snapshot();
    initial.snapshot.state.mediaThumb.thumbnail = `data:image/png;base64,${'a'.repeat(1_000_000)}`;
    port.receive(initial);
    await flushPromises();

    const header = root().querySelector<HTMLElement>('.we-command-bar');
    if (!header)
      throw new Error('Devtools header did not render.');
    header.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 9, clientX: 0, clientY: 0 }));
    for (let index = 1; index <= 100; index += 1)
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, clientX: index, clientY: index * 2 }));

    expect(commandMessages(port)).toHaveLength(1);
    expect(commandMessages(port)[0]).toMatchObject({ command: { type: 'shell-drag', phase: 'start', x: 0, y: 0 }, draft: [] });
    const frame = [...animationFrames.values()].at(-1);
    if (!frame)
      throw new Error('Drag move did not schedule an animation frame.');
    frame(0);

    const drags = commandMessages(port);
    expect(drags).toHaveLength(2);
    expect(drags[1]).toMatchObject({ command: { type: 'shell-drag', phase: 'move', x: 100, y: 200 }, draft: [] });
    expect(drags.every(message => Array.isArray(message.draft) && message.draft.length === 0)).toBe(true);
    vi.advanceTimersByTime(3000);
    port.receive({ kind: 'ping' });
    vi.advanceTimersByTime(3000);
    expect(notifyMock).not.toHaveBeenCalledWith('The wallpaper did not respond to that command.');
    expect(localListener).not.toHaveBeenCalled();
  });

  it('checkpoints a local runtime draft incrementally without artwork or local callbacks', async () => {
    const { host, listenerFns, frontendStore, snapshot } = await boot();
    const port = createPort();
    const localListener = vi.fn();
    listenerFns.property = { applyUserProperties: localListener };
    dispatchConnection(host, port);
    port.receive(snapshot());
    await flushPromises();
    await fpsField();
    frontendStore.general.fps = 90;
    await flushPromises();
    expect(commandMessages(port)).toContainEqual(expect.objectContaining({ command: { type: 'checkpoint' }, draft: [expect.objectContaining({ path: '/general/fps', value: 90 })] }));
    expect(localListener).not.toHaveBeenCalled();
    expect(commandMessages(port).some(message => JSON.stringify(message).includes('artwork'))).toBe(false);
  });

  it('preserves a dirty local draft while applying a host patch', async () => {
    const { host, frontendStore, makeHostPatch, snapshot } = await boot();
    const port = createPort();
    dispatchConnection(host, port);
    const initial = snapshot();
    port.receive(initial);
    await flushPromises();
    const field = await fpsField();
    frontendStore.general.fps = 90;
    const patched = Value.Clone(initial.snapshot);
    patched.state.general.fps = 30;
    port.receive({ kind: 'patch', revision: 2, patch: makeHostPatch(initial.snapshot, patched) });
    await flushPromises();
    expect(field.value).toBe('90');
    expect(commandMessages(port)).toContainEqual(expect.objectContaining({ command: { type: 'checkpoint' }, draft: [expect.objectContaining({ path: '/general/fps', value: 90 })] }));
  });

  it('accepts an acknowledged draft before applying a newer host patch', async () => {
    const { host, frontendStore, makeHostPatch, snapshot } = await boot();
    const port = createPort();
    dispatchConnection(host, port);
    const initial = snapshot();
    port.receive(initial);
    await flushPromises();
    frontendStore.general.fps = 90;
    await flushPromises();
    const checkpoint = commandMessages(port).find(message => (message.command as { type?: string } | undefined)?.type === 'checkpoint');
    const id = checkpoint?.id;
    if (typeof id !== 'number')
      throw new Error('Checkpoint request was not sent.');
    port.receive({ kind: 'result', id });
    const remote = Value.Clone(initial.snapshot);
    remote.state.general.fps = 30;
    port.receive({ kind: 'patch', revision: 2, patch: makeHostPatch(initial.snapshot, remote) });
    await flushPromises();

    expect(frontendStore.general.fps).toBe(30);
    expect(commandMessages(port).filter(message => (message.command as { type?: string } | undefined)?.type === 'checkpoint')).toHaveLength(1);
  });

  it('resends an unacknowledged local draft after a stale port reconnects', async () => {
    const { host, frontendStore, snapshot } = await boot();
    const stale = createPort();
    const reconnected = createPort();
    dispatchConnection(host, stale);
    stale.receive(snapshot());
    await flushPromises();
    frontendStore.general.fps = 90;
    await flushPromises();
    expect(commandMessages(stale)).toContainEqual(expect.objectContaining({
      command: { type: 'checkpoint' },
      draft: [expect.objectContaining({ path: '/general/fps', value: 90 })],
    }));

    dispatchConnection(host, reconnected);
    reconnected.receive(snapshot());
    await flushPromises();

    expect(stale.closes).toBe(1);
    expect(commandMessages(reconnected)).toContainEqual(expect.objectContaining({
      command: { type: 'checkpoint' },
      draft: [expect.objectContaining({ path: '/general/fps', value: 90 })],
    }));
  });

  it('retries an unacknowledged checkpoint after its request times out', async () => {
    const { host, frontendStore, snapshot } = await boot();
    const port = createPort();
    dispatchConnection(host, port);
    port.receive(snapshot());
    await flushPromises();
    frontendStore.general.fps = 90;
    await flushPromises();
    vi.advanceTimersByTime(3000);
    port.receive({ kind: 'ping' });
    vi.advanceTimersByTime(2000);
    await flushPromises();

    const checkpoints = commandMessages(port).filter(message => (message.command as { type?: string } | undefined)?.type === 'checkpoint');
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints[1]).toMatchObject({ draft: [expect.objectContaining({ path: '/general/fps', value: 90 })] });
  });

  it('removes directory metadata that disappears from a host patch', async () => {
    const { host, frontendStore, makeHostPatch, snapshot } = await boot();
    const port = createPort();
    dispatchConnection(host, port);
    const initial = snapshot();
    initial.snapshot.state.propertyDisplayPaths = { assets: 'C:\\wallpaper\\assets' };
    initial.snapshot.state.directorySelections = { assets: { id: 'assets-selection', path: 'C:\\wallpaper\\assets' } };
    port.receive(initial);
    await flushPromises();
    expect(frontendStore.propertyDisplayPaths.assets).toBe('C:\\wallpaper\\assets');
    expect(frontendStore.directorySelections.assets?.path).toBe('C:\\wallpaper\\assets');

    const withoutAssets = Value.Clone(initial.snapshot);
    withoutAssets.state.propertyDisplayPaths = {};
    withoutAssets.state.directorySelections = {};
    port.receive({ kind: 'patch', revision: 2, patch: makeHostPatch(initial.snapshot, withoutAssets) });
    await flushPromises();

    expect(frontendStore.propertyDisplayPaths.assets).toBeUndefined();
    expect(frontendStore.directorySelections.assets).toBeUndefined();
  });

  it('forwards audio settings over the port without starting a local audio timer', async () => {
    const { host, audioSettings, audioState, listenerFns, snapshot } = await boot();
    const port = createPort();
    const localAudioListener = vi.fn();
    listenerFns.audio.push(localAudioListener);
    dispatchConnection(host, port);
    port.receive(snapshot());
    await flushPromises();
    audioSettings.output = 0.5;
    audioState.mode = 'sine';
    const { setAudioMode } = await import('../../src/audio');
    setAudioMode('sine');
    expect(commandMessages(port)).toContainEqual(expect.objectContaining({ command: { type: 'audio', mode: 'sine', settings: expect.objectContaining({ output: 0.5 }) } }));
    vi.advanceTimersByTime(100);
    expect(localAudioListener).not.toHaveBeenCalled();
  });

  it('rejects hostile connection messages, reconnects after a stale heartbeat, and disposes cleanly', async () => {
    const { host, hostPostMessage, snapshot } = await boot();
    const rejected = createPort();
    const connected = createPort();
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    dispatchConnection(host, rejected, 'https://invalid.example');
    dispatchConnection(window, rejected);
    dispatchConnection(host, rejected, window.location.origin, { kind: 'invalid' });
    expect(rejected.starts).toBe(0);
    dispatchConnection(host, connected);
    connected.receive(snapshot());
    now = 4000;
    vi.advanceTimersByTime(1000);
    expect(connected.closes).toBe(1);
    expect(hostPostMessage.mock.calls.length).toBeGreaterThan(1);
    stop?.();
    stop = undefined;
    const readyCount = hostPostMessage.mock.calls.length;
    vi.advanceTimersByTime(5000);
    expect(connected.closes).toBe(1);
    expect(hostPostMessage.mock.calls).toHaveLength(readyCount);
  });

  it('opens one separate window for rapid clicks and cleans up a rejected request', async () => {
    const { host, snapshot } = await boot();
    const port = createPort();
    dispatchConnection(host, port);
    port.receive(snapshot());
    await flushPromises();
    const close = vi.fn();
    const replace = vi.fn();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
    const open = vi.spyOn(window, 'open').mockReturnValue({ location: { replace }, close } as unknown as Window);
    const detach = root().querySelector<HTMLButtonElement>('button[aria-label="Open devtools in separate window"]');
    detach?.click();
    detach?.click();
    const request = commandMessages(port).find(message => (message.command as { type?: string } | undefined)?.type === 'shell');
    const id = request?.id;
    if (typeof id !== 'number')
      throw new Error('Separate-window request was not sent.');
    port.receive({ kind: 'result', id, error: 'Host rejected the request.' });
    expect(open).toHaveBeenCalledTimes(1);
    expect(commandMessages(port)).toContainEqual(expect.objectContaining({ command: { type: 'shell', action: 'detach', token: '00000000-0000-4000-8000-000000000000' } }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('session=00000000-0000-4000-8000-000000000000&view=popup'));
    expect(close).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith('Host rejected the request.');
  });

  it('stops popup retries after the wallpaper window closes', async () => {
    const { host, hostPostMessage } = await boot({ detached: true });
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    Object.defineProperty(host, 'closed', { value: true });
    vi.advanceTimersByTime(1000);
    const readyCalls = hostPostMessage.mock.calls.length;
    vi.advanceTimersByTime(5000);
    expect(hostPostMessage.mock.calls).toHaveLength(readyCalls);
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.querySelector('wallpaper-engine-devtools')).toBeNull();
  });
});
