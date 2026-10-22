import type {
  DevDirectorySelection,
  DevFileEntry,
} from '../../wallpaper-engine/src/types/dev-files';
import type {
  WallpaperMediaPlaybackState,
  WallpaperMediaPropertiesEvent,
  WallpaperMediaThumbnailEvent,
  WallpaperMediaTimelineEvent,
  WallpaperPluginListener,
  WallpaperPropertyListener,
  WallpaperPropertyRuntimeValue,
  WallpaperUserProperties,
} from '../../wallpaper-engine/src/types/listeners';
import type { WallpaperPropertyDefinition } from '../../wallpaper-engine/src/types/project';
import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { invokeHostCallback } from './callbacks';
import { propDefs, tr } from './config';
import { releaseDevDirectory, releaseDevFile } from './dev-files';
import { notify } from './notifications';

type RuntimePropertyDefinition = Exclude<
  WallpaperPropertyDefinition,
  { type: 'group' | 'divider' }
>;

interface DirectoryChangeSummary {
  addedOrChanged: string[];
  removed: string[];
}

// ---------------------------------------------------------------------------
// Listener slots — plain (non-reactive) callbacks; exported at module level
// so globals.ts can access them before Pinia is active.
// ---------------------------------------------------------------------------

export const listenerFns = {
  property: undefined as WallpaperPropertyListener | undefined,
  plugin: undefined as WallpaperPluginListener | undefined,
  audio: [] as Array<(data: number[]) => void>,
  mediaStatus: [] as Array<(e: { enabled: boolean }) => void>,
  mediaProps: [] as Array<(e: WallpaperMediaPropertiesEvent) => void>,
  mediaThumb: [] as Array<(e: WallpaperMediaThumbnailEvent) => void>,
  mediaPlayback: [] as Array<
    (e: { state: WallpaperMediaPlaybackState }) => void
  >,
  mediaTimeline: [] as Array<(e: WallpaperMediaTimelineEvent) => void>,
};

// ---------------------------------------------------------------------------
// Value helpers (used to build initial property values)
// ---------------------------------------------------------------------------

function stringifyValue(raw: unknown): string {
  if (raw == null)
    return '';
  if (typeof raw === 'string')
    return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean')
    return String(raw);
  return '';
}

function wrapValue(
  def: RuntimePropertyDefinition,
  raw: unknown,
): WallpaperPropertyRuntimeValue {
  if (def.type === 'combo') {
    const v = stringifyValue(raw);
    const found = def.options.find(o => o.value === v);
    return { value: v, text: tr(found?.label ?? v) };
  }
  if (def.type === 'bool')
    return { value: Boolean(raw) };
  if (def.type === 'slider')
    return { value: Number(raw) };
  return { value: stringifyValue(raw) };
}

function createInitialValues(): WallpaperUserProperties {
  const values: WallpaperUserProperties = {};
  for (const [key, def] of Object.entries(propDefs)) {
    if (def.type === 'group' || def.type === 'divider')
      continue;
    values[key] = wrapValue(def, def.value);
  }
  return values;
}

function createInitialDisplayPaths(): Record<string, string> {
  const paths: Record<string, string> = {};
  for (const [key, def] of Object.entries(propDefs)) {
    if (def.type === 'file' || def.type === 'directory') {
      paths[key] = def.value;
    }
  }
  return paths;
}

function isFetchAllDirectory(key: string): boolean {
  const def = propDefs[key];
  return def?.type === 'directory' && def.mode === 'fetchall';
}

function clonePropertyValue(
  value: WallpaperPropertyRuntimeValue,
): WallpaperPropertyRuntimeValue {
  return { ...value } as WallpaperPropertyRuntimeValue;
}

function collectDeliverableProperties(values: WallpaperUserProperties): WallpaperUserProperties {
  const userProperties: WallpaperUserProperties = {};
  for (const [key, value] of Object.entries(values)) {
    if (!isFetchAllDirectory(key))
      userProperties[key] = clonePropertyValue(value);
  }
  return userProperties;
}

function deliverSelectedDirectories(
  listener: WallpaperPropertyListener,
  selections: Record<string, DevDirectorySelection>,
): boolean {
  let succeeded = true;
  for (const [key, selection] of Object.entries(selections)) {
    if (!isFetchAllDirectory(key) || selection.files.length === 0)
      continue;
    const delivered = invokeHostCallback(() => listener.userDirectoryFilesAddedOrChanged?.(
      key,
      selection.files.map(file => file.url),
    ), false);
    succeeded = delivered && succeeded;
  }
  return succeeded;
}

