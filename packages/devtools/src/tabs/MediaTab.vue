<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { storeToRefs } from "pinia";
import Image from "~icons/ph/image-duotone";
import Music2 from "~icons/ph/music-notes-duotone";
import Radio from "~icons/ph/broadcast-duotone";
import Upload from "~icons/ph/upload-simple";
import { FastAverageColor } from "fast-average-color";
import type {
  WallpaperMediaPlaybackState,
  WallpaperMediaThumbnailEvent,
} from "../../../wallpaper-engine/src/types/listeners";
import { toast } from "vue-sonner";
import { listenerFns, useDevtoolsStore } from "../store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const store = useDevtoolsStore();
const {
  listenerCounts,
  mediaActive,
  lastPlaybackState,
  mediaProps,
  mediaTimeline,
  mediaThumb,
} = storeToRefs(store);
const timeline = mediaTimeline;
const thumb = mediaThumb;
const thumbnailInput = shallowRef<HTMLInputElement | null>(null);
const averageColor = new FastAverageColor();

const mediaListenerCount = computed(
  () =>
    listenerCounts.value.mediaStatus +
    listenerCounts.value.mediaProps +
    listenerCounts.value.mediaThumb +
    listenerCounts.value.mediaPlayback +
    listenerCounts.value.mediaTimeline,
);

const playbackStates: Array<{
  state: WallpaperMediaPlaybackState;
  label: string;
}> = [
  { state: 0, label: "Playing" },
  { state: 1, label: "Paused" },
  { state: 2, label: "Stopped" },
];

const paletteFields: Array<{
  key: Exclude<keyof WallpaperMediaThumbnailEvent, "thumbnail">;
  label: string;
}> = [
  { key: "primaryColor", label: "Primary" },
  { key: "secondaryColor", label: "Secondary" },
  { key: "tertiaryColor", label: "Tertiary" },
  { key: "textColor", label: "Text" },
  { key: "highContrastColor", label: "High contrast" },
];

function requireMedia(): boolean {
  if (mediaActive.value) return true;
  toast("Enable media integration before sending media events.");
  return false;
}

function setMediaEnabled(enabled: boolean): void {
  mediaActive.value = enabled;
  store.deliverAllMedia();
  toast(enabled ? "Media integration enabled." : "Media integration disabled.");
}

function sendProperties(): void {
  if (!requireMedia()) return;
  store.fanout(listenerFns.mediaProps, { ...mediaProps.value }, "media properties");
}

function setContentType(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  if (value === "music" || value === "video" || value === "image") {
    mediaProps.value.contentType = value;
  }
}

function sendPlayback(state: WallpaperMediaPlaybackState): void {
  if (!requireMedia()) return;
  lastPlaybackState.value = state;
  store.fanout(listenerFns.mediaPlayback, { state }, "media playback");
}

function setPosition(value: number): void {
  timeline.value.position = Math.min(
    Math.max(0, value),
    Math.max(0, timeline.value.duration),
  );
}

function setDuration(value: number): void {
  timeline.value.duration = Math.max(0, value);
  timeline.value.position = Math.min(
    timeline.value.position,
    timeline.value.duration,
  );
}

function sendTimeline(): void {
  if (!requireMedia()) return;
  setPosition(timeline.value.position);
  store.fanout(
    listenerFns.mediaTimeline,
    { ...timeline.value },
    "media timeline",
  );
}

function pickThumbnail(): void {
  thumbnailInput.value?.click();
}

