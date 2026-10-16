import type { Command, DockPlacement } from './bridge/protocol';
import { createPinia, disposePinia, getActivePinia, setActivePinia } from 'pinia';
import { createBackend } from './bridge/backend';
import { ReadyValidator } from './bridge/connection';
import { BRIDGE_SOURCE, BRIDGE_VERSION } from './bridge/protocol';
import { releaseDevFiles } from './dev-files';

const RUNTIME_KEY = Symbol.for('wallpaper-engine.devtools.runtime');
type RuntimeWindow = Window & { [RUNTIME_KEY]?: { host: HTMLElement; dispose: () => void } };

function readSetting(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  }
  catch {
    return null;
  }
}
function writeSetting(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  }
  catch { /* Restricted storage must not prevent local tooling. */ }
}
interface Point { left: number; top: number }
function readPoint(key: string): Point | undefined {
  try {
    const value: unknown = JSON.parse(readSetting(key) ?? 'null');
    if (typeof value === 'object' && value !== null
      && 'left' in value && 'top' in value
      && typeof value.left === 'number' && Number.isFinite(value.left)
      && typeof value.top === 'number' && Number.isFinite(value.top)) {
      return { left: value.left, top: value.top };
    }
  }
  catch { /* An old preference must not prevent local tooling. */ }
  return undefined;
}

