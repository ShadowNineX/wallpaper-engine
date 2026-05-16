<script setup lang="ts">
import { ref, shallowRef } from "vue";
import { storeToRefs } from "pinia";
import { FastAverageColor } from "fast-average-color";
import type { WallpaperMediaPlaybackState } from "../../../wallpaper-engine/src/types/listeners";
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

const store = useDevtoolsStore();
const {
  mediaActive,
  lastPlaybackState,
  mediaProps,
  mediaTimeline,
  mediaThumb,
} = storeToRefs(store);
const { fanout, deliverAllMedia } = store;

// alias for template clarity
const timeline = mediaTimeline;
const thumb = mediaThumb;

const fac = new FastAverageColor();
const thumbFileInput = shallowRef<HTMLInputElement | null>(null);
const thumbIsVideo = ref(false);

function pickThumbFile(): void {
  thumbFileInput.value?.click();
}

async function onThumbFile(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  thumbIsVideo.value = file.type.startsWith("video/");

  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
  thumb.value.thumbnail = dataUrl;

  if (!thumbIsVideo.value) {
    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const [full, topLeft, bottomRight] = await Promise.all([
        fac.getColorAsync(img),
        fac.getColorAsync(img, {
          left: 0,
          top: 0,
          width: Math.floor(w / 2),
          height: Math.floor(h / 2),
        }),
        fac.getColorAsync(img, {
          left: Math.floor(w / 2),
          top: Math.floor(h / 2),
          width: Math.floor(w / 2),
          height: Math.floor(h / 2),
        }),
      ]);
      thumb.value.primaryColor = full.hex;
      thumb.value.secondaryColor = topLeft.hex;
      thumb.value.tertiaryColor = bottomRight.hex;
      thumb.value.textColor = full.isDark ? "#ffffff" : "#000000";
      thumb.value.highContrastColor = full.isDark ? "#ffffff" : "#000000";
    } catch {
      // silently keep existing colors
    }
  }
}

const playbackButtons: Array<{
  state: WallpaperMediaPlaybackState;
  label: string;
}> = [
  { state: 0, label: "PLAYING" },
  { state: 1, label: "PAUSED" },
  { state: 2, label: "STOPPED" },
];

function fireStatus(enabled: boolean): void {
  mediaActive.value = enabled;
  deliverAllMedia();
}
function fireProps(): void {
  fanout(listenerFns.mediaProps, { ...mediaProps.value }, "media properties");
}
function fireThumb(): void {
  fanout(listenerFns.mediaThumb, { ...thumb.value }, "media thumbnail");
}
function firePlayback(state: WallpaperMediaPlaybackState): void {
  lastPlaybackState.value = state;
  fanout(listenerFns.mediaPlayback, { state }, "media playback");
}
function fireTimeline(): void {
  fanout(listenerFns.mediaTimeline, { ...timeline.value }, "media timeline");
}

function firePluginLoaded(name: string): void {
  const l = listenerFns.plugin;
  if (!l?.onPluginLoaded) {
    toast("No plugin listener");
    return;
  }
  l.onPluginLoaded(name, "0.0.0-dev");
  toast(`Fired onPluginLoaded(${name})`);
}
</script>