function firePluginLoaded(name: 'led' | 'cue'): void {
  const listener = listenerFns.plugin;
  if (!listener?.onPluginLoaded) {
    notify('No onPluginLoaded listener registered.');
    return;
  }
  if (invokeHostCallback(() => listener.onPluginLoaded?.(name, '0.0.0-dev')))
    notify(`${name === 'led' ? 'LED' : 'iCUE'} plugin loaded.`);
}

/** Silently deliver to a listener list (no toast on empty). */
function deliver<T>(list: Array<(payload: T) => void>, payload: T): boolean {
  let succeeded = true;
  for (const fn of list) {
    try {
      fn(payload);
    }
    catch (e) {
      succeeded = false;
      console.error('[WE Dev] listener threw', e);
    }
  }
  return succeeded;
}

/** Fan out with user-visible toast feedback (shows error when no listeners). */
function fanout<T>(
  list: Array<(payload: T) => void>,
  payload: T,
  label: string,
): boolean {
  if (list.length === 0) {
    notify(`No ${label} listener registered.`);
    return false;
  }
  const succeeded = deliver(list, payload);
  notify(succeeded
    ? `Sent ${label}.`
    : `Some ${label} callbacks failed. Check the browser console for details.`);
  return succeeded;
}

// ---------------------------------------------------------------------------
// Pinia store
// ---------------------------------------------------------------------------

