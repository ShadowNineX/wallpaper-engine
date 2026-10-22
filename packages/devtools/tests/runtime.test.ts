import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { builtInValues } from './fixtures/properties';

interface FakePort {
  closed: boolean;
  messages: unknown[];
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  peer: FakePort | undefined;
  started: boolean;
  close: () => void;
  postMessage: (message: unknown) => void;
  start: () => void;
}

class TestPort implements FakePort {
  closed = false;
  messages: unknown[] = [];
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  peer: FakePort | undefined;
  started = false;

  close(): void {
    this.closed = true;
  }

  postMessage(message: unknown): void {
    if (this.closed || this.peer?.closed)
      return;
    this.messages.push(message);
    this.peer?.onmessage?.({ data: message } as MessageEvent<unknown>);
  }

  start(): void {
    this.started = true;
  }
}

class TestMessageChannel {
  static channels: TestMessageChannel[] = [];
  port1: TestPort;
  port2: TestPort;

  constructor() {
    this.port1 = new TestPort();
    this.port2 = new TestPort();
    this.port1.peer = this.port2;
    this.port2.peer = this.port1;
    TestMessageChannel.channels.push(this);
  }
}

interface TestWindowSource {
  closed: boolean;
  parent: TestWindowSource;
  postMessage: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function source(): TestWindowSource {
  const value = {
    closed: false,
    parent: undefined as unknown as TestWindowSource,
    postMessage: vi.fn(),
    close: vi.fn(),
  };
  value.parent = value;
  return value;
}

function dispatchReady(
  sourceWindow: TestWindowSource,
  token: string,
  origin = window.location.origin,
): void {
  window.dispatchEvent(new MessageEvent('message', {
    data: {
      source: 'wallpaper-engine-devtools',
      version: 1,
      kind: 'ready',
      token,
    },
    origin,
    source: sourceWindow as unknown as MessageEventSource,
  }));
}

function dockFrame(): HTMLIFrameElement {
  const host = document.querySelector('wallpaper-engine-devtools');
  const frame = host?.shadowRoot
    ?.querySelector('iframe');
  if (!(frame instanceof HTMLIFrameElement))
    throw new TypeError('Runtime did not create the devtools iframe.');
  return frame;
}

function sessionToken(frame: HTMLIFrameElement): string {
  const hash = new URL(frameUrl(frame)).hash;
  const token = hash.slice(1).split('=')[1];
  if (!token)
    throw new TypeError('Runtime iframe has no session token.');
  return decodeURIComponent(token);
}

const disposers: Array<() => void> = [];
let assignedIframeSrc = '';

function frameUrl(frame: HTMLIFrameElement): string {
  return assignedIframeSrc || frame.src;
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  assignedIframeSrc = '';
  TestMessageChannel.channels.length = 0;
  sessionStorage.clear();
  document.body.replaceChildren();
  window.__WE_DEVTOOLS_CONFIG__ = {
    properties: {
      speed: { type: 'slider', text: 'Speed', value: 2, min: 0, max: 5 },
    },
    localization: {},
  };
  window.__WE_DEVTOOLS_FRONTEND_URL__ = '/dev/__wallpaper-engine-devtools__/';
  vi.stubGlobal('MessageChannel', TestMessageChannel);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(HTMLIFrameElement.prototype, 'src', 'set').mockImplementation((value: string) => {
    assignedIframeSrc = new URL(value, window.location.href).href;
  });
});

