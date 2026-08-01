import { reactive, ref } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import type {
  WallpaperMediaPlaybackState,
  WallpaperMediaPropertiesEvent,
  WallpaperMediaThumbnailEvent,
  WallpaperMediaTimelineEvent,
  WallpaperPluginListener,
  WallpaperPropertyListener,
  WallpaperPropertyRuntimeValue,
  WallpaperUserProperties,
} from "../../wallpaper-engine/src/types/listeners";
import type { WallpaperPropertyDefinition } from "../../wallpaper-engine/src/types/project";
import { propDefs, tr } from "./config";

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
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return "";
}

function wrapValue(
  def: WallpaperPropertyDefinition,
  raw: unknown,
): WallpaperPropertyRuntimeValue {
  if (def.type === "combo") {
    const v = stringifyValue(raw);
    const found = def.options.find((o) => o.value === v);
    return { value: v, text: tr(found?.label ?? v) };
  }
  if (def.type === "bool") return { value: Boolean(raw) };
  if (def.type === "slider") return { value: Number(raw) };
  return { value: stringifyValue(raw) };
}

function createInitialValues(): WallpaperUserProperties {
  const values: WallpaperUserProperties = {};
  for (const [key, def] of Object.entries(propDefs)) {
    values[key] = wrapValue(def, def.value);
  }
  return values;
}

function isFetchAllDirectory(key: string): boolean {
  const def = propDefs[key];
  return def?.type === "directory" && def.mode === "fetchall";
}

/** Silently deliver to a listener list (no toast on empty). */
function deliver<T>(list: Array<(payload: T) => void>, payload: T): void {
  for (const fn of list) {
    try {
      fn(payload);
    } catch (e) {
      console.error("[WE Dev] listener threw", e);
    }
  }
}

/** Fan out with user-visible toast feedback (shows error when no listeners). */
function fanout<T>(
  list: Array<(payload: T) => void>,
  payload: T,
  label: string,
): void {
  if (list.length === 0) {
    toast(`No ${label} listener registered.`);
    return;
  }
  deliver(list, payload);
  toast(`Fired ${label}`);
}

// ---------------------------------------------------------------------------
// Pinia store
// ---------------------------------------------------------------------------

export const useDevtoolsStore = defineStore("devtools", () => {
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
  const currentValues = reactive<WallpaperUserProperties>(createInitialValues());
  const general = reactive({ fps: 60, paused: false });
  const directoryFiles = reactive<Record<string, string[]>>({});

  // --- media state ---
  const mediaActive = ref(false);
  const lastPlaybackState = ref<WallpaperMediaPlaybackState>(0);

  const mediaProps = reactive<WallpaperMediaPropertiesEvent>({
    title: "Test Track",
    artist: "Test Artist",
    albumTitle: "Test Album",
    contentType: "music",
  });

  const mediaTimeline = reactive<WallpaperMediaTimelineEvent>({
    position: 30,
    duration: 180,
  });

  const mediaThumb = reactive<WallpaperMediaThumbnailEvent>({
    thumbnail:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    primaryColor: "#202020",
    secondaryColor: "#404040",
    tertiaryColor: "#808080",
    textColor: "#ffffff",
    highContrastColor: "#ffffff",
  });

  // --- delivery helpers ---

  function deliverAllProperties(showToast = true): void {
    const l = listenerFns.property;
    if (!l) {
      if (showToast) toast("No property listener registered.");
      return;
    }
    const userProperties: WallpaperUserProperties = {};
    for (const [key, value] of Object.entries(currentValues)) {
      if (!isFetchAllDirectory(key)) userProperties[key] = value;
    }
    l.applyUserProperties?.(userProperties);
    l.applyGeneralProperties?.({ fps: general.fps });
    l.setPaused?.(general.paused);
    if (showToast) toast("Startup state replayed.");
  }

  function deliverProperty(key: string): void {
    if (isFetchAllDirectory(key)) return;
    const v = currentValues[key];
    if (!v) return;
    listenerFns.property?.applyUserProperties?.({ [key]: v });
  }

  /** Silently deliver all current media state to every registered media listener. */
  function deliverAllMedia(): void {
    const enabled = mediaActive.value;
    deliver(listenerFns.mediaStatus, { enabled });
    if (!enabled) return;

    deliver(listenerFns.mediaProps, { ...mediaProps });
    deliver(listenerFns.mediaPlayback, { state: lastPlaybackState.value });
    deliver(listenerFns.mediaTimeline, { ...mediaTimeline });
    deliver(listenerFns.mediaThumb, { ...mediaThumb });
  }

  return {
    // listener counts
    listenerCounts,
    // wallpaper property state
    currentValues,
    general,
    directoryFiles,
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
    deliverAllMedia,
  };
});