export const useDevtoolsStore = defineStore('devtools', () => {
  // --- listener counts (reactive mirrors of listenerFns lengths) ---
  const listenerCounts = reactive({
    property: false,
    plugin: false,
    audio: 0,
    mediaStatus: 0,
    mediaProps: 0,
    mediaThumb: 0,
    mediaPlayback: 0,
    mediaTimeline: 0,
  });

  // --- wallpaper property state ---
  const currentValues = reactive<WallpaperUserProperties>(
    createInitialValues(),
  );
  const propertyDisplayPaths = reactive<Record<string, string>>(
    createInitialDisplayPaths(),
  );
  const general = reactive({ fps: 60, paused: false });
  const directoryFiles = reactive<Record<string, string[]>>({});
  const directorySelections = reactive<Record<string, DevDirectorySelection>>(
    {},
  );

  // --- media state ---
  const mediaActive = ref(false);
  const lastPlaybackState = ref<WallpaperMediaPlaybackState>(0);

  const mediaProps = reactive<WallpaperMediaPropertiesEvent>({
    title: 'Test Track',
    artist: 'Test Artist',
    albumTitle: 'Test Album',
    contentType: 'music',
  });

  const mediaTimeline = reactive<WallpaperMediaTimelineEvent>({
    position: 30,
    duration: 180,
  });

  const mediaThumb = reactive<WallpaperMediaThumbnailEvent>({
    thumbnail:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    primaryColor: '#202020',
    secondaryColor: '#404040',
    tertiaryColor: '#808080',
    textColor: '#ffffff',
    highContrastColor: '#ffffff',
  });

  // --- delivery helpers ---

  function deliverAllProperties(showToast = true): void {
    const l = listenerFns.property;
    if (!l) {
      if (showToast)
        notify('No property listener registered.');
      return;
    }
    const userProperties = collectDeliverableProperties(currentValues);
    let succeeded = invokeHostCallback(() => l.applyUserProperties?.(userProperties), false);
    succeeded = deliverSelectedDirectories(l, directorySelections) && succeeded;
    const generalDelivered = invokeHostCallback(() => l.applyGeneralProperties?.({ fps: general.fps }), false);
    const pauseDelivered = invokeHostCallback(() => l.setPaused?.(general.paused), false);
    if (showToast) {
      notify(succeeded && generalDelivered && pauseDelivered
        ? 'Startup state replayed.'
        : 'Some wallpaper callbacks failed. Check the browser console for details.');
    }
  }

  function deliverProperty(key: string): void {
    if (isFetchAllDirectory(key))
      return;
    const v = currentValues[key];
    if (!v)
      return;
    invokeHostCallback(() => listenerFns.property?.applyUserProperties?.({
      [key]: clonePropertyValue(v),
    }));
  }

  function resetPropertiesToDefaults(): void {
    const previousFileUrls: string[] = [];
    const previousDirectories = Object.entries(directorySelections);

    for (const [key, definition] of Object.entries(propDefs)) {
      if (definition.type !== 'file')
        continue;
      const value = currentValues[key]?.value;
      if (typeof value === 'string' && value !== definition.value)
        previousFileUrls.push(value);
    }

    const defaults = createInitialValues();
    for (const key of Object.keys(currentValues))
      delete currentValues[key];
    Object.assign(currentValues, defaults);

    const displayPaths = createInitialDisplayPaths();
    for (const key of Object.keys(propertyDisplayPaths))
      delete propertyDisplayPaths[key];
    Object.assign(propertyDisplayPaths, displayPaths);

    for (const key of Object.keys(directoryFiles))
      delete directoryFiles[key];
    for (const key of Object.keys(directorySelections))
      delete directorySelections[key];

    const userProperties: WallpaperUserProperties = {};
    for (const [key, value] of Object.entries(defaults)) {
      if (!isFetchAllDirectory(key))
        userProperties[key] = clonePropertyValue(value);
    }

    try {
      listenerFns.property?.applyUserProperties?.(userProperties);
    }
    catch (error) {
      console.error('[WE Dev] property listener threw', error);
    }

    for (const [key, selection] of previousDirectories) {
      if (isFetchAllDirectory(key))
        notifyDirectoryChanges(key, selection, undefined);
    }

    for (const url of previousFileUrls)
      releaseDevFile(url);
    for (const [, selection] of previousDirectories)
      releaseDevDirectory(selection.id);

    notify('Properties reset to defaults.');
  }

  function setFileSelection(key: string, selection: DevFileEntry): void {
    if (propDefs[key]?.type !== 'file')
      return;
    const value = currentValues[key];
    if (!value)
      return;
    propertyDisplayPaths[key] = selection.path;
    value.value = selection.url;
    deliverProperty(key);
  }

  function clearFileSelection(key: string): void {
    if (propDefs[key]?.type !== 'file')
      return;
    const value = currentValues[key];
    if (!value)
      return;
    propertyDisplayPaths[key] = '';
    value.value = '';
    deliverProperty(key);
  }

  function notifyDirectoryChanges(
    key: string,
    previous: DevDirectorySelection | undefined,
    next: DevDirectorySelection | undefined,
  ): DirectoryChangeSummary {
    const previousByPath = new Map(
      previous?.files.map(file => [file.relativePath, file]) ?? [],
    );
    const nextByPath = new Map(
      next?.files.map(file => [file.relativePath, file]) ?? [],
    );
    const removed = [...previousByPath]
      .filter(([path, file]) => {
        const replacement = nextByPath.get(path);
        return replacement?.url !== file.url;
      })
      .map(([, file]) => file.url);
    const addedOrChanged = [...nextByPath]
      .filter(([path, file]) => {
        const old = previousByPath.get(path);
        return (
          old?.size !== file.size
          || old.mtimeMs !== file.mtimeMs
          || old.url !== file.url
        );
      })
      .map(([, file]) => file.url);

    if (removed.length > 0) {
      try {
        listenerFns.property?.userDirectoryFilesRemoved?.(key, removed);
      }
      catch (error) {
        console.error('[WE Dev] directory removal listener threw', error);
      }
    }
    if (addedOrChanged.length > 0) {
      try {
        listenerFns.property?.userDirectoryFilesAddedOrChanged?.(
          key,
          addedOrChanged,
        );
      }
      catch (error) {
        console.error('[WE Dev] directory change listener threw', error);
      }
    }
    return { addedOrChanged, removed };
  }

  function setDirectorySelection(
    key: string,
    selection: DevDirectorySelection,
  ): DirectoryChangeSummary {
    const definition = propDefs[key];
    if (definition?.type !== 'directory') {
      return { addedOrChanged: [], removed: [] };
    }
    const previous = directorySelections[key];
    directorySelections[key] = selection;
    directoryFiles[key] = selection.files.map(file => file.url);
    propertyDisplayPaths[key] = selection.path;
    const value = currentValues[key];
    if (value)
      value.value = selection.path;

    if (definition.mode === 'ondemand') {
      deliverProperty(key);
      return { addedOrChanged: [], removed: [] };
    }
    return notifyDirectoryChanges(key, previous, selection);
  }

  function clearDirectorySelection(key: string): DirectoryChangeSummary {
    const definition = propDefs[key];
    if (definition?.type !== 'directory') {
      return { addedOrChanged: [], removed: [] };
    }
    const previous = directorySelections[key];
    delete directorySelections[key];
    directoryFiles[key] = [];
    propertyDisplayPaths[key] = '';
    const value = currentValues[key];
    if (value)
      value.value = '';

    if (definition.mode === 'ondemand') {
      deliverProperty(key);
      return { addedOrChanged: [], removed: [] };
    }
    return notifyDirectoryChanges(key, previous, undefined);
  }

  /** Silently deliver all current media state to every registered media listener. */
  function deliverAllMedia(): boolean {
    const enabled = mediaActive.value;
    const statusDelivered = deliver(listenerFns.mediaStatus, { enabled });
    if (!enabled)
      return statusDelivered;

    const propertiesDelivered = deliver(listenerFns.mediaProps, { ...mediaProps });
    const playbackDelivered = deliver(listenerFns.mediaPlayback, { state: lastPlaybackState.value });
    const timelineDelivered = deliver(listenerFns.mediaTimeline, { ...mediaTimeline });
    const thumbnailDelivered = deliver(listenerFns.mediaThumb, { ...mediaThumb });
    return statusDelivered && propertiesDelivered && playbackDelivered && timelineDelivered && thumbnailDelivered;
  }

  function applyFps(): void {
    if (!Number.isFinite(general.fps)) {
      notify('Enter a valid FPS limit before sending.');
      return;
    }
    const listener = listenerFns.property;
    if (!listener?.applyGeneralProperties) {
      notify('No applyGeneralProperties listener registered.');
      return;
    }
    if (invokeHostCallback(() => listener.applyGeneralProperties?.({ fps: general.fps })))
      notify(`FPS limit sent: ${general.fps === 0 ? 'unlimited' : general.fps}`);
  }

  function applyPaused(paused: boolean): void {
    general.paused = paused;
    const listener = listenerFns.property;
    if (!listener?.setPaused) {
      notify('No setPaused listener registered.');
      return;
    }
    if (invokeHostCallback(() => listener.setPaused?.(paused)))
      notify(paused ? 'Wallpaper paused.' : 'Wallpaper resumed.');
  }

  function requireActiveMedia(): boolean {
    if (mediaActive.value)
      return true;
    notify('Enable media integration before sending media events.');
    return false;
  }

  function setMediaEnabled(enabled: boolean): void {
    mediaActive.value = enabled;
    if (deliverAllMedia())
      notify(enabled ? 'Media integration enabled.' : 'Media integration disabled.');
    else
      notify('Some media callbacks failed. Check the browser console for details.');
  }

  function sendMediaProperties(): void {
    if (requireActiveMedia())
      fanout(listenerFns.mediaProps, { ...mediaProps }, 'media properties');
  }

  function sendMediaPlayback(state: WallpaperMediaPlaybackState): void {
    if (!requireActiveMedia())
      return;
    lastPlaybackState.value = state;
    fanout(listenerFns.mediaPlayback, { state }, 'media playback');
  }

  function sendMediaTimeline(): void {
    if (requireActiveMedia())
      fanout(listenerFns.mediaTimeline, { ...mediaTimeline }, 'media timeline');
  }

  function sendMediaArtwork(): void {
    if (!requireActiveMedia())
      return;
    if (!mediaThumb.thumbnail.startsWith('data:image/png;base64,')) {
      notify('Choose a PNG thumbnail before sending.');
      return;
    }
    fanout(listenerFns.mediaThumb, { ...mediaThumb }, 'media thumbnail');
  }

  return {
    // listener counts
    listenerCounts,
    // wallpaper property state
    currentValues,
    general,
    directoryFiles,
    propertyDisplayPaths,
    directorySelections,
    // media state
    mediaActive,
    lastPlaybackState,
    mediaProps,
    mediaTimeline,
    mediaThumb,
    // actions
    fanout,
    deliverAllProperties,
    deliverProperty,
    resetPropertiesToDefaults,
    setFileSelection,
    clearFileSelection,
    setDirectorySelection,
    clearDirectorySelection,
    deliverAllMedia,
    applyFps,
    applyPaused,
    firePluginLoaded,
    setMediaEnabled,
    sendMediaProperties,
    sendMediaPlayback,
    sendMediaTimeline,
    sendMediaArtwork,
  };
});