afterEach(() => {
  for (const dispose of disposers.splice(0))
    dispose();
  document.body.replaceChildren();
  sessionStorage.clear();
  delete window.__WE_DEVTOOLS_CONFIG__;
  delete window.__WE_DEVTOOLS_FRONTEND_URL__;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function start() {
  const [{ startRuntime }, pinia] = await Promise.all([
    import('../src/runtime'),
    import('pinia'),
  ]);
  const dispose = startRuntime();
  disposers.push(dispose);
  return { dispose, pinia };
}

describe('devtools runtime bridge', () => {
  it.each([
    { name: 'script scheme', value: () => 'javascript:alert(1)' },
    { name: 'data document', value: () => 'data:text/html,<script>alert(1)</script>' },
    { name: 'remote origin', value: () => 'https://untrusted.example/devtools/' },
    { name: 'protocol-relative remote origin', value: () => '//untrusted.example/devtools/' },
    { name: 'embedded credentials', value: () => window.location.origin.replace('://', '://user:password@') },
    { name: 'malformed URL', value: () => 'http://[' },
  ])('rejects a frontend URL with $name before installing simulator state', async ({ value }) => {
    const [{ startRuntime }, pinia] = await Promise.all([import('../src/runtime'), import('pinia')]);
    const wallpaperPinia = pinia.createPinia();
    pinia.setActivePinia(wallpaperPinia);
    const originalListener = Object.getOwnPropertyDescriptor(window, 'wallpaperPropertyListener');
    const timers = vi.getTimerCount();
    window.__WE_DEVTOOLS_FRONTEND_URL__ = value();

    expect(() => startRuntime()).toThrow(TypeError);
    expect(document.querySelector('wallpaper-engine-devtools')).toBeNull();
    expect(Object.getOwnPropertyDescriptor(window, 'wallpaperPropertyListener')).toEqual(originalListener);
    expect(pinia.getActivePinia()).toBe(wallpaperPinia);
    expect(vi.getTimerCount()).toBe(timers);
  });

  it('ignores page query and hash content when resolving the frontend route', async () => {
    const originalUrl = window.location.href;
    try {
      window.history.replaceState(null, '', '/wallpaper/?redirect=javascript:alert(1)#https://untrusted.example/');
      await start();
      const url = new URL(frameUrl(dockFrame()));
      expect(url.origin).toBe(window.location.origin);
      expect(url.pathname).toBe('/dev/__wallpaper-engine-devtools__/');
      expect(url.search).toBe('');
      expect(url.hash).toMatch(/^#session=/);
    }
    finally {
      window.history.replaceState(null, '', originalUrl);
    }
  });

  it('starts one host synchronously, keeps the wallpaper Pinia active, and installs host listeners', async () => {
    const pinia = await import('pinia');
    const wallpaperPinia = pinia.createPinia();
    pinia.setActivePinia(wallpaperPinia);
    const { dispose } = await start();
    const duplicate = (await import('../src/runtime')).startRuntime();
    const listener = { applyUserProperties: vi.fn() };

    window.wallpaperPropertyListener = listener;
    await Promise.resolve();

    const frame = dockFrame();
    expect(document.querySelectorAll('wallpaper-engine-devtools')).toHaveLength(1);
    expect(duplicate).toBe(dispose);
    expect(pinia.getActivePinia()).toBe(wallpaperPinia);
    expect(new URL(frameUrl(frame)).pathname).toBe('/dev/__wallpaper-engine-devtools__/');
    expect(new URL(frameUrl(frame)).search).toBe('');
    expect(sessionToken(frame)).toHaveLength(36);
    expect(listener.applyUserProperties).toHaveBeenCalledExactlyOnceWith({
      ...builtInValues,
      speed: { value: 2 },
    });
  });

  it('accepts only the dock iframe ready message and transfers a snapshot channel', async () => {
    await start();
    const frame = dockFrame();
    const dock = source();
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: dock });
    const token = sessionToken(frame);

    dispatchReady(dock, 'wrong-token');
    dispatchReady(source(), token);
    dispatchReady(dock, token, 'https://untrusted.example');
    expect(dock.postMessage).not.toHaveBeenCalled();

    dispatchReady(dock, token);

    expect(dock.postMessage).toHaveBeenCalledExactlyOnceWith(
      {
        source: 'wallpaper-engine-devtools',
        version: 1,
        kind: 'connected',
      },
      window.location.origin,
      [expect.any(TestPort)],
    );
    const channel = TestMessageChannel.channels[0];
    if (!channel)
      throw new TypeError('Runtime did not create a message channel.');
    expect(channel.port1.started).toBe(true);
    expect(channel.port1.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'snapshot' }),
      expect.objectContaining({ kind: 'performance' }),
      expect.objectContaining({ kind: 'audio' }),
    ]));

    channel.port2.postMessage({
      kind: 'command',
      id: 1,
      command: { type: 'shell', action: 'bottom' },
      draft: [],
    });
    await Promise.resolve();
    expect(dockFrame().parentElement?.style).toMatchObject({
      height: '420px',
      width: '100%',
    });
  });

  it('closes and reopens the live iframe through shell commands', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    await start();
    const frame = dockFrame();
    const dock = source();
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: dock });
    dispatchReady(dock, sessionToken(frame));
    const channel = TestMessageChannel.channels[0];
    if (!channel)
      throw new TypeError('Runtime did not create a message channel.');
    const send = (id: number, action: 'close' | 'attach') => {
      channel.port2.postMessage({
        kind: 'command',
        id,
        command: { type: 'shell', action },
        draft: [],
      });
    };

    send(1, 'close');
    await Promise.resolve();
    const shadow = document.querySelector('wallpaper-engine-devtools')?.shadowRoot;
    const pane = shadow?.querySelector<HTMLElement>('.pane');
    const launcher = shadow?.querySelector<HTMLButtonElement>('.launcher');
    expect(pane?.style.display).toBe('none');
    expect(launcher?.hidden).toBe(false);

    launcher?.click();
    expect(pane?.style.display).toBe('flex');
    expect(launcher?.hidden).toBe(false);

    send(2, 'attach');
    await Promise.resolve();
    expect(pane?.style.display).toBe('flex');
  });

  it('starts collapsed behind a movable island and toggles the dock on click', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    await start();
    const shadow = document.querySelector('wallpaper-engine-devtools')?.shadowRoot;
    const pane = shadow?.querySelector<HTMLElement>('.pane');
    const launcher = shadow?.querySelector<HTMLButtonElement>('.launcher');
    if (!pane || !launcher)
      throw new TypeError('Runtime did not create the devtools island.');

    expect(pane.style.display).toBe('none');
    expect(launcher.hidden).toBe(false);
    launcher.click();
    expect(pane.style.display).toBe('flex');
    launcher.click();
    expect(pane.style.display).toBe('none');

    launcher.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 2, clientY: 2 }));
    launcher.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 32, clientY: 22 }));
    launcher.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 32, clientY: 22 }));
    expect(launcher.style.left).toBe('30px');
    expect(launcher.style.top).toBe('20px');
    expect(sessionStorage.getItem(`we-devtools:${window.location.pathname}:island`)).toContain('30');
  });

  it('keeps island clicks working after secondary-button and canceled drags', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    await start();
    const shadow = document.querySelector('wallpaper-engine-devtools')?.shadowRoot;
    const pane = shadow?.querySelector<HTMLElement>('.pane');
    const launcher = shadow?.querySelector<HTMLButtonElement>('.launcher');
    if (!pane || !launcher)
      throw new TypeError('Runtime did not create the devtools island.');
    const pointer = (type: string, button = 0, x = 0) => {
      launcher.dispatchEvent(new PointerEvent(type, { pointerId: 1, button, clientX: x, clientY: 0 }));
    };

    pointer('pointerdown', 2);
    pointer('pointermove', 2, 30);
    pointer('pointerup', 2, 30);
    expect(launcher.style.left).toBe('');
    launcher.click();
    expect(pane.style.display).toBe('flex');

    pointer('pointerdown');
    pointer('pointermove', 0, 30);
    pointer('pointercancel', 0, 30);
    expect(launcher.dataset.dragging).toBe('false');
    launcher.click();
    expect(pane.style.display).toBe('none');

    pointer('pointerdown');
    pointer('pointermove', 0, 30);
    pointer('pointerup', 0, 30);
    launcher.click();
    expect(pane.style.display).toBe('none');
    pointer('pointerdown');
    pointer('pointerup');
    launcher.click();
    expect(pane.style.display).toBe('flex');
  });

  it('animates island toggles with cancellable surface and content motion', async () => {
    const resolvers: Array<() => void> = [];
    const animations: Array<{ cancel: ReturnType<typeof vi.fn>; finished: Promise<void> }> = [];
    const animate = vi.spyOn(Element.prototype, 'animate').mockImplementation(() => {
      let resolve: () => void = () => {};
      const finished = new Promise<void>((done) => {
        resolve = done;
      });
      resolvers.push(resolve);
      const animation = { cancel: vi.fn(), finished };
      animations.push(animation);
      return animation as unknown as Animation;
    });
    const { dispose } = await start();
    const shadow = document.querySelector('wallpaper-engine-devtools')?.shadowRoot;
    const pane = shadow?.querySelector<HTMLElement>('.pane');
    const launcher = shadow?.querySelector<HTMLButtonElement>('.launcher');
    if (!pane || !launcher)
      throw new TypeError('Runtime did not create the motion surfaces.');
    vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 50,
      left: 100,
      top: 50,
      width: 440,
      height: 600,
      right: 540,
      bottom: 650,
      toJSON: () => ({}),
    });
    vi.spyOn(launcher, 'getBoundingClientRect').mockReturnValue({
      x: 20,
      y: 700,
      left: 20,
      top: 700,
      width: 110,
      height: 60,
      right: 130,
      bottom: 760,
      toJSON: () => ({}),
    });

    launcher.click();
    expect(pane.style.display).toBe('flex');
    expect(pane.style.transformOrigin).toBe('0 0');
    expect(pane.getAttribute('inert')).not.toBeNull();
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate).toHaveBeenNthCalledWith(1, expect.arrayContaining([expect.objectContaining({ transform: 'translate(-80px, 650px) scale(0.25, 0.1)' })]), expect.objectContaining({ duration: 240 }));
    for (const resolve of resolvers.splice(0)) resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(pane.getAttribute('inert')).toBeNull();

    launcher.click();
    expect(pane.style.display).toBe('flex');
    const closing = animations.slice(-2);
    launcher.click();
    expect(closing.every(animation => animation.cancel.mock.calls.length === 1)).toBe(true);
    expect(sessionStorage.getItem(`we-devtools:${window.location.pathname}:open`)).toBe('open');
    for (const resolve of resolvers.splice(0)) resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(pane.style.display).toBe('flex');

    launcher.click();
    dispose();
    expect(animations.slice(-2).every(animation => animation.cancel.mock.calls.length === 1)).toBe(true);
  });

  it.each([
    { placement: 'right', panel: new DOMRect(100, 0, 440, 1360), transform: 'translate(-80px, 1200px) scale(0.25, 0.025)', radius: [68, 680] },
    { placement: 'bottom', panel: new DOMRect(0, 900, 2200, 400), transform: 'translate(20px, 300px) scale(0.05, 0.085)', radius: [340, 200] },
  ])('matches the island bounds and pill corners during $placement dock animation', async ({ placement, panel, transform, radius }) => {
    sessionStorage.setItem(`we-devtools:${window.location.pathname}:placement`, placement);
    await start();
    const shadow = document.querySelector('wallpaper-engine-devtools')?.shadowRoot;
    const pane = shadow?.querySelector<HTMLElement>('.pane');
    const launcher = shadow?.querySelector<HTMLButtonElement>('.launcher');
    if (!pane || !launcher)
      throw new TypeError('Runtime did not create the motion surfaces.');
    vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue(panel);
    vi.spyOn(launcher, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 1200, 110, 34));
    const animate = vi.spyOn(pane, 'animate').mockReturnValue({ cancel: vi.fn(), finished: Promise.resolve() } as unknown as Animation);
    vi.spyOn(dockFrame(), 'animate').mockReturnValue({ cancel: vi.fn(), finished: Promise.resolve() } as unknown as Animation);

    launcher.click();
    const frames = animate.mock.calls[0]?.[0] as Keyframe[];
    const islandFrame = frames[0];
    expect(islandFrame).toMatchObject({ transform, opacity: 0 });
    const radii = String(islandFrame?.borderRadius).split(' / ').map(Number.parseFloat);
    expect(radii[0]).toBeCloseTo(radius[0]!);
    expect(radii[1]).toBeCloseTo(radius[1]!);
    const panelFrame = { transform: 'none', borderRadius: '12px', opacity: 1 };
    expect(frames[1]).toEqual(panelFrame);

    await Promise.resolve();
    await Promise.resolve();
    launcher.click();
    expect(animate.mock.calls[1]?.[0]).toEqual([panelFrame, islandFrame]);
    await Promise.resolve();
    await Promise.resolve();
    expect(pane.style.display).toBe('none');
  });

  it('changes visibility immediately when animation is unavailable', async () => {
    vi.spyOn(Element.prototype, 'animate').mockImplementation(() => {
      throw new TypeError('Web Animations unavailable');
    });
    await start();
    const shadow = document.querySelector('wallpaper-engine-devtools')?.shadowRoot;
    const pane = shadow?.querySelector<HTMLElement>('.pane');
    const launcher = shadow?.querySelector<HTMLButtonElement>('.launcher');
    if (!pane || !launcher)
      throw new TypeError('Runtime did not create the fallback surfaces.');

    launcher.click();
    expect(pane.style.display).toBe('flex');
    launcher.click();
    expect(pane.style.display).toBe('none');
  });

  it('floats and clamps a dragged panel using iframe-relative coordinates', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1400 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
    await start();
    const frame = dockFrame();
    const dock = source();
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: dock });
    dispatchReady(dock, sessionToken(frame));
    const channel = TestMessageChannel.channels[0];
    const pane = document.querySelector('wallpaper-engine-devtools')?.shadowRoot?.querySelector<HTMLElement>('.pane');
    if (!channel || !pane)
      throw new TypeError('Runtime did not create the drag test surface.');
    vi.spyOn(pane, 'getBoundingClientRect').mockImplementation(() => ({
      x: Number.parseFloat(pane.style.left) || 900,
      y: Number.parseFloat(pane.style.top) || 0,
      left: Number.parseFloat(pane.style.left) || 900,
      top: Number.parseFloat(pane.style.top) || 0,
      width: Number.parseFloat(pane.style.width) || 440,
      height: Number.parseFloat(pane.style.height) || 900,
      right: 0,
      bottom: 0,
      toJSON: () => ({}),
    }));

    channel.port2.postMessage({ kind: 'command', id: 1, command: { type: 'shell-drag', phase: 'start', x: 100, y: 40 }, draft: [] });
    channel.port2.postMessage({ kind: 'command', id: 2, command: { type: 'shell-drag', phase: 'move', x: 130, y: 70 }, draft: [] });
    channel.port2.postMessage({ kind: 'command', id: 3, command: { type: 'shell-drag', phase: 'end', x: 130, y: 70 }, draft: [] });
    await Promise.resolve();

    expect(pane.style).toMatchObject({ left: '930px', top: '30px', width: '440px', height: '600px' });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 });
    window.dispatchEvent(new Event('resize'));
    expect(pane.style.left).toBe('60px');
  });

  it('preserves the physical header grab point when floating from a wide bottom dock', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1400 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
    await start();
    const frame = dockFrame();
    const dock = source();
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: dock });
    dispatchReady(dock, sessionToken(frame));
    const channel = TestMessageChannel.channels[0];
    const pane = document.querySelector('wallpaper-engine-devtools')?.shadowRoot?.querySelector<HTMLElement>('.pane');
    if (!channel || !pane)
      throw new TypeError('Runtime did not create the bottom drag surface.');
    channel.port2.postMessage({ kind: 'command', id: 1, command: { type: 'shell', action: 'bottom' }, draft: [] });
    vi.spyOn(pane, 'getBoundingClientRect').mockImplementation(() => ({
      x: Number.parseFloat(pane.style.left) || 0,
      y: Number.parseFloat(pane.style.top) || 480,
      left: Number.parseFloat(pane.style.left) || 0,
      top: Number.parseFloat(pane.style.top) || 480,
      width: Number.parseFloat(pane.style.width) || 1400,
      height: Number.parseFloat(pane.style.height) || 420,
      right: 0,
      bottom: 0,
      toJSON: () => ({}),
    }));

    channel.port2.postMessage({ kind: 'command', id: 2, command: { type: 'shell-drag', phase: 'start', x: 900, y: 20 }, draft: [] });
    channel.port2.postMessage({ kind: 'command', id: 3, command: { type: 'shell-drag', phase: 'move', x: 446, y: 30 }, draft: [] });
    await Promise.resolve();

    expect(pane.style).toMatchObject({ left: '514px', top: '480px', width: '440px', height: '420px' });
  });

  it('transfers authority from the dock to an accepted popup and redocks when it closes', async () => {
    await start();
    const frame = dockFrame();
    const dock = source();
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: dock });
    dispatchReady(dock, sessionToken(frame));
    const dockChannel = TestMessageChannel.channels[0];
    if (!dockChannel)
      throw new TypeError('Runtime did not create the dock channel.');
    const popupToken = 'popup-session-token';
    dockChannel.port2.postMessage({
      kind: 'command',
      id: 1,
      command: { type: 'shell', action: 'detach', token: popupToken },
      draft: [],
    });
    const popup = source();

    dispatchReady(popup, popupToken);

    const shadow = document.querySelector('wallpaper-engine-devtools')?.shadowRoot;
    expect(shadow?.querySelector<HTMLElement>('.pane')?.style.display).toBe('none');
    expect(shadow?.querySelector<HTMLButtonElement>('.launcher')?.getAttribute('aria-label')).toBe('Return devtools to wallpaper');
    expect(TestMessageChannel.channels).toHaveLength(2);
    expect(dockChannel.port1.closed).toBe(true);

    dispatchReady(dock, sessionToken(frame));
    dockChannel.port2.postMessage({
      kind: 'command',
      id: 2,
      command: { type: 'shell', action: 'bottom' },
      draft: [],
    });
    await Promise.resolve();
    expect(dock.postMessage).toHaveBeenCalledOnce();
    expect(shadow?.querySelector<HTMLElement>('.pane')?.style.display).toBe('none');

    const popupChannel = TestMessageChannel.channels[1];
    if (!popupChannel)
      throw new TypeError('Runtime did not create the popup channel.');
    popupChannel.port2.postMessage({
      kind: 'command',
      id: 3,
      command: { type: 'shell', action: 'bottom' },
      draft: [],
    });
    await Promise.resolve();
    expect(shadow?.querySelector<HTMLElement>('.pane')?.style).toMatchObject({
      display: 'flex',
      height: '420px',
      width: '100%',
    });

    popup.closed = true;
    vi.advanceTimersByTime(500);
    expect(shadow?.querySelector<HTMLElement>('.pane')?.style.display).toBe('flex');
    expect(shadow?.querySelector<HTMLButtonElement>('.launcher')?.hidden).toBe(false);
    expect(dockFrame().isConnected).toBe(true);
  });

  it('reconnects a popup that presents the pending token after the host reloads', async () => {
    const { dispose } = await start();
    const frame = dockFrame();
    const dock = source();
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: dock });
    dispatchReady(dock, sessionToken(frame));
    const dockChannel = TestMessageChannel.channels[0];
    if (!dockChannel)
      throw new TypeError('Runtime did not create the dock channel.');
    const popupToken = 'restored-popup-token';
    dockChannel.port2.postMessage({
      kind: 'command',
      id: 1,
      command: { type: 'shell', action: 'detach', token: popupToken },
      draft: [],
    });
    await Promise.resolve();

    dispose();
    await start();
    const popup = source();
    dispatchReady(popup, popupToken);

    const shadow = document.querySelector('wallpaper-engine-devtools')?.shadowRoot;
    expect(popup.postMessage).toHaveBeenCalledOnce();
    expect(TestMessageChannel.channels).toHaveLength(2);
    expect(shadow?.querySelector<HTMLElement>('.pane')?.style.display).toBe('none');
    expect(shadow?.querySelector<HTMLButtonElement>('.launcher')?.getAttribute('aria-label')).toBe('Return devtools to wallpaper');
  });

  it('resizes only along the dock placement axis from the keyboard', async () => {
    await start();
    const frame = dockFrame();
    const dock = source();
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: dock });
    dispatchReady(dock, sessionToken(frame));
    const channel = TestMessageChannel.channels[0];
    if (!channel)
      throw new TypeError('Runtime did not create a message channel.');
    const shadow = document.querySelector('wallpaper-engine-devtools')?.shadowRoot;
    const pane = shadow?.querySelector<HTMLElement>('.pane');
    const resize = shadow?.querySelector<HTMLButtonElement>('.resize');
    if (!pane || !resize)
      throw new TypeError('Runtime did not create the dock resize handle.');

    resize.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(pane.style.width).toBe('440px');
    resize.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(pane.style.width).toBe('460px');

    channel.port2.postMessage({
      kind: 'command',
      id: 1,
      command: { type: 'shell', action: 'bottom' },
      draft: [],
    });
    await Promise.resolve();
    resize.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(pane.style.height).toBe('420px');
    resize.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(pane.style.height).toBe('440px');
  });

  it('ignores malformed port messages and cleans up the host, globals, and channels', async () => {
    const pinia = await import('pinia');
    const wallpaperPinia = pinia.createPinia();
    pinia.setActivePinia(wallpaperPinia);
    const { dispose } = await start();
    const frame = dockFrame();
    const dock = source();
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: dock });
    dispatchReady(dock, sessionToken(frame));
    const channel = TestMessageChannel.channels[0];
    if (!channel)
      throw new TypeError('Runtime did not create a message channel.');
    channel.port2.postMessage({ kind: 'command', id: 1, command: { type: 'shell', action: 'close' }, draft: { nope: true } });
    channel.port2.postMessage({ kind: 'not-a-command' });
    await Promise.resolve();
    expect(document.querySelector('wallpaper-engine-devtools')).not.toBeNull();

    window.wallpaperRegisterAudioListener(vi.fn());
    dispose();
    expect(document.querySelector('wallpaper-engine-devtools')).toBeNull();
    expect(channel.port1.closed).toBe(true);
    expect(channel.port1.messages).toEqual(expect.arrayContaining([
      { kind: 'disconnect' },
    ]));
    expect(window.wallpaperRegisterAudioListener).toBeUndefined();
    expect(pinia.getActivePinia()).toBe(wallpaperPinia);
  });
});
