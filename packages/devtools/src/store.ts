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
import { propDefs } from "./config";

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
    return { value: v, text: found?.label ?? v };
  }
  if (def.type === "bool") return { value: Boolean(raw) };
  if (def.type === "slider") return { value: Number(raw) };
  return { value: stringifyValue(raw) };
}

const initialValues: WallpaperUserProperties = {};
for (const [key, def] of Object.entries(propDefs)) {
  initialValues[key] = wrapValue(def, def.value);
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
  const currentValues = reactive<WallpaperUserProperties>({ ...initialValues });
  const general = reactive({ fps: 60 });
  const directoryFiles = reactive<Record<string, string[]>>({});

  // --- media state ---
  /** null = never explicitly set; false = disabled (default on boot) */
  const mediaActive = ref<boolean | null>(false);
  const lastPlaybackState = ref<WallpaperMediaPlaybackState | null>(0);

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
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23282828'/%3E%3Cpath d='M38 68V36l28-8v32' fill='none' stroke='%23555555' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='34' cy='68' r='8' fill='%23555555'/%3E%3Ccircle cx='62' cy='60' r='8' fill='%23555555'/%3E%3C/svg%3E",
    primaryColor: "#202020",
    secondaryColor: "#404040",
    tertiaryColor: "#808080",
    textColor: "#ffffff",
    highContrastColor: "#ffffff",
  });

  // --- delivery helpers ---

  function deliverAllProperties(): void {
    const l = listenerFns.property;
    if (!l) {
      toast("No property listener registered.");
      return;
    }
    l.applyUserProperties?.({ ...currentValues });
    l.applyGeneralProperties?.({ fps: general.fps });
    toast("Properties re-delivered.");
  }

  function deliverProperty(key: string): void {
    const v = currentValues[key];
    if (!v) return;
    listenerFns.property?.applyUserProperties?.({ [key]: v });
  }

  /** Silently deliver all current media state to every registered media listener. */
  function deliverAllMedia(): void {
    const enabled = mediaActive.value ?? false;
    deliver(listenerFns.mediaStatus, { enabled });
    // Only push media data events when enabling — mirrors real WE behavior where
    // disabling media does not re-fire thumbnail/props/timeline/playback events.
    if (enabled) {
      deliver(listenerFns.mediaProps, { ...mediaProps });
      if (lastPlaybackState.value !== null) {
        deliver(listenerFns.mediaPlayback, { state: lastPlaybackState.value });
      }
      deliver(listenerFns.mediaTimeline, { ...mediaTimeline });
      deliver(listenerFns.mediaThumb, { ...mediaThumb });
    }
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
