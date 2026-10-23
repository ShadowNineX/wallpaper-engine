import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { builtInValues } from '../fixtures/properties';

const completeMediaProps = {
  title: 'Test',
  subTitle: '',
  albumTitle: '',
  albumArtist: '',
  artist: 'Artist',
  genres: '',
  contentType: 'music',
} as const;

beforeEach(() => {
  setActivePinia(createPinia());
  window.__WE_DEVTOOLS_CONFIG__ = {
    properties: {
      gain: { type: 'slider', value: 0.5, min: 0, max: 1, step: 0.1, text: 'Gain' },
      artwork: { type: 'file', value: '', text: 'Artwork' },
      library: { type: 'directory', value: '', text: 'Library', mode: 'ondemand' },
    },
    localization: {},
  };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
});

describe('bridge backend', () => {
  it('redacts private file URLs when display metadata is missing', async () => {
    const { createBackend } = await import('../../src/bridge/backend');
    const backend = createBackend(createPinia(), () => undefined);
    try {
      backend.store.setFileSelection('artwork', {
        id: 'cover',
        name: 'cover.png',
        path: 'Gallery/cover.png',
        relativePath: 'cover.png',
        url: 'blob:private-cover',
        size: 1,
        mtimeMs: 1,
      });
      Reflect.deleteProperty(backend.store.propertyDisplayPaths, 'artwork');

      const snapshot = backend.snapshot();

      expect(snapshot.state.currentValues.artwork).toEqual({ value: '' });
      expect(JSON.stringify(snapshot)).not.toContain('blob:private-cover');
      expect(backend.store.currentValues.artwork).toEqual({ value: 'blob:private-cover' });
    }
    finally {
      backend.dispose();
    }
  });

  it('patches only the TypeBox-validated editable draft projection', async () => {
    const [{ applyDraft }, { DraftValidator }, { useDevtoolsStore }] = await Promise.all([
      import('../../src/bridge/backend'),
      import('../../src/bridge/protocol'),
      import('../../src/store'),
    ]);
    const store = useDevtoolsStore();
    const draft = DraftValidator.Parse({
      currentValues: { ...builtInValues, gain: { value: 0.8 } },
      general: { fps: 90, paused: true },
      mediaActive: true,
      lastPlaybackState: 1,
      mediaProps: completeMediaProps,
      mediaTimeline: { position: 10, duration: 30 },
      mediaThumb: { thumbnail: 'data:image/png;base64,a', primaryColor: '#111', secondaryColor: '#222', tertiaryColor: '#333', textColor: '#fff', highContrastColor: '#fff' },
    });

    applyDraft(store, draft);

    expect(store.currentValues.gain?.value).toBe(0.8);
    expect(store.general).toEqual({ fps: 90, paused: true });
    expect(store.mediaActive).toBe(true);
    expect(store.lastPlaybackState).toBe(1);
  });

  it('keeps empty native media fields through an incremental draft patch', async () => {
    const [{ applyDraft }, { DraftValidator }, { useDevtoolsStore }] = await Promise.all([
      import('../../src/bridge/backend'),
      import('../../src/bridge/protocol'),
      import('../../src/store'),
    ]);
    const store = useDevtoolsStore();
    store.mediaProps.subTitle = 'Old subtitle';
    const draft = DraftValidator.Parse({
      currentValues: { ...builtInValues, gain: { value: 0.5 } },
      general: { fps: 60, paused: false },
      mediaActive: false,
      lastPlaybackState: 0,
      mediaProps: completeMediaProps,
      mediaTimeline: { position: 0, duration: 0 },
      mediaThumb: { thumbnail: '', primaryColor: '', secondaryColor: '', tertiaryColor: '', textColor: '', highContrastColor: '' },
    });

    applyDraft(store, draft);

    expect(store.mediaProps).toMatchObject(completeMediaProps);
  });

  it('runs schema-validated audio and checkpoint commands without a host callback', async () => {
    const [{ executeCommand }, { CommandValidator }, { useDevtoolsStore }, { audioSettings, audioState, setAudioMode }] = await Promise.all([
      import('../../src/bridge/backend'),
      import('../../src/bridge/protocol'),
      import('../../src/store'),
      import('../../src/audio'),
    ]);
    const store = useDevtoolsStore();
    const command = CommandValidator.Parse({
      type: 'audio',
      mode: 'track',
      settings: {
        output: 0.5,
        sweepSpeed: 1,
        bassSpeed: 1,
        stereoSpeed: 1,
        trackTempo: 140,
        trackBassline: 1,
        trackKick: 1,
        trackClap: 1,
        trackHiHat: 1,
      },
    });

    executeCommand(store, command);
    executeCommand(store, CommandValidator.Parse({ type: 'checkpoint' }));

    expect(audioState.mode).toBe('track');
    expect(audioSettings).toMatchObject({ output: 0.5, trackTempo: 140 });
    setAudioMode('off');
  });

  it('rejects file and directory commands for properties of the wrong type before allocating URLs', async () => {
    const [{ executeCommand }, { CommandValidator }, { useDevtoolsStore }] = await Promise.all([
      import('../../src/bridge/backend'),
      import('../../src/bridge/protocol'),
      import('../../src/store'),
    ]);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const store = useDevtoolsStore();
    const file = new File(['pixels'], 'cover.png', { type: 'image/png' });
    const selectFile = CommandValidator.Parse({
      type: 'select-file',
      key: 'gain',
      selection: { name: 'cover.png', files: [{ file, relativePath: 'cover.png' }] },
    });
    const selectDirectory = CommandValidator.Parse({
      type: 'select-directory',
      key: 'gain',
      selection: { name: 'covers', files: [{ file, relativePath: 'cover.png' }] },
    });

    expect(() => executeCommand(store, selectFile)).toThrow('Unknown wallpaper property.');
    expect(() => executeCommand(store, selectDirectory)).toThrow('Unknown wallpaper property.');
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('rejects inherited property types before selecting or clearing files and directories', async () => {
    const [{ executeCommand }, { CommandValidator }, { useDevtoolsStore }] = await Promise.all([
      import('../../src/bridge/backend'),
      import('../../src/bridge/protocol'),
      import('../../src/store'),
    ]);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const file = new File(['pixels'], 'cover.png', { type: 'image/png' });
    const originalType = Object.getOwnPropertyDescriptor(Object.prototype, 'type');
    const store = useDevtoolsStore();
    try {
      // eslint-disable-next-line no-extend-native
      Object.defineProperty(Object.prototype, 'type', { configurable: true, value: 'file' });
      expect(() => executeCommand(store, CommandValidator.Parse({
        type: 'select-file',
        key: 'unknown',
        selection: { name: 'cover.png', files: [{ file, relativePath: 'cover.png' }] },
      }))).toThrow('Unknown wallpaper property.');
      expect(() => executeCommand(store, CommandValidator.Parse({
        type: 'action',
        call: { name: 'clearFileSelection', args: ['unknown'] },
      }))).toThrow('Unknown wallpaper property.');

      // eslint-disable-next-line no-extend-native
      Object.defineProperty(Object.prototype, 'type', { configurable: true, value: 'directory' });
      expect(() => executeCommand(store, CommandValidator.Parse({
        type: 'select-directory',
        key: 'unknown',
        selection: { name: 'covers', files: [{ file, relativePath: 'cover.png' }] },
      }))).toThrow('Unknown wallpaper property.');
      expect(() => executeCommand(store, CommandValidator.Parse({
        type: 'action',
        call: { name: 'clearDirectorySelection', args: ['unknown'] },
      }))).toThrow('Unknown wallpaper property.');

      expect(createObjectURL).not.toHaveBeenCalled();
    }
    finally {
      if (originalType)
        // eslint-disable-next-line no-extend-native
        Object.defineProperty(Object.prototype, 'type', originalType);
      else
        delete (Object.prototype as { type?: unknown }).type;
    }
  });

  it('projects snapshots without Blob URLs or host-owned directory file lists', async () => {
    const [{ createBackend }, { HostSnapshotValidator }] = await Promise.all([
      import('../../src/bridge/backend'),
      import('../../src/bridge/protocol'),
    ]);
    const pinia = createPinia();
    const backend = createBackend(pinia, () => undefined);
    backend.store.currentValues.artwork = { value: 'blob:private-artwork' };
    backend.store.propertyDisplayPaths.artwork = 'cover.png';
    backend.store.currentValues.library = { value: 'Library' };
    backend.store.propertyDisplayPaths.library = 'Library';
    backend.store.directoryFiles.library = ['blob:private-directory-file'];
    backend.store.directorySelections.library = {
      id: 'library-id',
      path: 'Library',
      files: [{ id: 'file-id', name: 'cover.png', path: 'Library/cover.png', relativePath: 'cover.png', url: 'blob:private-directory-file', size: 1, mtimeMs: 1 }],
    };

    const snapshot = backend.snapshot();

    expect(HostSnapshotValidator.Check(snapshot)).toBe(true);
    expect(snapshot.state.currentValues.artwork).toEqual({ value: 'cover.png' });
    expect(snapshot.state.currentValues.library).toEqual({ value: 'Library' });
    expect(snapshot.state).not.toHaveProperty('directoryFiles');
    expect(snapshot.state.directorySelections.library).toEqual({ id: 'library-id', path: 'Library' });
    expect(JSON.stringify(snapshot)).not.toContain('blob:private');
    backend.dispose();
  });

  it('applies an incremental draft setting without replacing unchanged artwork', async () => {
    const [{ applyDraftUpdate }, { makeDraft, makeDraftPatch }, { useDevtoolsStore }] = await Promise.all([
      import('../../src/bridge/backend'),
      import('../../src/bridge/protocol'),
      import('../../src/store'),
    ]);
    const store = useDevtoolsStore();
    store.mediaThumb.thumbnail = `data:image/png;base64,${'a'.repeat(20_000)}`;
    const before = makeDraft(store.$state);
    const patch = makeDraftPatch(before, { ...before, general: { ...before.general, fps: 120 } });

    applyDraftUpdate(store, patch);

    expect(store.general.fps).toBe(120);
    expect(JSON.stringify(patch)).not.toContain(store.mediaThumb.thumbnail);
  });

  it('invalidates captured message handlers after disconnect and preserves the active Pinia', async () => {
    const [{ createBackend }] = await Promise.all([
      import('../../src/bridge/backend'),
    ]);
    const shell = vi.fn();
    const hostPinia = createPinia();
    const backend = createBackend(hostPinia, shell);
    const port = {
      onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
      postMessage: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
    };
    const disconnect = backend.connect(port as unknown as MessagePort);
    const captured = port.onmessage;
    const outsidePinia = createPinia();
    setActivePinia(outsidePinia);

    disconnect();
    captured?.({ data: { kind: 'command', id: 1, command: { type: 'shell', action: 'right' }, draft: [] } } as MessageEvent<unknown>);

    expect(port.onmessage).toBeNull();
    expect(port.postMessage).toHaveBeenLastCalledWith({ kind: 'disconnect' });
    expect(shell).not.toHaveBeenCalled();
    expect(getActivePinia()).toBe(outsidePinia);
    backend.dispose();
  });

  it('keeps the wallpaper Pinia active for command callbacks and after command errors', async () => {
    const { createBackend } = await import('../../src/bridge/backend');
    const wallpaperPinia = createPinia();
    const shell = vi.fn(() => {
      throw new Error('Shell failed');
    });
    setActivePinia(wallpaperPinia);
    const backend = createBackend(createPinia(), shell);
    const applyGeneralProperties = vi.fn(() => getActivePinia() === wallpaperPinia);
    window.wallpaperPropertyListener = { applyGeneralProperties };
    const port = {
      onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
      postMessage: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
    };
    const disconnect = backend.connect(port as unknown as MessagePort);

    port.onmessage?.({
      data: {
        kind: 'command',
        id: 1,
        command: { type: 'action', call: { name: 'applyFps', args: [] } },
        draft: [],
      },
    } as MessageEvent<unknown>);

    expect(applyGeneralProperties).toHaveReturnedWith(true);
    expect(getActivePinia()).toBe(wallpaperPinia);

    port.onmessage?.({
      data: {
        kind: 'command',
        id: 2,
        command: { type: 'shell', action: 'right' },
        draft: [],
      },
    } as MessageEvent<unknown>);

    expect(port.postMessage).toHaveBeenLastCalledWith({
      kind: 'result',
      id: 2,
      error: 'Shell failed',
    });
    expect(getActivePinia()).toBe(wallpaperPinia);
    disconnect();
    backend.dispose();
  });

  it('invalidates captured message handlers when the backend is disposed', async () => {
    const { createBackend } = await import('../../src/bridge/backend');
    const shell = vi.fn();
    const backend = createBackend(createPinia(), shell);
    const port = {
      onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
      postMessage: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
    };
    backend.connect(port as unknown as MessagePort);
    const captured = port.onmessage;

    backend.dispose();
    captured?.({
      data: {
        kind: 'command',
        id: 1,
        command: { type: 'shell', action: 'right' },
        draft: [],
      },
    } as MessageEvent<unknown>);

    expect(port.onmessage).toBeNull();
    expect(port.postMessage).toHaveBeenLastCalledWith({ kind: 'disconnect' });
    expect(shell).not.toHaveBeenCalled();
  });

  it('routes empty drag commands without patching or publishing simulator state', async () => {
    const { createBackend } = await import('../../src/bridge/backend');
    const shell = vi.fn();
    const backend = createBackend(createPinia(), shell);
    backend.store.mediaThumb.thumbnail = `data:image/png;base64,${'a'.repeat(20_000)}`;
    const port = { onmessage: null as ((event: MessageEvent<unknown>) => void) | null, postMessage: vi.fn(), start: vi.fn(), close: vi.fn() };
    const disconnect = backend.connect(port as unknown as MessagePort);
    port.postMessage.mockClear();
    const before = backend.store.general.fps;

    port.onmessage?.({ data: { kind: 'command', id: 1, command: { type: 'shell-drag', phase: 'move', x: 12, y: 24 }, draft: [] } } as MessageEvent<unknown>);

    expect(shell).toHaveBeenCalledExactlyOnceWith({ type: 'shell-drag', phase: 'move', x: 12, y: 24 });
    expect(backend.store.general.fps).toBe(before);
    expect(port.postMessage).toHaveBeenCalledExactlyOnceWith({ kind: 'result', id: 1 });
    disconnect();
    backend.dispose();
  });

  it('rejects drag commands that include a state patch', async () => {
    const { createBackend } = await import('../../src/bridge/backend');
    const shell = vi.fn();
    const backend = createBackend(createPinia(), shell);
    const port = { onmessage: null as ((event: MessageEvent<unknown>) => void) | null, postMessage: vi.fn(), start: vi.fn(), close: vi.fn() };
    const disconnect = backend.connect(port as unknown as MessagePort);
    port.postMessage.mockClear();

    port.onmessage?.({ data: { kind: 'command', id: 1, command: { type: 'shell-drag', phase: 'move', x: 12, y: 24 }, draft: [{ type: 'update', path: '/general/fps', value: 120 }] } } as MessageEvent<unknown>);

    expect(shell).not.toHaveBeenCalled();
    expect(backend.store.general.fps).toBe(60);
    expect(port.postMessage).toHaveBeenCalledExactlyOnceWith({ kind: 'result', id: 1, error: 'Drag commands cannot change simulator state.' });
    disconnect();
    backend.dispose();
  });

  it('broadcasts an incremental host patch without repeating unchanged artwork', async () => {
    const { createBackend } = await import('../../src/bridge/backend');
    const backend = createBackend(createPinia(), () => undefined);
    backend.store.mediaThumb.thumbnail = `data:image/png;base64,${'a'.repeat(20_000)}`;
    const port = { onmessage: null, postMessage: vi.fn(), start: vi.fn(), close: vi.fn() };
    const disconnect = backend.connect(port as unknown as MessagePort);
    port.postMessage.mockClear();

    backend.store.general.fps = 120;
    await Promise.resolve();
    await Promise.resolve();

    const patch = port.postMessage.mock.calls
      .map(([message]) => message)
      .find((message): message is { kind: 'patch'; patch: unknown } => (
        typeof message === 'object' && message !== null && (message as { kind?: unknown }).kind === 'patch'
      ));
    expect(patch).toBeDefined();
    expect(JSON.stringify(patch)).not.toContain(backend.store.mediaThumb.thumbnail);
    disconnect();
    backend.dispose();
  });
});
