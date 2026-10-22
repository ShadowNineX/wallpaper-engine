import type { TTuple } from 'typebox';
import type { useDevtoolsStore } from '../store';
import Type from 'typebox';
import Schema from 'typebox/schema';
import Value from 'typebox/value';
import { propDefs } from '../config';

export const BRIDGE_VERSION = 1;
export const BRIDGE_SOURCE = 'wallpaper-engine-devtools';
export const ACTION_NAMES = [
  'deliverAllProperties',
  'deliverProperty',
  'resetPropertiesToDefaults',
  'clearFileSelection',
  'clearDirectorySelection',
  'applyFps',
  'applyPaused',
  'firePluginLoaded',
  'setMediaEnabled',
  'sendMediaProperties',
  'sendMediaPlayback',
  'sendMediaTimeline',
  'sendMediaArtwork',
] as const;

export type SimulatorStore = ReturnType<typeof useDevtoolsStore>;
export type SimulatorState = SimulatorStore['$state'];
type ActionName = (typeof ACTION_NAMES)[number];
export type DockPlacement = 'right' | 'bottom' | 'floating';

function finite(options: { minimum?: number; maximum?: number } = {}) {
  return Type.Refine(Type.Number(options), Number.isFinite);
}
const playback = Type.Union([Type.Literal(0), Type.Literal(1), Type.Literal(2)]);
const audioMode = Type.Union([
  Type.Literal('off'),
  Type.Literal('silence'),
  Type.Literal('random'),
  Type.Literal('sine'),
  Type.Literal('bass'),
  Type.Literal('stereo'),
  Type.Literal('track'),
]);
const mediaProps = Type.Object({
  title: Type.String(),
  artist: Type.String(),
  subTitle: Type.Optional(Type.String()),
  albumTitle: Type.Optional(Type.String()),
  albumArtist: Type.Optional(Type.String()),
  genres: Type.Optional(Type.String()),
  contentType: Type.Union([Type.Literal('music'), Type.Literal('video'), Type.Literal('image')]),
}, { additionalProperties: false });
const mediaTimeline = Type.Object({ position: finite({ minimum: 0 }), duration: finite({ minimum: 0 }) }, { additionalProperties: false });
const mediaThumb = Type.Object({
  thumbnail: Type.String(),
  primaryColor: Type.String(),
  secondaryColor: Type.String(),
  tertiaryColor: Type.String(),
  textColor: Type.String(),
  highContrastColor: Type.String(),
}, { additionalProperties: false });
const audioSettings = Type.Object({
  output: finite({ minimum: 0, maximum: 1 }),
  sweepSpeed: finite({ minimum: 0.25, maximum: 2 }),
  bassSpeed: finite({ minimum: 0.25, maximum: 2 }),
  stereoSpeed: finite({ minimum: 0.25, maximum: 2 }),
  trackTempo: finite({ minimum: 60, maximum: 180 }),
  trackBassline: finite({ minimum: 0, maximum: 1.5 }),
  trackKick: finite({ minimum: 0, maximum: 1.5 }),
  trackClap: finite({ minimum: 0, maximum: 1.5 }),
  trackHiHat: finite({ minimum: 0, maximum: 1.5 }),
}, { additionalProperties: false });

function editableProperty(type: string) {
  if (type === 'combo')
    return Type.Object({ value: Type.String(), text: Type.String() }, { additionalProperties: false });
  if (type === 'bool')
    return Type.Object({ value: Type.Boolean() }, { additionalProperties: false });
  if (type === 'slider')
    return Type.Object({ value: finite() }, { additionalProperties: false });
  return Type.Object({ value: Type.String() }, { additionalProperties: false });
}

function propertySchemas(entries: Iterable<readonly [string, ReturnType<typeof editableProperty>]>) {
  const properties = Object.create(null) as Record<string, ReturnType<typeof editableProperty>>;
  for (const [key, value] of entries)
    properties[key] = value;
  return properties;
}

const editableProperties = propertySchemas(
  Object.entries(propDefs)
    .filter(([, definition]) => definition.type !== 'group' && definition.type !== 'divider' && definition.type !== 'file' && definition.type !== 'directory')
    .map(([key, definition]) => [key, editableProperty(definition.type)]),
);

// File selections are read-only in the frontend. Host snapshots expose their
// display paths for conditions; object URLs and directory entries stay local.
const snapshotProperties = propertySchemas(
  Object.entries(propDefs)
    .filter(([, definition]) => definition.type !== 'group' && definition.type !== 'divider')
    .map(([key, definition]) => [key, editableProperty(definition.type)]),
);