/** Install the simulator before wallpaper modules register their listeners. */
export function startRuntime(): () => void {
  const target = window as RuntimeWindow;
  if (target[RUNTIME_KEY]?.host.isConnected)
    return target[RUNTIME_KEY]!.dispose;
  target[RUNTIME_KEY]?.dispose();
  const previousPinia = getActivePinia();
  const pinia = createPinia();
  const host = document.createElement('wallpaper-engine-devtools');
  host.id = 'we-devtools-root';
  for (const [property, value] of Object.entries({ 'all': 'initial', 'position': 'fixed', 'inset': '0', 'pointer-events': 'none', 'z-index': '2147483647' }))
    host.style.setProperty(property, value, 'important');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host { color-scheme: dark; }
    .pane { position:fixed; display:flex; overflow:hidden; transform-origin:0 0; pointer-events:auto; background:#181c22; border-radius:12px; box-shadow:0 12px 36px #03071266; }
    iframe { display:block; width:100%; height:100%; border:0; }
    button { font:500 12px/1.4 system-ui,sans-serif; color:#edf1f9; background:#181c22; border:1px solid #444b57; cursor:pointer; }
    button:focus-visible { outline:2px solid #6c92f6; outline-offset:3px; }
    .launcher { position:fixed; right:16px; bottom:16px; display:flex; align-items:center; gap:8px; min-height:34px; padding:0 12px; border-radius:999px; pointer-events:auto; box-shadow:0 8px 28px #03071266; user-select:none; }
    .launcher[data-dragging=true] { cursor:grabbing; }
    .status { width:7px; height:7px; border-radius:999px; background:#79d2a6; box-shadow:0 0 0 3px #79d2a622; }
    .resize { position:absolute; z-index:1; padding:0; border:0; background:transparent; }
    .resize:hover,.resize:focus-visible { background:#6c92f655; }
  `;
  shadow.appendChild(style);
  const pane = document.createElement('section');
  pane.className = 'pane';
  pane.setAttribute('aria-label', 'Wallpaper devtools dock');
  pane.style.transformOrigin = '0 0';
  pane.style.overflow = 'hidden';
  const frame = document.createElement('iframe');
  frame.title = 'Wallpaper Engine Devtools';
  const token = crypto.randomUUID();
  const url = new URL(window.__WE_DEVTOOLS_FRONTEND_URL__ ?? '/__wallpaper-engine-devtools__/', window.location.href);
  url.hash = new URLSearchParams({ session: token }).toString();
  frame.src = url.href;
  const resize = document.createElement('button');
  resize.className = 'resize';
  resize.type = 'button';
  resize.setAttribute('aria-label', 'Resize devtools dock');
  pane.append(resize, frame);
  const launcher = document.createElement('button');
  launcher.className = 'launcher';
  launcher.type = 'button';
  launcher.innerHTML = '<span class="status" aria-hidden="true"></span><span>WE Devtools</span>';
  launcher.setAttribute('aria-label', 'Open devtools');
  shadow.append(pane, launcher);
  const storageKey = `we-devtools:${window.location.pathname}`;
  const savedPlacement = readSetting(`${storageKey}:placement`);
  let placement: DockPlacement = savedPlacement === 'bottom' || savedPlacement === 'floating' ? savedPlacement : 'right';
  let popupToken = readSetting(`${storageKey}:popup`);
  let popup: Window | undefined;
  let detached = false;
  let closed = readSetting(`${storageKey}:open`) !== 'open';
  let panelTargetOpen = !closed;
  let disposed = false;
  let width = 440;
  let height = 420;
  let floating = readPoint(`${storageKey}:floating`);
  let island = readPoint(`${storageKey}:island`);
  const sessions = new Map<Window, () => void>();
  let motionGeneration = 0;
  let paneAnimation: Animation | undefined;
  let frameAnimation: Animation | undefined;

  function closePopup(): void {
    if (popup) {
      sessions.get(popup)?.();
      sessions.delete(popup);
      popup.close();
      popup = undefined;
    }
    detached = false;
    popupToken = null;
    writeSetting(`${storageKey}:popup`, '');
  }

  function layout(): void {
    const right = placement === 'right';
    const floatingPane = placement === 'floating';
    if (floatingPane) {
      width = Math.min(Math.max(320, width), window.innerWidth);
      height = Math.min(Math.max(240, height), window.innerHeight);
      floating = clampPoint(floating ?? { left: window.innerWidth - width, top: 0 }, width, height);
    }
    Object.assign(pane.style, {
      display: closed || detached ? 'none' : 'flex',
      right: floatingPane ? 'auto' : '0',
      bottom: floatingPane ? 'auto' : '0',
      left: floatingPane ? `${floating!.left}px` : right ? 'auto' : '0',
      top: floatingPane ? `${floating!.top}px` : right ? '0' : 'auto',
      width: floatingPane || right ? `${Math.min(width, window.innerWidth)}px` : '100%',
      height: floatingPane ? `${Math.min(height, window.innerHeight)}px` : right ? '100%' : `${Math.min(height, window.innerHeight)}px`,
    });
    Object.assign(resize.style, {
      left: floatingPane ? 'auto' : right ? '0' : '0',
      top: floatingPane ? 'auto' : '0',
      right: floatingPane ? '0' : right ? 'auto' : '0',
      bottom: floatingPane ? '0' : right ? '0' : 'auto',
      width: floatingPane ? '14px' : right ? '6px' : '100%',
      height: floatingPane ? '14px' : right ? '100%' : '6px',
      cursor: floatingPane ? 'nwse-resize' : right ? 'col-resize' : 'row-resize',
    });
    if (island) {
      island = clampPoint(island, launcher.offsetWidth, launcher.offsetHeight);
      Object.assign(launcher.style, { left: `${island.left}px`, top: `${island.top}px`, right: 'auto', bottom: 'auto' });
    }
    launcher.setAttribute('aria-label', detached ? 'Return devtools to wallpaper' : panelTargetOpen ? 'Hide devtools' : 'Open devtools');
  }

  function clampPoint(point: Point, paneWidth: number, paneHeight: number): Point {
    return {
      left: Math.max(0, Math.min(point.left, Math.max(0, window.innerWidth - paneWidth))),
      top: Math.max(0, Math.min(point.top, Math.max(0, window.innerHeight - paneHeight))),
    };
  }

  function saveFloating(): void {
    if (floating)
      writeSetting(`${storageKey}:floating`, JSON.stringify(floating));
  }

  function setPaneInteractivity(interactive: boolean): void {
    pane.style.pointerEvents = interactive ? 'auto' : 'none';
    if (interactive)
      pane.removeAttribute('inert');
    else
      pane.setAttribute('inert', '');
  }

  function cancelPanelMotion(): void {
    paneAnimation?.cancel();
    frameAnimation?.cancel();
    paneAnimation = undefined;
    frameAnimation = undefined;
    pane.style.removeProperty('will-change');
    pane.style.removeProperty('transform');
    pane.style.removeProperty('opacity');
    frame.style.removeProperty('opacity');
  }

  function panelOrigin(from: DOMRect, to: DOMRect): Keyframe {
    const scaleX = Math.max(1, from.width) / Math.max(1, to.width);
    const scaleY = Math.max(1, from.height) / Math.max(1, to.height);
    const radius = Math.max(1, Math.min(from.width, from.height)) / 2;
    return {
      transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scaleX}, ${scaleY})`,
      // Compensate each axis so the scaled surface keeps the island's pill shape.
      borderRadius: `${radius / scaleX}px / ${radius / scaleY}px`,
      opacity: 0,
    };
  }

  function setPanelOpen(open: boolean, animate: boolean): void {
    panelTargetOpen = open;
    const generation = ++motionGeneration;
    cancelPanelMotion();
    if (!animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      closed = !open;
      layout();
      setPaneInteractivity(open);
      return;
    }
    closed = false;
    layout();
    setPaneInteractivity(false);
    const paneRect = pane.getBoundingClientRect();
    const islandRect = launcher.getBoundingClientRect();
    const origin = panelOrigin(islandRect, paneRect);
    const expanded = { transform: 'none', borderRadius: '12px', opacity: 1 };
    const keyframes = open
      ? [origin, expanded]
      : [expanded, origin];
    try {
      pane.style.willChange = 'transform, opacity';
      paneAnimation = pane.animate(keyframes, {
        duration: open ? 240 : 160,
        easing: open ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'both',
      });
      frameAnimation = frame.animate(open ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], {
        duration: open ? 160 : 110,
        delay: open ? 50 : 0,
        easing: 'ease-out',
        fill: 'both',
      });
      void Promise.allSettled([paneAnimation.finished, frameAnimation.finished]).then(() => {
        if (generation !== motionGeneration || disposed)
          return;
        cancelPanelMotion();
        closed = !open;
        layout();
        setPaneInteractivity(open);
      });
    }
    catch {
      cancelPanelMotion();
      closed = !open;
      layout();
      setPaneInteractivity(open);
    }
  }

  const backend = createBackend(pinia, (command) => {
    if (command.type === 'shell-drag') {
      handlePaneDrag(command);
      return;
    }
    switch (command.action) {
      case 'right': case 'bottom':
        placement = command.action;
        writeSetting(`${storageKey}:placement`, placement);
        closePopup();
        setPanelOpen(true, false);
        writeSetting(`${storageKey}:open`, 'open');
        break;
      case 'close':
        closePopup();
        setPanelOpen(false, true);
        writeSetting(`${storageKey}:open`, 'closed');
        break;
      case 'attach':
        closePopup();
        setPanelOpen(true, false);
        writeSetting(`${storageKey}:open`, 'open');
        break;
      case 'detach':
        popupToken = command.token ?? null;
        writeSetting(`${storageKey}:popup`, popupToken ?? '');
        break;
      default: throw new TypeError('Unknown dock action.');
    }
    backend.updateShell(placement, detached);
    layout();
  });
  setActivePinia(previousPinia);
  function attach(): void {
    closePopup();
    setPanelOpen(true, false);
    writeSetting(`${storageKey}:open`, 'open');
    layout();
    backend.updateShell(placement, false);
  }
  let islandDragging: { pointerId: number; startX: number; startY: number; point: Point } | undefined;
  let suppressIslandClick = false;
  launcher.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || islandDragging)
      return;
    suppressIslandClick = false;
    islandDragging = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, point: island ?? { left: launcher.offsetLeft, top: launcher.offsetTop } };
    launcher.setPointerCapture?.(event.pointerId);
  });
  launcher.addEventListener('pointermove', (event) => {
    if (!islandDragging || islandDragging.pointerId !== event.pointerId)
      return;
    const x = event.clientX - islandDragging.startX;
    const y = event.clientY - islandDragging.startY;
    if (Math.abs(x) + Math.abs(y) < 3)
      return;
    suppressIslandClick = true;
    launcher.dataset.dragging = 'true';
    island = clampPoint({ left: islandDragging.point.left + x, top: islandDragging.point.top + y }, launcher.offsetWidth, launcher.offsetHeight);
    writeSetting(`${storageKey}:island`, JSON.stringify(island));
    layout();
  });
  const stopIslandDrag = (event: PointerEvent) => {
    if (!islandDragging || islandDragging.pointerId !== event.pointerId)
      return;
    islandDragging = undefined;
    launcher.dataset.dragging = 'false';
    if (event.type === 'pointercancel')
      suppressIslandClick = false;
  };
  launcher.addEventListener('pointerup', stopIslandDrag);
  launcher.addEventListener('pointercancel', stopIslandDrag);
  launcher.addEventListener('click', () => {
    if (suppressIslandClick) {
      suppressIslandClick = false;
      return;
    }
    if (detached) {
      attach();
      return;
    }
    const next = !panelTargetOpen;
    setPanelOpen(next, true);
    writeSetting(`${storageKey}:open`, next ? 'open' : 'closed');
  });
  launcher.addEventListener('keydown', (event) => {
    let delta: [number, number] | undefined;
    switch (event.key) {
      case 'ArrowLeft':
        delta = [-20, 0];
        break;
      case 'ArrowRight':
        delta = [20, 0];
        break;
      case 'ArrowUp':
        delta = [0, -20];
        break;
      case 'ArrowDown':
        delta = [0, 20];
        break;
    }
    if (!delta)
      return;
    event.preventDefault();
    island = clampPoint({ left: (island?.left ?? launcher.offsetLeft) + delta[0], top: (island?.top ?? launcher.offsetTop) + delta[1] }, launcher.offsetWidth, launcher.offsetHeight);
    writeSetting(`${storageKey}:island`, JSON.stringify(island));
    layout();
  });

  let paneDrag: { grabX: number; grabY: number } | undefined;
  function handlePaneDrag(command: Extract<Command, { type: 'shell-drag' }>): void {
    if (command.phase === 'end') {
      paneDrag = undefined;
      return;
    }
    if (command.phase === 'start') {
      const rect = pane.getBoundingClientRect();
      if (placement !== 'floating') {
        const hostPointer = { left: rect.left + command.x, top: rect.top + command.y };
        const previousPlacement = placement;
        width = Math.min(440, window.innerWidth);
        height = previousPlacement === 'bottom'
          ? Math.min(height, window.innerHeight)
          : Math.min(Math.max(600, height), window.innerHeight);
        const intendedGrab = {
          left: Math.min(Math.max(0, command.x), Math.max(0, width - 24)),
          top: Math.min(Math.max(0, command.y), Math.max(0, height - 24)),
        };
        floating = clampPoint({ left: hostPointer.left - intendedGrab.left, top: hostPointer.top - intendedGrab.top }, width, height);
        placement = 'floating';
        writeSetting(`${storageKey}:placement`, placement);
        saveFloating();
        layout();
        backend.updateShell(placement, detached);
        paneDrag = { grabX: hostPointer.left - floating.left, grabY: hostPointer.top - floating.top };
        return;
      }
      paneDrag = { grabX: command.x, grabY: command.y };
      return;
    }
    if (!paneDrag || placement !== 'floating')
      return;
    const rect = pane.getBoundingClientRect();
    floating = clampPoint({ left: rect.left + command.x - paneDrag.grabX, top: rect.top + command.y - paneDrag.grabY }, width, height);
    saveFloating();
    layout();
  }

  function onReady(event: MessageEvent<unknown>): void {
    if (event.origin !== url.origin || !ReadyValidator.Check(event.data) || !event.source)
      return;
    const source = event.source as Window;
    const isDock = source === frame.contentWindow && event.data.token === token;
    const isPopup = event.data.token === popupToken && source !== window
      && source.parent === source && (!popup || popup === source);
    if (!isDock && !isPopup)
      return;
    if (isDock && detached)
      return;
    if (isPopup) {
      const dockWindow = frame.contentWindow;
      if (dockWindow) {
        sessions.get(dockWindow)?.();
        sessions.delete(dockWindow);
      }
      popup = source;
      detached = true;
      closed = false;
      panelTargetOpen = true;
      layout();
    }
    sessions.get(source)?.();
    const channel = new MessageChannel();
    sessions.set(source, backend.connect(channel.port1));
    backend.updateShell(placement, detached);
    source.postMessage({ source: BRIDGE_SOURCE, version: BRIDGE_VERSION, kind: 'connected' }, url.origin, [channel.port2]);
  }
  window.addEventListener('message', onReady);
  window.addEventListener('resize', layout);
  const popupCheck = setInterval(() => {
    if (popup?.closed) {
      sessions.get(popup)?.();
      sessions.delete(popup);
      attach();
    }
  }, 500);

  let dragging = false;
  function resizeDock(event: PointerEvent): void {
    if (!dragging)
      return;
    if (placement === 'floating') {
      const point = floating ?? { left: 0, top: 0 };
      width = Math.max(Math.min(320, window.innerWidth), event.clientX - point.left);
      height = Math.max(Math.min(240, window.innerHeight), event.clientY - point.top);
    }
    else if (placement === 'right') {
      width = Math.max(320, window.innerWidth - event.clientX);
    }
    else {
      height = Math.max(240, window.innerHeight - event.clientY);
    }
    layout();
  }
  const stopResize = () => {
    dragging = false;
  };
  resize.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    dragging = true;
    resize.setPointerCapture?.(event.pointerId);
  });
  resize.addEventListener('keydown', (event) => {
    const keys = placement === 'floating'
      ? ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
      : placement === 'right' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    if (!keys.includes(event.key))
      return;
    event.preventDefault();
    if (placement === 'floating') {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
        width = Math.max(Math.min(320, window.innerWidth), width + (event.key === 'ArrowLeft' ? -20 : 20));
      else
        height = Math.max(Math.min(240, window.innerHeight), height + (event.key === 'ArrowUp' ? -20 : 20));
    }
    else if (placement === 'right') {
      width = Math.max(320, width + (event.key === 'ArrowLeft' ? 20 : -20));
    }
    else {
      height = Math.max(240, height + (event.key === 'ArrowUp' ? 20 : -20));
    }
    layout();
  });
  window.addEventListener('pointermove', resizeDock);
  window.addEventListener('pointerup', stopResize);
  window.addEventListener('pointercancel', stopResize);
  try {
    document.body.appendChild(host);
    layout();
  }
  catch (error) {
    dispose();
    throw error;
  }

  function dispose(): void {
    if (disposed)
      return;
    disposed = true;
    clearInterval(popupCheck);
    window.removeEventListener('message', onReady);
    window.removeEventListener('resize', layout);
    window.removeEventListener('pointermove', resizeDock);
    window.removeEventListener('pointerup', stopResize);
    window.removeEventListener('pointercancel', stopResize);
    cancelPanelMotion();
    backend.dispose();
    for (const disconnect of sessions.values()) disconnect();
    sessions.clear();
    releaseDevFiles();
    disposePinia(pinia);
    host.remove();
    if (target[RUNTIME_KEY]?.dispose === dispose)
      Reflect.deleteProperty(target, RUNTIME_KEY);
  }
  target[RUNTIME_KEY] = { host, dispose };
  return dispose;
}