async function onThumbnailFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.type !== "image/png") {
    toast("Wallpaper Engine thumbnails must be PNG images.");
    input.value = "";
    return;
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  thumb.value.thumbnail = dataUrl;

  try {
    const image = new globalThis.Image();
    image.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to decode PNG"));
    });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const [full, topLeft, bottomRight] = await Promise.all([
      averageColor.getColorAsync(image),
      averageColor.getColorAsync(image, {
        left: 0,
        top: 0,
        width: Math.max(1, Math.floor(width / 2)),
        height: Math.max(1, Math.floor(height / 2)),
      }),
      averageColor.getColorAsync(image, {
        left: Math.floor(width / 2),
        top: Math.floor(height / 2),
        width: Math.max(1, Math.ceil(width / 2)),
        height: Math.max(1, Math.ceil(height / 2)),
      }),
    ]);
    thumb.value.primaryColor = full.hex;
    thumb.value.secondaryColor = topLeft.hex;
    thumb.value.tertiaryColor = bottomRight.hex;
    thumb.value.textColor = full.isDark ? "#ffffff" : "#000000";
    thumb.value.highContrastColor = full.isDark ? "#ffffff" : "#000000";
  } catch (error) {
    console.warn("[WE Dev] Unable to extract thumbnail colors", error);
    toast("PNG loaded, but its palette could not be extracted.");
  }
  input.value = "";
}

function sendThumbnail(): void {
  if (!requireMedia()) return;
  if (!thumb.value.thumbnail.startsWith("data:image/png;base64,")) {
    toast("Choose a PNG thumbnail before sending.");
    return;
  }
  store.fanout(
    listenerFns.mediaThumb,
    { ...thumb.value },
    "media thumbnail",
  );
}
</script>