/** The only simulator fields editable by the frontend payload. */
const DraftSchema = Type.Object({
  currentValues: Type.Object(editableProperties, { additionalProperties: false }),
  general: Type.Object({ fps: finite({ minimum: 0, maximum: 240 }), paused: Type.Boolean() }, { additionalProperties: false }),
  mediaActive: Type.Boolean(),
  lastPlaybackState: playback,
  mediaProps,
  mediaTimeline,
  mediaThumb,
}, { additionalProperties: false });
export const DraftValidator = Schema.Compile(DraftSchema);
export type Draft = Type.Static<typeof DraftSchema>;

const patchEdit = Type.Union([
  Type.Object({ type: Type.Literal('insert'), path: Type.String(), value: Type.Unknown() }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal('update'), path: Type.String(), value: Type.Unknown() }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal('delete'), path: Type.String() }, { additionalProperties: false }),
]);
const DraftPatchSchema = Type.Array(patchEdit);
export const DraftPatchValidator = Schema.Compile(DraftPatchSchema);
export type DraftPatch = Type.Static<typeof DraftPatchSchema>;
const PatchDraftSchema = Type.Object({
  ...DraftSchema.properties,
  currentValues: Type.Record(Type.String(), Type.Unknown()),
}, { additionalProperties: false });
const PatchDraftValidator = Schema.Compile(PatchDraftSchema);

const file = Type.Refine(
  Type.Unsafe<File>({}),
  value => typeof File !== 'undefined' && value instanceof File,
);
const selection = Type.Object({
  name: Type.String(),
  files: Type.Array(Type.Object({ file, relativePath: Type.String() }, { additionalProperties: false })),
}, { additionalProperties: false });
function action<Name extends ActionName, Args extends TTuple>(name: Name, args: Args) {
  return Type.Object({ name: Type.Literal(name), args }, { additionalProperties: false });
}

const ActionCallSchema = Type.Union([
  action('deliverAllProperties', Type.Tuple([])),
  action('deliverProperty', Type.Tuple([Type.String()])),
  action('resetPropertiesToDefaults', Type.Tuple([])),
  action('clearFileSelection', Type.Tuple([Type.String()])),
  action('clearDirectorySelection', Type.Tuple([Type.String()])),
  action('applyFps', Type.Tuple([])),
  action('applyPaused', Type.Tuple([Type.Boolean()])),
  action('firePluginLoaded', Type.Tuple([Type.Union([Type.Literal('led'), Type.Literal('cue')])])),
  action('setMediaEnabled', Type.Tuple([Type.Boolean()])),
  action('sendMediaProperties', Type.Tuple([])),
  action('sendMediaPlayback', Type.Tuple([playback])),
  action('sendMediaTimeline', Type.Tuple([])),
  action('sendMediaArtwork', Type.Tuple([])),
]);
export type ActionCall = Type.Static<typeof ActionCallSchema>;

const CommandSchema = Type.Union([
  Type.Object({ type: Type.Literal('action'), call: ActionCallSchema }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal('audio'), mode: audioMode, settings: audioSettings }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal('select-file'), key: Type.String(), selection }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal('select-directory'), key: Type.String(), selection }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal('performance-reset') }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal('checkpoint') }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal('shell'), action: Type.Union([Type.Literal('right'), Type.Literal('bottom'), Type.Literal('close'), Type.Literal('attach'), Type.Literal('detach')]), token: Type.Optional(Type.String()) }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal('shell-drag'), phase: Type.Union([Type.Literal('start'), Type.Literal('move'), Type.Literal('end')]), x: finite(), y: finite() }, { additionalProperties: false }),
]);
export const CommandValidator = Schema.Compile(CommandSchema);
export type Command = Type.Static<typeof CommandSchema>;

const ClientMessageSchema = Type.Union([
  Type.Object({ kind: Type.Literal('command'), id: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }), command: CommandSchema, draft: DraftPatchSchema }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('pong') }, { additionalProperties: false }),
]);
export const ClientMessageValidator = Schema.Compile(ClientMessageSchema);

