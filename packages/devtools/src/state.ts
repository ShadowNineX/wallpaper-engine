import { reactive, ref } from "vue";
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
// Listener slots — non-reactive actual callbacks
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

/** Reactive presence/counts mirroring `listenerFns`. */
export const listenerCounts = reactive({
  property: false,
  plugin: false,
  audio: 0,
  mediaStatus: 0,
  mediaProps: 0,
  mediaThumb: 0,
  mediaPlayback: 0,
  mediaTimeline: 0,
});

// ---------------------------------------------------------------------------
// Reactive UI state
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

export const currentValues = reactive<WallpaperUserProperties>(initialValues);
export const general = reactive({ fps: 60 });
export const directoryFiles = reactive<Record<string, string[]>>({});
export const lastToast = ref<string>("");

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string): void {
  lastToast.value = msg;
  if (toastTimer !== undefined) clearTimeout(toastTimer);
  toastTimer = globalThis.setTimeout(() => {
    lastToast.value = "";
  }, 1600);
}

// ---------------------------------------------------------------------------
// Delivery helpers
// ---------------------------------------------------------------------------

export function deliverAllProperties(): void {
  const l = listenerFns.property;
  if (!l) return;
  l.applyUserProperties?.({ ...currentValues });
  l.applyGeneralProperties?.({ fps: general.fps });
}

export function deliverProperty(key: string): void {
  const v = currentValues[key];
  if (!v) return;
  listenerFns.property?.applyUserProperties?.({ [key]: v });
}

/** Fan an event out to every registered listener of a kind. */
export function fanout<T>(
  list: Array<(payload: T) => void>,
  payload: T,
  label: string,
): void {
  if (list.length === 0) {
    toast(`No ${label} listener registered.`);
    return;
  }
  for (const fn of list) {
    try {
      fn(payload);
    } catch (e) {
      console.error(`[WE Dev] ${label} listener threw`, e);
    }
  }
  toast(`Fired ${label}`);
}