<template>
  <div class="space-y-3">
    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">Media integration</h2>
          <p class="we-card-description">
            Enabling sends the complete current media state; disabling sends status only.
          </p>
        </div>
        <div
          class="flex size-8 items-center justify-center rounded-lg"
          :class="
            mediaActive
              ? 'bg-emerald-400/15 text-emerald-300'
              : 'bg-we-panel text-we-faint'
          "
        >
          <Radio class="size-4" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          :variant="mediaActive ? 'default' : 'outline'"
          class="h-8 text-[11px]"
          @click="setMediaEnabled(true)"
        >
          Enabled
        </Button>
        <Button
          size="sm"
          :variant="!mediaActive ? 'secondary' : 'outline'"
          class="h-8 text-[11px]"
          @click="setMediaEnabled(false)"
        >
          Disabled
        </Button>
      </div>
      <div class="mt-2 flex items-center justify-between text-[10px] text-we-faint">
        <span>{{ mediaListenerCount }} registered callbacks</span>
        <span>Status · Metadata · Artwork · Playback · Timeline</span>
      </div>
    </section>

    <section class="we-card" :class="!mediaActive ? 'opacity-60' : ''">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">Now playing</h2>
          <p class="we-card-description">Track metadata exposed by the host media session.</p>
        </div>
        <Music2 class="size-4 text-we-faint" />
      </div>
      <div class="space-y-2.5">
        <div class="we-field">
          <Label for="media-title" class="we-field-label">Title</Label>
          <Input id="media-title" v-model="mediaProps.title" class="h-8 text-xs" />
        </div>
        <div class="we-field">
          <Label for="media-artist" class="we-field-label">Artist</Label>
          <Input id="media-artist" v-model="mediaProps.artist" class="h-8 text-xs" />
        </div>
        <div class="we-field">
          <Label for="media-album" class="we-field-label">Album</Label>
          <Input id="media-album" v-model="mediaProps.albumTitle" class="h-8 text-xs" />
        </div>
        <div class="we-field">
          <Label for="media-content-type" class="we-field-label">Content type</Label>
          <NativeSelect
            id="media-content-type"
            :model-value="mediaProps.contentType"
            class="h-8 text-xs"
            @change="setContentType"
          >
            <NativeSelectOption value="music">Music</NativeSelectOption>
            <NativeSelectOption value="video">Video</NativeSelectOption>
            <NativeSelectOption value="image">Image</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <div class="mt-3 flex justify-end">
        <Button size="sm" class="h-8 px-3 text-[11px]" :disabled="!mediaActive" @click="sendProperties">
          Send metadata
        </Button>
      </div>
    </section>

    <section class="we-card" :class="!mediaActive ? 'opacity-60' : ''">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">Playback</h2>
          <p class="we-card-description">Transport state and timeline use separate callbacks.</p>
        </div>
      </div>
      <ToggleGroup
        type="single"
        :model-value="String(lastPlaybackState)"
        class="mb-3 grid grid-cols-3 gap-1"
        @update:model-value="
          (value) => {
            if (value) sendPlayback(Number(value) as WallpaperMediaPlaybackState);
          }
        "
      >
        <ToggleGroupItem
          v-for="playback in playbackStates"
          :key="playback.state"
          :value="String(playback.state)"
          :disabled="!mediaActive"
          class="h-8 text-[11px]"
        >
          {{ playback.label }}
        </ToggleGroupItem>
      </ToggleGroup>

      <div class="grid grid-cols-2 gap-2">
        <NumberField
          id="media-position"
          :model-value="timeline.position"
          :min="0"
          :max="timeline.duration"
          @update:model-value="(value) => value !== undefined && setPosition(value)"
        >
          <Label for="media-position" class="mb-1 block text-[10px] text-we-faint">Position (s)</Label>
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
        <NumberField
          id="media-duration"
          :model-value="timeline.duration"
          :min="0"
          @update:model-value="(value) => value !== undefined && setDuration(value)"
        >
          <Label for="media-duration" class="mb-1 block text-[10px] text-we-faint">Duration (s)</Label>
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </div>
      <div class="mt-3 flex justify-end">
        <Button size="sm" variant="outline" class="h-8 px-3 text-[11px]" :disabled="!mediaActive" @click="sendTimeline">
          Send timeline
        </Button>
      </div>
    </section>

    <section class="we-card" :class="!mediaActive ? 'opacity-60' : ''">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">Artwork</h2>
          <p class="we-card-description">Wallpaper Engine provides album art as a base64 PNG.</p>
        </div>
        <Image class="size-4 text-we-faint" />
      </div>

      <input
        ref="thumbnailInput"
        type="file"
        accept="image/png"
        class="hidden"
        @change="onThumbnailFile"
      />

      <div class="flex items-center gap-3">
        <div class="size-18 shrink-0 overflow-hidden rounded-lg border border-we-border bg-we-panel">
          <img :src="thumb.thumbnail" alt="Media artwork preview" class="size-full object-cover" />
        </div>
        <div class="min-w-0 flex-1">
          <Button size="sm" variant="outline" class="h-8 gap-1.5 text-[11px]" @click="pickThumbnail">
            <Upload class="size-3" />
            Choose PNG
          </Button>
          <p class="mt-2 text-[10px] leading-relaxed text-we-faint">
            Selecting an image also extracts the five host palette colors.
          </p>
        </div>
      </div>

      <details class="mt-3 rounded-md border border-we-border bg-we-panel/50">
        <summary class="cursor-pointer px-3 py-2 text-[11px] font-medium text-we-muted">
          Adjust extracted palette
        </summary>
        <div class="space-y-2 border-t border-we-border p-3">
          <div v-for="field in paletteFields" :key="field.key" class="we-field">
            <Label :for="`thumb-${field.key}`" class="we-field-label">{{ field.label }}</Label>
            <div class="flex gap-2">
              <input
                :id="`thumb-${field.key}`"
                v-model="thumb[field.key]"
                type="color"
                class="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-we-border bg-we-btn p-1"
              />
              <Input v-model="thumb[field.key]" class="h-8 font-mono text-[11px]" />
            </div>
          </div>
        </div>
      </details>

      <div class="mt-3 flex justify-end">
        <Button size="sm" class="h-8 px-3 text-[11px]" :disabled="!mediaActive" @click="sendThumbnail">
          Send artwork
        </Button>
      </div>
    </section>
  </div>
</template>