const state = Type.Object({
  listenerCounts: Type.Object({ property: Type.Boolean(), plugin: Type.Boolean(), audio: Type.Integer({ minimum: 0 }), mediaStatus: Type.Integer({ minimum: 0 }), mediaProps: Type.Integer({ minimum: 0 }), mediaThumb: Type.Integer({ minimum: 0 }), mediaPlayback: Type.Integer({ minimum: 0 }), mediaTimeline: Type.Integer({ minimum: 0 }) }, { additionalProperties: false }),
  currentValues: Type.Object(snapshotProperties, { additionalProperties: false }),
  propertyDisplayPaths: Type.Record(Type.String(), Type.String()),
  general: DraftSchema.properties.general,
  directorySelections: Type.Record(Type.String(), Type.Object({ id: Type.String(), path: Type.String() }, { additionalProperties: false })),
  mediaActive: Type.Boolean(),
  lastPlaybackState: finite(),
  mediaProps,
  mediaTimeline,
  mediaThumb,
}, { additionalProperties: false });
const performance = Type.Object({
  status: Type.Union([Type.Literal('idle'), Type.Literal('monitoring'), Type.Literal('hidden'), Type.Literal('unsupported')]),
  collectedAt: Type.Union([finite(), Type.Null()]),
  frameSamples: Type.Integer({ minimum: 0 }),
  fps: Type.Union([finite(), Type.Null()]),
  averageFrameMs: Type.Union([finite(), Type.Null()]),
  p95FrameMs: Type.Union([finite(), Type.Null()]),
  longTasks: Type.Object({ supported: Type.Boolean(), count: Type.Integer({ minimum: 0 }), totalDuration: finite({ minimum: 0 }), maxDuration: finite({ minimum: 0 }) }, { additionalProperties: false }),
  navigation: Type.Object({ supported: Type.Boolean(), domContentLoaded: Type.Union([finite(), Type.Null()]), load: Type.Union([finite(), Type.Null()]) }, { additionalProperties: false }),
  resources: Type.Array(Type.Object({ name: Type.String(), initiatorType: Type.String(), transferSize: finite({ minimum: 0 }), decodedBodySize: finite({ minimum: 0 }), duration: finite({ minimum: 0 }) }, { additionalProperties: false })),
  audits: Type.Array(Type.Object({ severity: Type.Union([Type.Literal('info'), Type.Literal('warning')]), title: Type.String(), detail: Type.String() }, { additionalProperties: false })),
}, { additionalProperties: false });
export const HostSnapshotSchema = Type.Object({ state, audioMode, audioSettings, placement: Type.Union([Type.Literal('right'), Type.Literal('bottom'), Type.Literal('floating')]), detached: Type.Boolean() }, { additionalProperties: false });
export const HostSnapshotValidator = Schema.Compile(HostSnapshotSchema);
const PatchHostStateSchema = Type.Object({
  ...state.properties,
  currentValues: Type.Record(Type.String(), Type.Unknown()),
  propertyDisplayPaths: Type.Record(Type.String(), Type.String()),
  directorySelections: Type.Record(Type.String(), Type.Unknown()),
}, { additionalProperties: false });
const PatchHostSnapshotSchema = Type.Object({ ...HostSnapshotSchema.properties, state: PatchHostStateSchema }, { additionalProperties: false });
const PatchHostSnapshotValidator = Schema.Compile(PatchHostSnapshotSchema);
const HostPatchSchema = Type.Array(patchEdit);
const HostPatchValidator = Schema.Compile(HostPatchSchema);
const HostMessageSchema = Type.Union([
  Type.Object({ kind: Type.Literal('snapshot'), revision: Type.Integer({ minimum: 0 }), snapshot: HostSnapshotSchema }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('patch'), revision: Type.Integer({ minimum: 0 }), patch: HostPatchSchema }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('audio'), frame: Type.Array(finite()) }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('performance'), snapshot: performance }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('notice'), message: Type.String() }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('result'), id: Type.Integer({ minimum: 0 }), error: Type.Optional(Type.String()) }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('ping') }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal('disconnect') }, { additionalProperties: false }),
]);
export const HostMessageValidator = Schema.Compile(HostMessageSchema);
export type HostSnapshot = Type.Static<typeof HostSnapshotSchema>;
export type HostMessage = Type.Static<typeof HostMessageSchema>;

function encodeRecord<T>(record: Record<string, T>): Record<string, T> {
  const encoded = Object.create(null) as Record<string, T>;
  for (const [key, value] of Object.entries(record))
    encoded[encodePatchKey(key)] = value;
  return encoded;
}

