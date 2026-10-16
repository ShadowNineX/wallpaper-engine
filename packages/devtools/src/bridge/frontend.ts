import type { ActionCall, Command, Draft, HostMessage, HostSnapshot } from './protocol';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { defineComponent, h, reactive, watch } from 'vue';
import App from '../App.vue';
import { audioSettings, audioState, lastFrame, setAudioTransport } from '../audio';
import { mountDevtools } from '../mount';
import { notify as toast } from '../notifications';
import { performanceState, resetPerformanceMeasurements, startPerformanceMonitor } from '../performance';
import { useDevtoolsStore } from '../store';
import { ConnectedValidator } from './connection';
import { ACTION_NAMES, applyDraftPatch, applyHostPatch, BRIDGE_SOURCE, BRIDGE_VERSION, cleanRecord, HostMessageValidator, makeDraft, makeDraftPatch } from './protocol';
import { setRemoteSender } from './remote';

/** UI realm: a reactive mirror and explicit commands, never wallpaper callbacks. */
export function startFrontend(css?: string): () => void {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('session');
  const detached = new URLSearchParams(window.location.hash.slice(1)).get('view') === 'popup';
  const host = detached ? window.opener?.parent as Window | undefined : window.parent;
  const previousPinia = getActivePinia();
  const pinia = createPinia();
  const store = useDevtoolsStore(pinia);
  setActivePinia(previousPinia);
  const connection = reactive({ connected: false, detached, opening: false, placement: 'right' as 'right' | 'bottom' | 'floating' });
  let port: MessagePort | undefined;
  let revision = 0;
  let nextRequest = 0;
  let lastMessage = 0;
  let hydrating = false;
  let disposed = false;
  let checkpointScheduled = false;
  let baseline: Draft | undefined;
  let lastSentDraft: Draft | undefined;
  let snapshot: HostSnapshot | undefined;
  let openingPopup: Window | undefined;
  let openingTimer: ReturnType<typeof setTimeout> | undefined;
  let dragFrame: number | undefined;
  let pendingDrag: Extract<Command, { type: 'shell-drag' }> | undefined;
  const requests = new Map<number, { timer: ReturnType<typeof setTimeout>; draft: Draft; onError?: () => void }>();

  function finishOpening(failed = false): void {
    if (openingTimer)
      clearTimeout(openingTimer);
    openingTimer = undefined;
    if (failed)
      openingPopup?.close();
    openingPopup = undefined;
    connection.opening = false;
  }
  function send(command: Command, onError?: () => void): boolean {
    if (!port || !connection.connected) {
      toast('Wallpaper disconnected. Waiting to reconnect.');
      onError?.();
      return false;
    }
    try {
      const draft = makeDraft(store.$state);
      const id = ++nextRequest;
      port.postMessage({ kind: 'command', id, command, draft: baseline ? makeDraftPatch(baseline, draft) : [] });
      lastSentDraft = draft;
      requests.set(id, { draft, onError, timer: setTimeout(() => {
        requests.delete(id);
        lastSentDraft = undefined;
        onError?.();
        toast('The wallpaper did not respond to that command.');
        scheduleCheckpoint();
      }, 5000) });
      return true;
    }
    catch (error) {
      onError?.();
      toast(error instanceof Error ? error.message : 'Unable to send simulator command.');
      return false;
    }
  }
  function checkpoint(): void {
    if (connection.connected && baseline && makeDraftPatch(lastSentDraft ?? baseline, makeDraft(store.$state)).length)
      send({ type: 'checkpoint' });
  }
  function scheduleCheckpoint(): void {
    if (hydrating || checkpointScheduled || disposed)
      return;
    checkpointScheduled = true;
    queueMicrotask(() => {
      checkpointScheduled = false;
      if (!disposed)
        checkpoint();
    });
  }
  function postDrag(command: Extract<Command, { type: 'shell-drag' }>): void {
    if (!port || !connection.connected || disposed)
      return;
    try {
      port.postMessage({ kind: 'command', id: ++nextRequest, command, draft: [] });
    }
    catch {
      connection.connected = false;
    }
  }
  function flushDrag(): void {
    dragFrame = undefined;
    if (pendingDrag)
      postDrag(pendingDrag);
    pendingDrag = undefined;
  }
  function cancelDrag(): void {
    if (dragFrame !== undefined)
      cancelAnimationFrame(dragFrame);
    dragFrame = undefined;
    pendingDrag = undefined;
  }
  function drag(phase: 'start' | 'move' | 'end', x: number, y: number): void {
    const command = { type: 'shell-drag' as const, phase, x, y };
    if (phase === 'move') {
      pendingDrag = command;
      dragFrame ??= requestAnimationFrame(flushDrag);
      return;
    }
    if (dragFrame !== undefined)
      cancelAnimationFrame(dragFrame);
    flushDrag();
    postDrag(command);
  }
  const stopDraft = watch(() => store.$state, scheduleCheckpoint, { deep: true, flush: 'sync' });
  const removeSender = setRemoteSender((command) => {
    send(command);
  });
  Object.assign(store, Object.fromEntries(ACTION_NAMES.map(name => [name, (...args: unknown[]) => {
    send({ type: 'action', call: { name, args } as ActionCall });
  }])));
  setAudioTransport(mode => send({ type: 'audio', mode, settings: { ...audioSettings } }));
  const stopAudio = watch(audioSettings, () => {
    if (!hydrating)
      send({ type: 'audio', mode: audioState.mode, settings: { ...audioSettings } });
  }, { deep: true, flush: 'sync' });

  function detach(): void {
    if (connection.opening)
      return;
    if (!connection.connected) {
      toast('Connect to the wallpaper before opening a separate window.');
      return;
    }
    if (connection.detached) {
      send({ type: 'shell', action: 'attach' });
      return;
    }
    // Open synchronously from the click so browser popup policies retain user activation.
    const popup = window.open('about:blank', '_blank', 'popup,width=520,height=820');
    if (!popup) {
      toast('The browser blocked the separate window. Allow popups for this dev server and try again.');
      return;
    }
    openingPopup = popup;
    connection.opening = true;
    const popupToken = crypto.randomUUID();
    if (!send({ type: 'shell', action: 'detach', token: popupToken }, () => finishOpening(true)))
      return;
    try {
      const url = new URL(window.__WE_DEVTOOLS_FRONTEND_URL__ ?? window.location.pathname, window.location.href);
      url.hash = new URLSearchParams({ session: popupToken, view: 'popup' }).toString();
      popup.location.replace(url.href);
      openingTimer = setTimeout(() => {
        finishOpening(true);
        toast('The separate window could not connect. Try opening it again.');
      }, 10000);
    }
    catch {
      finishOpening(true);
      toast('Unable to open the separate window.');
    }
  }

  const view = defineComponent({
    render: () => h(App, {
      embedded: true,
      connected: connection.connected,
      detached: connection.detached,
      opening: connection.opening,
      placement: connection.placement,
      onDetach: detach,
      onDock: (placement: 'right' | 'bottom') => send({ type: 'shell', action: placement }),
      onClose: () => send({ type: 'shell', action: 'close' }),
      onResetPerformance: () => send({ type: 'performance-reset' }),
      onDrag: drag,
    }),
  });
  const mounted = mountDevtools(view, css, { runtime: false, pinia });

  function hydrate(next: HostSnapshot): void {
    const dirty = baseline ? makeDraftPatch(baseline, makeDraft(store.$state)) : [];
    hydrating = true;
    try {
      // Pinia merges nested records. Clean removed selection keys without
      // replacing the reactive objects captured by the setup store's actions.
      cleanRecord(store.propertyDisplayPaths, next.state.propertyDisplayPaths);
      cleanRecord(store.directorySelections, next.state.directorySelections);
      cleanRecord(store.mediaProps, next.state.mediaProps);
      store.$patch(next.state);
      baseline = makeDraft(store.$state);
      if (dirty.length) {
        const draft = applyDraftPatch(baseline, dirty);
        cleanRecord(store.mediaProps, draft.mediaProps);
        store.$patch(draft);
      }
      Object.assign(audioSettings, next.audioSettings);
      audioState.mode = next.audioMode;
      connection.placement = next.placement;
      connection.connected = true;
    }
    finally {
      hydrating = false;
    }
    scheduleCheckpoint();
  }
  function receive(message: HostMessage): void {
    lastMessage = performance.now();
    switch (message.kind) {
      case 'snapshot':
        if (message.revision <= revision)
          return;
        revision = message.revision;
        snapshot = message.snapshot;
        hydrate(snapshot);
        break;
      case 'patch':
        if (message.revision <= revision || !snapshot)
          return;
        try {
          snapshot = applyHostPatch(snapshot, message.patch);
          revision = message.revision;
          hydrate(snapshot);
        }
        catch {
          connection.connected = false;
          requestConnection();
        }
        break;
      case 'audio':
        lastFrame.value = message.frame;
        break;
      case 'performance':
        performanceState.value = message.snapshot;
        break;
      case 'notice':
        toast(message.message);
        break;
      case 'ping':
        port?.postMessage({ kind: 'pong' });
        break;
      case 'result': {
        const request = requests.get(message.id);
        if (request)
          clearTimeout(request.timer);
        requests.delete(message.id);
        if (message.error) {
          lastSentDraft = undefined;
          request?.onError?.();
          toast(message.error);
        }
        else if (request) {
          baseline = request.draft;
        }
        if (!requests.size)
          lastSentDraft = undefined;
        break;
      }
      case 'disconnect':
        connection.connected = false;
        cancelDrag();
        finishOpening();
        break;
    }
  }

  function onConnect(event: MessageEvent<unknown>): void {
    if (event.origin !== window.location.origin || event.source !== host
      || !ConnectedValidator.Check(event.data) || !event.ports[0]) {
      return;
    }
    port?.close();
    cancelDrag();
    for (const { timer } of requests.values()) clearTimeout(timer);
    requests.clear();
    lastSentDraft = undefined;
    port = event.ports[0];
    revision = 0;
    snapshot = undefined;
    lastMessage = performance.now();
    const current = port;
    current.onmessage = (incoming: MessageEvent<unknown>) => {
      if (port === current && HostMessageValidator.Check(incoming.data))
        receive(incoming.data);
    };
    current.start();
  }
  function requestConnection(): void {
    if (!disposed && host && !host.closed && host !== window && token)
      host.postMessage({ source: BRIDGE_SOURCE, version: BRIDGE_VERSION, kind: 'ready', token }, window.location.origin);
  }
  window.addEventListener('message', onConnect);
  const retry = setInterval(() => {
    if (detached && host?.closed) {
      connection.connected = false;
      dispose();
      window.close();
      return;
    }
    if (connection.connected && performance.now() - lastMessage > 3500) {
      connection.connected = false;
      port?.close();
      port = undefined;
    }
    if (!connection.connected)
      requestConnection();
  }, 1000);
  requestConnection();
  window.addEventListener('pagehide', checkpoint);
  function dispose(): void {
    if (disposed)
      return;
    checkpoint();
    disposed = true;
    finishOpening();
    cancelDrag();
    window.removeEventListener('message', onConnect);
    window.removeEventListener('pagehide', checkpoint);
    clearInterval(retry);
    for (const { timer } of requests.values()) clearTimeout(timer);
    requests.clear();
    port?.close();
    stopDraft();
    stopAudio();
    setAudioTransport();
    removeSender();
    mounted.unmount();
  }
  return dispose;
}

export function startStandalone(css?: string): () => void {
  const stopMonitor = startPerformanceMonitor();
  const mounted = mountDevtools(defineComponent({
    render: () => h(App, { onResetPerformance: resetPerformanceMeasurements }),
  }), css);
  return () => {
    stopMonitor();
    mounted.unmount();
  };
}
