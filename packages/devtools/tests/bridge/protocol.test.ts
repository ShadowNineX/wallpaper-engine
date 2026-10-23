import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { builtInValues } from '../fixtures/properties';

const completeMediaProps = {
  title: 'Track',
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
      separator: { type: 'divider' },
    },
    localization: {},
  };
});

afterEach(() => {
  delete window.__WE_DEVTOOLS_CONFIG__;
});

describe('bridge protocol schemas', () => {
  it('rejects inherited values in an editable draft without mutating its source', async () => {
    vi.resetModules();
    const [{ makeDraft }, { useDevtoolsStore }] = await Promise.all([
      import('../../src/bridge/protocol'),
      import('../../src/store'),
    ]);
    const store = useDevtoolsStore();
    const currentValues = Object.assign(Object.create({ gain: { value: 0.9 } }), builtInValues);

    expect(() => makeDraft({ ...store.$state, currentValues })).toThrow();
    expect(Object.hasOwn(currentValues, 'gain')).toBe(false);
    expect(currentValues.gain).toEqual({ value: 0.9 });
  });

  it('accepts only finite, ranged audio settings and exact command discriminants', async () => {
    const { CommandValidator } = await import('../../src/bridge/protocol');
    const valid = {
      type: 'audio',
      mode: 'track',
      settings: {
        output: 1,
        sweepSpeed: 1,
        bassSpeed: 1,
        stereoSpeed: 1,
        trackTempo: 120,
        trackBassline: 1,
        trackKick: 1,
        trackClap: 1,
        trackHiHat: 1,
      },
    };

    expect(CommandValidator.Check(valid)).toBe(true);
    expect(CommandValidator.Check({ ...valid, settings: { ...valid.settings, trackTempo: 240 } })).toBe(false);
    expect(CommandValidator.Check({ ...valid, settings: { ...valid.settings, output: Number.NaN } })).toBe(false);
    expect(CommandValidator.Check({ type: 'shell', action: 'left' })).toBe(false);
    expect(CommandValidator.Check({ type: 'checkpoint' })).toBe(true);
  });

  it('requires the complete native metadata shape and accepts the unknown content type', async () => {
    const { DraftValidator } = await import('../../src/bridge/protocol');
    const nativeMediaProps = {
      title: '',
      subTitle: '',
      albumTitle: '',
      albumArtist: '',
      artist: '',
      genres: '',
      contentType: '',
    };
    const draft = {
      currentValues: { ...builtInValues, gain: { value: 0.5 } },
      general: { fps: 60, paused: false },
      mediaActive: true,
      lastPlaybackState: 0,
      mediaProps: nativeMediaProps,
      mediaTimeline: { position: 0, duration: 0 },
      mediaThumb: { thumbnail: '', primaryColor: '', secondaryColor: '', tertiaryColor: '', textColor: '', highContrastColor: '' },
    };

    expect(DraftValidator.Check(draft)).toBe(true);
    expect(DraftValidator.Check({ ...draft, mediaProps: { ...nativeMediaProps, contentType: 'unknown' } })).toBe(false);
    for (const key of Object.keys(nativeMediaProps)) {
      const incomplete = { ...nativeMediaProps };
      Reflect.deleteProperty(incomplete, key);
      expect(DraftValidator.Check({ ...draft, mediaProps: incomplete }), `Missing ${key}`).toBe(false);
      expect(DraftValidator.Check({ ...draft, mediaProps: { ...nativeMediaProps, [key]: 1 } }), `Non-string ${key}`).toBe(false);
    }
  });

  it('creates a cleaned editable draft without host-owned listener or file URL state', async () => {
    const [{ makeDraft }, { useDevtoolsStore }] = await Promise.all([
      import('../../src/bridge/protocol'),
      import('../../src/store'),
    ]);
    const store = useDevtoolsStore();
    store.listenerCounts.audio = 3;
    store.currentValues.gain = { value: 0.75 };
    store.currentValues.artwork = { value: 'blob:host-owned' };

    const draft = makeDraft(store.$state);

    expect(draft.currentValues).toEqual({ ...builtInValues, gain: { value: 0.75 } });
    expect(draft).not.toHaveProperty('listenerCounts');
    expect(draft).not.toHaveProperty('directorySelections');
  });

  it('requires structured-clone File payloads for selection commands', async () => {
    const { CommandValidator } = await import('../../src/bridge/protocol');
    const file = new File(['pixels'], 'cover.png', { type: 'image/png' });
    const selection = { type: 'select-file', key: 'artwork', selection: { name: 'cover.png', files: [{ file, relativePath: 'cover.png' }] } };

    expect(CommandValidator.Check(selection)).toBe(true);
    expect(CommandValidator.Check({ ...selection, selection: { ...selection.selection, files: [{ file: { name: 'cover.png' }, relativePath: 'cover.png' }] } })).toBe(false);
  });

  it('excludes dividers from snapshots and rejects editable divider values', async () => {
    const [{ DraftValidator, makeDraft, applyDraftPatch }, { createBackend }] = await Promise.all([
      import('../../src/bridge/protocol'),
      import('../../src/bridge/backend'),
    ]);
    const backend = createBackend(createPinia(), () => undefined);
    try {
      const snapshot = backend.snapshot();
      const draft = makeDraft(backend.store.$state);
      expect(snapshot.state.currentValues).not.toHaveProperty('separator');
      expect(draft.currentValues).not.toHaveProperty('separator');
      expect(DraftValidator.Check({ ...draft, currentValues: { ...draft.currentValues, separator: { value: '' } } })).toBe(false);
      expect(() => applyDraftPatch(draft, [{ type: 'insert', path: '/currentValues/@separator', value: { value: '' } }])).toThrow();
    }
    finally {
      backend.dispose();
    }
  });

  it('rejects host-owned state fields in frontend command drafts', async () => {
    const { applyDraftPatch, ClientMessageValidator, DraftPatchValidator, DraftValidator } = await import('../../src/bridge/protocol');
    const draft = {
      currentValues: { ...builtInValues, gain: { value: 0.5 } },
      general: { fps: 60, paused: false },
      mediaActive: false,
      lastPlaybackState: 0,
      mediaProps: completeMediaProps,
      mediaTimeline: { position: 0, duration: 0 },
      mediaThumb: { thumbnail: '', primaryColor: '', secondaryColor: '', tertiaryColor: '', textColor: '', highContrastColor: '' },
    };

    const validated = DraftValidator.Parse(draft);
    expect(ClientMessageValidator.Check({ kind: 'command', id: 1, command: { type: 'checkpoint' }, draft: [] })).toBe(true);
    expect(() => applyDraftPatch(validated, DraftPatchValidator.Parse([
      { type: 'update', path: '/listenerCounts/audio', value: 9 },
    ]))).toThrow();
    expect(() => applyDraftPatch(validated, DraftPatchValidator.Parse([
      { type: 'update', path: '/__proto__/polluted', value: true },
    ]))).toThrow();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('sends only the changed setting when artwork is unchanged', async () => {
    const { DraftValidator, makeDraftPatch } = await import('../../src/bridge/protocol');
    const artwork = `data:image/png;base64,${'a'.repeat(20_000)}`;
    const before = DraftValidator.Parse({
      currentValues: { ...builtInValues, gain: { value: 0.5 } },
      general: { fps: 60, paused: false },
      mediaActive: false,
      lastPlaybackState: 0,
      mediaProps: completeMediaProps,
      mediaTimeline: { position: 0, duration: 0 },
      mediaThumb: { thumbnail: artwork, primaryColor: '', secondaryColor: '', tertiaryColor: '', textColor: '', highContrastColor: '' },
    });
    const next = DraftValidator.Parse({ ...before, general: { ...before.general, fps: 90 } });

    const patch = makeDraftPatch(before, next);

    expect(patch).toEqual([{ type: 'update', path: '/general/fps', value: 90 }]);
    expect(JSON.stringify(patch)).not.toContain(artwork);
  });

  it('keeps ordinary initial property keys when cleaning a host snapshot', async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    window.__WE_DEVTOOLS_CONFIG__ = {
      properties: { speed: { type: 'slider', value: 2, min: 0, max: 5, step: 1, text: 'Speed' } },
      localization: {},
    };
    const [{ HostSnapshotSchema, HostSnapshotValidator }, { audioSettings, audioState }, { useDevtoolsStore }, Value] = await Promise.all([
      import('../../src/bridge/protocol'),
      import('../../src/audio'),
      import('../../src/store'),
      import('typebox/value'),
    ]);
    const hostStore = useDevtoolsStore(createPinia());

    const snapshot = HostSnapshotValidator.Parse(Value.Clean(
      HostSnapshotSchema,
      Value.Clone({ state: hostStore.$state, audioMode: audioState.mode, audioSettings, placement: 'bottom', detached: false }),
    ));

    expect(snapshot.state.currentValues).toEqual({ ...builtInValues, speed: { value: 2 } });
    expect(snapshot.state.currentValues).not.toHaveProperty('@speed');
  });

  it('round-trips TypeBox JSON-pointer escaping for editable property keys', async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    window.__WE_DEVTOOLS_CONFIG__ = {
      properties: { 'gain/name': { type: 'slider', value: 0.5, min: 0, max: 1, step: 0.1, text: 'Gain' } },
      localization: {},
    };
    const [{ applyDraftPatch, applyHostPatch, DraftValidator, makeDraftPatch, makeHostPatch }, { createBackend }] = await Promise.all([
      import('../../src/bridge/protocol'),
      import('../../src/bridge/backend'),
    ]);
    const before = DraftValidator.Parse({
      currentValues: { ...builtInValues, 'gain/name': { value: 0.5 } },
      general: { fps: 60, paused: false },
      mediaActive: false,
      lastPlaybackState: 0,
      mediaProps: completeMediaProps,
      mediaTimeline: { position: 0, duration: 0 },
      mediaThumb: { thumbnail: '', primaryColor: '', secondaryColor: '', tertiaryColor: '', textColor: '', highContrastColor: '' },
    });
    const next = DraftValidator.Parse({ ...before, currentValues: { ...builtInValues, 'gain/name': { value: 0.75 } } });

    const patch = makeDraftPatch(before, next);

    expect(patch).toEqual([{ type: 'update', path: '/currentValues/@gain%2Fname/value', value: 0.75 }]);
    expect(applyDraftPatch(before, patch)).toEqual(next);
    expect(before.currentValues).toEqual({ ...builtInValues, 'gain/name': { value: 0.5 } });
    expect(before.currentValues).not.toHaveProperty('@gain%2Fname');

    const backend = createBackend(createPinia(), () => undefined);
    const hostBefore = backend.snapshot();
    backend.store.currentValues['gain/name'] = { value: 0.75 };
    const hostAfter = backend.snapshot();
    const hostPatch = makeHostPatch(hostBefore, hostAfter);
    expect(applyHostPatch(hostBefore, hostPatch)).toEqual(hostAfter);
    expect(hostBefore.state.currentValues).toEqual({ ...builtInValues, 'gain/name': { value: 0.5 } });
    expect(hostBefore.state.currentValues).not.toHaveProperty('@gain%2Fname');
    expect(hostAfter.state.currentValues).toEqual({ ...builtInValues, 'gain/name': { value: 0.75 } });
    expect(hostAfter.state.currentValues).not.toHaveProperty('@gain%2Fname');
    expect(backend.store.currentValues).toEqual({ ...builtInValues, 'gain/name': { value: 0.75 } });
    expect(backend.store.currentValues).not.toHaveProperty('@gain%2Fname');
    backend.dispose();
  });

  it.each(['__proto__', 'constructor', 'toString'] as const)('round-trips the reserved property key %s through drafts, snapshots, and patches', async (key) => {
    vi.resetModules();
    setActivePinia(createPinia());
    window.__WE_DEVTOOLS_CONFIG__ = {
      properties: Object.fromEntries([
        [key, { type: 'slider', value: 0.5, min: 0, max: 1, step: 0.1, text: 'Reserved' }],
      ]),
      localization: {},
    };
    const [{ applyDraftPatch, applyHostPatch, makeDraft, makeDraftPatch, makeHostPatch }, { createBackend }] = await Promise.all([
      import('../../src/bridge/protocol'),
      import('../../src/bridge/backend'),
    ]);
    const backend = createBackend(createPinia(), () => undefined);
    try {
      expect(Object.hasOwn(backend.store.currentValues, key)).toBe(true);
      const draftBefore = makeDraft(backend.store.$state);
      const hostBefore = backend.snapshot();
      expect(Object.hasOwn(draftBefore.currentValues, key)).toBe(true);
      expect(Object.hasOwn(hostBefore.state.currentValues, key)).toBe(true);

      backend.store.currentValues[key] = { value: 0.75 };
      const draftAfter = makeDraft(backend.store.$state);
      const hostAfter = backend.snapshot();
      const draftPatch = makeDraftPatch(draftBefore, draftAfter);
      const hostPatch = makeHostPatch(hostBefore, hostAfter);

      expect(applyDraftPatch(draftBefore, draftPatch)).toEqual(draftAfter);
      expect(applyHostPatch(hostBefore, hostPatch)).toEqual(hostAfter);
      expect(hostAfter.state.currentValues[key]).toEqual({ value: 0.75 });
    }
    finally {
      backend.dispose();
    }
  });

  it('round-trips reserved file and directory records through host patches', async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    window.__WE_DEVTOOLS_CONFIG__ = {
      properties: Object.fromEntries([
        ['__proto__', { type: 'file', value: 'C:/cover.png', text: 'Cover' }],
        ['constructor', { type: 'directory', value: 'C:/gallery', mode: 'ondemand', text: 'Gallery' }],
        ['toString', { type: 'slider', value: 0.5, min: 0, max: 1, step: 0.1, text: 'Reserved' }],
      ]),
      localization: {},
    };
    const [{ applyHostPatch, makeDraft, makeHostPatch }, { createBackend }] = await Promise.all([
      import('../../src/bridge/protocol'),
      import('../../src/bridge/backend'),
    ]);
    const backend = createBackend(createPinia(), () => undefined);
    try {
      const protoKey = '__proto__';
      backend.store.setFileSelection('__proto__', {
        id: 'cover',
        name: 'cover.png',
        path: 'Cover',
        relativePath: 'cover.png',
        url: 'blob:cover',
        size: 1,
        mtimeMs: 1,
      });
      backend.store.setDirectorySelection('constructor', {
        id: 'gallery',
        path: 'Gallery',
        files: [],
      });
      const before = backend.snapshot();
      const draft = makeDraft(backend.store.$state);
      expect(Object.hasOwn(before.state.currentValues, '__proto__')).toBe(true);
      expect(Object.hasOwn(before.state.propertyDisplayPaths, '__proto__')).toBe(true);
      expect(Object.hasOwn(before.state.directorySelections, 'constructor')).toBe(true);
      expect(Object.hasOwn(draft.currentValues, 'toString')).toBe(true);
      expect(Object.hasOwn(draft.currentValues, '__proto__')).toBe(false);

      backend.store.setFileSelection('__proto__', {
        id: 'next-cover',
        name: 'next-cover.png',
        path: 'Next cover',
        relativePath: 'next-cover.png',
        url: 'blob:next-cover',
        size: 1,
        mtimeMs: 1,
      });
      backend.store.setDirectorySelection('constructor', {
        id: 'next-gallery',
        path: 'Next gallery',
        files: [],
      });
      const after = backend.snapshot();
      expect(applyHostPatch(before, makeHostPatch(before, after))).toEqual(after);
      expect(after.state.currentValues[protoKey]).toEqual({ value: 'Next cover' });
      expect(after.state.directorySelections.constructor).toEqual({ id: 'next-gallery', path: 'Next gallery' });
    }
    finally {
      backend.dispose();
    }
  });
});