<template>
  <div class="space-y-3">
    <section
      class="space-y-2 rounded-md border border-we-border bg-we-section p-2.5"
    >
      <div class="flex items-center justify-between">
        <h3
          class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
        >
          Media status
        </h3>
        <span v-if="mediaActive !== null" class="flex items-center gap-1.5">
          <span
            class="inline-block size-1.5 rounded-full transition-colors"
            :class="mediaActive ? 'bg-emerald-400' : 'bg-zinc-500'"
          />
          <span class="text-[10px] text-we-faint">{{
            mediaActive ? "active" : "inactive"
          }}</span>
        </span>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <Button
          size="sm"
          :variant="mediaActive === true ? 'default' : 'outline'"
          class="w-full"
          @click="fireStatus(true)"
          >Enabled</Button
        >
        <Button
          size="sm"
          :variant="mediaActive === false ? 'default' : 'outline'"
          class="w-full"
          @click="fireStatus(false)"
          >Disabled</Button
        >
      </div>
    </section>

    <section
      class="space-y-2 rounded-md border border-we-border bg-we-section p-2.5"
    >
      <h3
        class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
      >
        Media properties
      </h3>
      <div class="grid grid-cols-[110px_1fr] items-center gap-2">
        <Label for="media-title" class="text-[11px] text-we-muted">Title</Label>
        <Input
          id="media-title"
          v-model="mediaProps.title"
          type="text"
          class="h-7 text-xs"
        />
      </div>
      <div class="grid grid-cols-[110px_1fr] items-center gap-2">
        <Label for="media-artist" class="text-[11px] text-we-muted"
          >Artist</Label
        >
        <Input
          id="media-artist"
          v-model="mediaProps.artist"
          type="text"
          class="h-7 text-xs"
        />
      </div>
      <div class="grid grid-cols-[110px_1fr] items-center gap-2">
        <Label for="media-album" class="text-[11px] text-we-muted">Album</Label>
        <Input
          id="media-album"
          v-model="mediaProps.albumTitle"
          type="text"
          class="h-7 text-xs"
        />
      </div>
      <Button size="sm" class="w-full" @click="fireProps"
        >Fire properties</Button
      >
    </section>

    <section
      class="space-y-2 rounded-md border border-we-border bg-we-section p-2.5"
    >
      <h3
        class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
      >
        Media playback
      </h3>
      <ToggleGroup
        type="single"
        :model-value="
          lastPlaybackState !== null ? String(lastPlaybackState) : undefined
        "
        size="sm"
        class="flex flex-wrap justify-start gap-1.5"
        @update:model-value="
          (v) => {
            if (v !== undefined)
              firePlayback(Number(v) as WallpaperMediaPlaybackState);
          }
        "
      >
        <ToggleGroupItem
          v-for="pb in playbackButtons"
          :key="pb.state"
          :value="String(pb.state)"
          class="h-7 text-xs"
        >
          {{ pb.label }}
        </ToggleGroupItem>
      </ToggleGroup>
    </section>

    <section
      class="space-y-2 rounded-md border border-we-border bg-we-section p-2.5"
    >
      <h3
        class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
      >
        Media timeline
      </h3>
      <NumberField
        id="media-position"
        :model-value="timeline.position"
        :min="0"
        @update:model-value="
          (v) => {
            if (v !== undefined) timeline.position = v;
          }
        "
      >
        <Label for="media-position" class="text-[11px] text-we-muted"
          >position</Label
        >
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
        @update:model-value="
          (v) => {
            if (v !== undefined) timeline.duration = v;
          }
        "
      >
        <Label for="media-duration" class="text-[11px] text-we-muted"
          >duration</Label
        >
        <NumberFieldContent>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldContent>
      </NumberField>
      <Button size="sm" class="w-full" @click="fireTimeline"
        >Fire timeline</Button
      >
    </section>

    <section
      class="space-y-2 rounded-md border border-we-border bg-we-section p-2.5"
    >
      <h3
        class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
      >
        Media thumbnail
      </h3>

      <input
        ref="thumbFileInput"
        type="file"
        accept="image/*,video/*"
        class="hidden"
        @change="onThumbFile"
      />

      <div class="flex items-center gap-2">
        <div
          class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-we-border bg-we-panel"
        >
          <video
            v-if="thumb.thumbnail && thumbIsVideo"
            :src="thumb.thumbnail"
            autoplay
            muted
            loop
            aria-label="Thumbnail preview"
            class="h-full w-full object-cover"
          >
            <track kind="captions" />
          </video>
          <img
            v-else-if="thumb.thumbnail"
            :src="thumb.thumbnail"
            alt=""
            class="h-full w-full object-cover"
          />
          <span v-else class="text-[10px] text-we-faint">none</span>
        </div>
        <Button size="sm" variant="outline" @click="pickThumbFile"
          >Pick file…</Button
        >
      </div>

      <div class="grid grid-cols-[110px_1fr] items-center gap-2">
        <Label for="thumb-primary" class="text-[11px] text-we-muted"
          >primary</Label
        >
        <div class="flex gap-1.5">
          <input
            id="thumb-primary"
            type="color"
            v-model="thumb.primaryColor"
            class="h-7 w-7 shrink-0 cursor-pointer rounded border border-we-border bg-transparent p-0"
          />
          <Input v-model="thumb.primaryColor" type="text" class="h-7 text-xs" />
        </div>
      </div>
      <div class="grid grid-cols-[110px_1fr] items-center gap-2">
        <Label for="thumb-secondary" class="text-[11px] text-we-muted"
          >secondary</Label
        >
        <div class="flex gap-1.5">
          <input
            id="thumb-secondary"
            type="color"
            v-model="thumb.secondaryColor"
            class="h-7 w-7 shrink-0 cursor-pointer rounded border border-we-border bg-transparent p-0"
          />
          <Input
            v-model="thumb.secondaryColor"
            type="text"
            class="h-7 text-xs"
          />
        </div>
      </div>
      <div class="grid grid-cols-[110px_1fr] items-center gap-2">
        <Label for="thumb-tertiary" class="text-[11px] text-we-muted"
          >tertiary</Label
        >
        <div class="flex gap-1.5">
          <input
            id="thumb-tertiary"
            type="color"
            v-model="thumb.tertiaryColor"
            class="h-7 w-7 shrink-0 cursor-pointer rounded border border-we-border bg-transparent p-0"
          />
          <Input
            v-model="thumb.tertiaryColor"
            type="text"
            class="h-7 text-xs"
          />
        </div>
      </div>
      <div class="grid grid-cols-[110px_1fr] items-center gap-2">
        <Label for="thumb-text" class="text-[11px] text-we-muted">text</Label>
        <div class="flex gap-1.5">
          <input
            id="thumb-text"
            type="color"
            v-model="thumb.textColor"
            class="h-7 w-7 shrink-0 cursor-pointer rounded border border-we-border bg-transparent p-0"
          />
          <Input v-model="thumb.textColor" type="text" class="h-7 text-xs" />
        </div>
      </div>
      <div class="grid grid-cols-[110px_1fr] items-center gap-2">
        <Label for="thumb-high-contrast" class="text-[11px] text-we-muted"
          >high contrast</Label
        >
        <div class="flex gap-1.5">
          <input
            id="thumb-high-contrast"
            type="color"
            v-model="thumb.highContrastColor"
            class="h-7 w-7 shrink-0 cursor-pointer rounded border border-we-border bg-transparent p-0"
          />
          <Input
            v-model="thumb.highContrastColor"
            type="text"
            class="h-7 text-xs"
          />
        </div>
      </div>

      <Button size="sm" class="w-full" @click="fireThumb"
        >Fire thumbnail</Button
      >
    </section>

    <section
      class="space-y-2 rounded-md border border-we-border bg-we-section p-2.5"
    >
      <h3
        class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
      >
        Plugins
      </h3>
      <div class="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" @click="firePluginLoaded('led')">
          onPluginLoaded("led")
        </Button>
        <Button size="sm" variant="outline" @click="firePluginLoaded('cue')">
          onPluginLoaded("cue")
        </Button>
      </div>
    </section>
  </div>
</template>
