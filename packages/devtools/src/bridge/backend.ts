import type { Pinia } from 'pinia';
import type { Command, DockPlacement, Draft, HostMessage, HostSnapshot, SimulatorStore } from './protocol';
import { getActivePinia, setActivePinia } from 'pinia';
import Value from 'typebox/value';
import { watch } from 'vue';
import { audioSettings, audioState, lastFrame, setAudioMode } from '../audio';
import { propDefs } from '../config';
import { acceptDevDirectory, acceptDevFile, releaseDevDirectory, releaseDevFile } from '../dev-files';
import { installGlobals } from '../globals';
import { setNotificationHandler } from '../notifications';
import { performanceState, resetPerformanceMeasurements, startPerformanceMonitor } from '../performance';
import { useDevtoolsStore } from '../store';
import { applyDraftPatch, cleanRecord, ClientMessageValidator, HostSnapshotSchema, HostSnapshotValidator, makeDraft, makeHostPatch } from './protocol';

/** Applies the schema-validated editable projection in one Pinia mutation. */
export function applyDraft(store: SimulatorStore, draft: Draft): void {
  cleanRecord(store.mediaProps, draft.mediaProps);
  store.$patch(draft);
}

export function applyDraftUpdate(store: SimulatorStore, patch: import('./protocol').DraftPatch): void {
  applyDraft(store, applyDraftPatch(makeDraft(store.$state), patch));
}

export function executeCommand(store: SimulatorStore, command: Command): void {
  switch (command.type) {
    case 'action': {
      const { call } = command;
      switch (call.name) {
        case 'deliverProperty':
          if (!Object.hasOwn(store.currentValues, call.args[0]))
            throw new TypeError('Unknown wallpaper property.');
          store.deliverProperty(call.args[0]);
          return;
        case 'clearFileSelection': {
          const key = call.args[0];
          if (propDefs[key]?.type !== 'file')
            throw new TypeError('Unknown wallpaper property.');
          const previous = store.currentValues[key]?.value;
          store.clearFileSelection(key);
          if (typeof previous === 'string')
            releaseDevFile(previous);
          return;
        }
        case 'clearDirectorySelection': {
          const key = call.args[0];
          if (propDefs[key]?.type !== 'directory')
            throw new TypeError('Unknown wallpaper property.');
          const previous = store.directorySelections[key]?.id;
          store.clearDirectorySelection(key);
          if (previous)
            releaseDevDirectory(previous);
          return;
        }
        case 'applyPaused':
          store.applyPaused(call.args[0]);
          return;
        case 'firePluginLoaded':
          store.firePluginLoaded(call.args[0]);
          return;
        case 'setMediaEnabled':
          store.setMediaEnabled(call.args[0]);
          return;
        case 'sendMediaPlayback':
          store.sendMediaPlayback(call.args[0]);
          return;
        case 'deliverAllProperties':
          store.deliverAllProperties();
          return;
        case 'resetPropertiesToDefaults':
          store.resetPropertiesToDefaults();
          return;
        case 'applyFps':
          store.applyFps();
          return;
        case 'sendMediaProperties':
          store.sendMediaProperties();
          return;
        case 'sendMediaTimeline':
          store.sendMediaTimeline();
          return;
        case 'sendMediaArtwork':
          store.sendMediaArtwork();
          return;
      }
      return;
    }
    case 'audio':
      Object.assign(audioSettings, command.settings);
      if (audioState.mode !== command.mode)
        setAudioMode(command.mode);
      return;
    case 'select-file': {
      if (propDefs[command.key]?.type !== 'file')
        throw new TypeError('Unknown wallpaper property.');
      const previous = store.currentValues[command.key]?.value;
      const accepted = acceptDevFile(command.selection);
      if (accepted) {
        store.setFileSelection(command.key, accepted);
        if (typeof previous === 'string')
          releaseDevFile(previous);
      }
      return;
    }
    case 'select-directory':
      if (propDefs[command.key]?.type !== 'directory')
        throw new TypeError('Unknown wallpaper property.');
      store.setDirectorySelection(command.key, acceptDevDirectory(command.selection, store.directorySelections[command.key]?.id));
      return;
    case 'performance-reset':
      resetPerformanceMeasurements();
      return;
    case 'checkpoint':
      return;
    case 'shell':
      throw new TypeError('Shell commands must be handled by the host shell.');
  }
}

