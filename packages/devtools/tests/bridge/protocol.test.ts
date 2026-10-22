import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { builtInValues } from '../fixtures/properties';

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
      mediaProps: { title: 'Track', artist: 'Artist', contentType: 'music' },
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
      mediaProps: { title: 'Track', artist: 'Artist', contentType: 'music' },
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
      mediaProps: { title: 'Track', artist: 'Artist', contentType: 'music' },
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
});