function decodeRecord<T>(record: Record<string, T>): Record<string, T> {
  const decoded = Object.create(null) as Record<string, T>;
  for (const [key, value] of Object.entries(record))
    decoded[decodePatchKey(key)] = value;
  return decoded;
}

function cloneKnownRecord<T>(record: Record<string, T>, keys: Record<string, unknown>): Record<string, T> {
  const clone = Object.create(null) as Record<string, T>;
  for (const key of Object.keys(keys)) {
    if (Object.hasOwn(record, key))
      clone[key] = Value.Clone(record[key]!);
  }
  return clone;
}

/** Cleans a clone, then parses it through the compiled editable draft contract. */
export function makeDraft(state: SimulatorState): Draft {
  const currentValues = cloneKnownRecord(state.currentValues, editableProperties);
  const cleaned = Value.Clean(DraftSchema, Value.Clone({
    currentValues: {},
    general: state.general,
    mediaActive: state.mediaActive,
    lastPlaybackState: state.lastPlaybackState,
    mediaProps: state.mediaProps,
    mediaTimeline: state.mediaTimeline,
    mediaThumb: state.mediaThumb,
  })) as { currentValues: unknown };
  cleaned.currentValues = currentValues;
  return DraftValidator.Parse(cleaned);
}

/** Removes fields absent from a validated record without replacing its reactive owner. */
export function cleanRecord(target: object, source: object): void {
  for (const key of Object.keys(target)) {
    if (!Object.hasOwn(source, key))
      Reflect.deleteProperty(target, key);
  }
}

/**
 * TypeBox 1.3 emits raw object keys in delta paths.  Keep property keys in a
 * reversible, pointer-safe namespace while diffing so Wallpaper Engine names
 * such as `gain/name` round-trip through Value.Patch.
 */
function encodePatchKey(key: string): string {
  return `@${encodeURIComponent(key).replaceAll('~', '%7E')}`;
}

function decodePatchKey(key: string): string {
  return decodeURIComponent(key.slice(1));
}

type PatchDraft = Type.Static<typeof PatchDraftSchema>;

function toPatchDraft(draft: Draft): PatchDraft {
  return Value.Clone({
    ...draft,
    currentValues: encodeRecord(draft.currentValues),
  }) as PatchDraft;
}

function fromPatchDraft(draft: unknown): Draft {
  const candidate = PatchDraftValidator.Parse(draft);
  const currentValues = decodeRecord(candidate.currentValues);
  return DraftValidator.Parse({ ...candidate, currentValues });
}

export function makeDraftPatch(before: Draft, next: Draft): DraftPatch {
  return DraftPatchValidator.Parse(Value.Diff(toPatchDraft(before), toPatchDraft(next)));
}

export function applyDraftPatch(before: Draft, patch: DraftPatch): Draft {
  const patched = Value.Patch(toPatchDraft(before), DraftPatchValidator.Parse(patch));
  return fromPatchDraft(patched);
}

export type HostPatch = Type.Static<typeof HostPatchSchema>;

type PatchHostSnapshot = Type.Static<typeof PatchHostSnapshotSchema>;

function toPatchHost(snapshot: HostSnapshot): PatchHostSnapshot {
  return Value.Clone({
    ...snapshot,
    state: {
      ...snapshot.state,
      currentValues: encodeRecord(snapshot.state.currentValues),
      propertyDisplayPaths: encodeRecord(snapshot.state.propertyDisplayPaths),
      directorySelections: encodeRecord(snapshot.state.directorySelections),
    },
  }) as PatchHostSnapshot;
}

function fromPatchHost(snapshot: unknown): HostSnapshot {
  const candidate = PatchHostSnapshotValidator.Parse(snapshot);
  return HostSnapshotValidator.Parse({
    ...candidate,
    state: {
      ...candidate.state,
      currentValues: decodeRecord(candidate.state.currentValues),
      propertyDisplayPaths: decodeRecord(candidate.state.propertyDisplayPaths),
      directorySelections: decodeRecord(candidate.state.directorySelections),
    },
  });
}

export function makeHostPatch(before: HostSnapshot, next: HostSnapshot): HostPatch {
  return HostPatchValidator.Parse(Value.Diff(toPatchHost(before), toPatchHost(next)));
}

export function applyHostPatch(before: HostSnapshot, patch: HostPatch): HostSnapshot {
  return fromPatchHost(Value.Patch(toPatchHost(before), HostPatchValidator.Parse(patch)));
}