export function createBackend(pinia: Pinia, shell: (command: Extract<Command, { type: 'shell' | 'shell-drag' }>) => void) {
  const store = useDevtoolsStore(pinia);
  const removeGlobals = installGlobals(pinia);
  const ports = new Map<MessagePort, HostSnapshot>();
  let revision = 0;
  let placement: DockPlacement = 'right';
  let detached = false;
  let disposed = false;
  let scheduled = false;
  const snapshot = (): HostSnapshot => HostSnapshotValidator.Parse(Value.Clean(
    HostSnapshotSchema,
    Value.Clone({ state: store.$state, audioMode: audioState.mode, audioSettings, placement, detached }),
  ));
  const broadcast = (message: HostMessage): void => {
    for (const port of ports.keys())
      port.postMessage(message);
  };
  function publish(): void {
    if (scheduled || disposed)
      return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (disposed)
        return;
      const next = snapshot();
      const patches = [...ports.entries()]
        .map(([port, previous]) => ({ port, patch: makeHostPatch(previous, next) }))
        .filter(({ patch }) => patch.length > 0);
      for (const [port] of ports)
        ports.set(port, next);
      if (patches.length === 0)
        return;
      revision += 1;
      for (const { port, patch } of patches)
        port.postMessage({ kind: 'patch', revision, patch } satisfies HostMessage);
    });
  }
  const stopStore = store.$subscribe(publish, { detached: true, flush: 'sync' });
  const stopAudio = watch([audioState, audioSettings], publish, { deep: true, flush: 'sync' });
  const stopFrame = watch(lastFrame, frame => broadcast({ kind: 'audio', frame }), { flush: 'sync' });
  const stopPerformance = watch(performanceState, value => broadcast({ kind: 'performance', snapshot: value }));
  const stopMonitor = startPerformanceMonitor();
  const removeNotifications = setNotificationHandler(message => broadcast({ kind: 'notice', message }));
  const heartbeat = setInterval(broadcast, 1000, { kind: 'ping' });
  const disconnect = (port: MessagePort): void => {
    if (!ports.delete(port))
      return;
    port.onmessage = null;
    port.postMessage({ kind: 'disconnect' } satisfies HostMessage);
    port.close();
  };
  return {
    store,
    snapshot,
    updateShell(next: DockPlacement, poppedOut: boolean) {
      placement = next;
      detached = poppedOut;
      publish();
    },
    connect(port: MessagePort): () => void {
      const initial = snapshot();
      ports.set(port, initial);
      port.onmessage = (event: MessageEvent<unknown>) => {
        if (disposed || !ports.has(port))
          return;
        if (!ClientMessageValidator.Check(event.data))
          return;
        const message = ClientMessageValidator.Parse(event.data);
        if (message.kind !== 'command')
          return;
        try {
          const previousPinia = getActivePinia();
          setActivePinia(pinia);
          try {
            if (message.command.type === 'shell-drag') {
              if (message.draft.length > 0)
                throw new TypeError('Drag commands cannot change simulator state.');
              shell(message.command);
            }
            else {
              applyDraftUpdate(store, message.draft);
              if (message.command.type === 'shell')
                shell(message.command);
              else
                executeCommand(store, message.command);
            }
          }
          finally {
            setActivePinia(previousPinia);
          }
          port.postMessage({ kind: 'result', id: message.id } satisfies HostMessage);
        }
        catch (error) {
          port.postMessage({ kind: 'result', id: message.id, error: error instanceof Error ? error.message : 'Simulator command failed.' } satisfies HostMessage);
        }
        if (message.command.type !== 'shell-drag')
          publish();
      };
      port.start();
      port.postMessage({ kind: 'snapshot', revision: ++revision, snapshot: initial } satisfies HostMessage);
      port.postMessage({ kind: 'performance', snapshot: performanceState.value } satisfies HostMessage);
      port.postMessage({ kind: 'audio', frame: lastFrame.value } satisfies HostMessage);
      return () => {
        disconnect(port);
      };
    },
    dispose() {
      disposed = true;
      clearInterval(heartbeat);
      stopStore();
      stopAudio();
      stopFrame();
      stopPerformance();
      stopMonitor();
      removeNotifications();
      for (const port of [...ports.keys()])
        disconnect(port);
      setAudioMode('off');
      removeGlobals();
    },
  };
}
