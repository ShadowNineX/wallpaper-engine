<script setup lang="ts">
import { reactive } from "vue";
import type {
  WallpaperMediaPlaybackState,
  WallpaperMediaPropertiesEvent,
  WallpaperMediaThumbnailEvent,
  WallpaperMediaTimelineEvent,
} from "../../../wallpaper-engine/src/types/listeners";
import { fanout, listenerFns, toast } from "../state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const mediaProps = reactive<WallpaperMediaPropertiesEvent>({
  title: "Test Track",
  artist: "Test Artist",
  albumTitle: "Test Album",
  contentType: "music",
});

const timeline = reactive<WallpaperMediaTimelineEvent>({
  position: 0,
  duration: 180,
});

const thumb = reactive<WallpaperMediaThumbnailEvent>({
  thumbnail:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  primaryColor: "#202020",
  secondaryColor: "#404040",
  tertiaryColor: "#808080",
  textColor: "#ffffff",
  highContrastColor: "#ffffff",
});

function fireStatus(enabled: boolean): void {
  fanout(listenerFns.mediaStatus, { enabled }, "media status");
}
function fireProps(): void {
  fanout(listenerFns.mediaProps, { ...mediaProps }, "media properties");
}
function fireThumb(): void {
  fanout(listenerFns.mediaThumb, { ...thumb }, "media thumbnail");
}
function firePlayback(state: WallpaperMediaPlaybackState): void {
  fanout(listenerFns.mediaPlayback, { state }, "media playback");
}
function fireTimeline(): void {
  fanout(listenerFns.mediaTimeline, { ...timeline }, "media timeline");
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
      <h3
        class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
      >
        Media status
      </h3>
      <div class="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" @click="fireStatus(true)"
          >enabled: true</Button
        >
        <Button size="sm" variant="outline" @click="fireStatus(false)"
          >enabled: false</Button
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
      <Button size="sm" @click="fireProps">Fire properties</Button>
    </section>

    <section
      class="space-y-2 rounded-md border border-we-border bg-we-section p-2.5"
    >
      <h3
        class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
      >
        Media playback
      </h3>
      <div class="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" @click="firePlayback(0)"
          >PLAYING</Button
        >
        <Button size="sm" variant="outline" @click="firePlayback(1)"
          >PAUSED</Button
        >
        <Button size="sm" variant="outline" @click="firePlayback(2)"
          >STOPPED</Button
        >
      </div>
    </section>

    <section
      class="space-y-2 rounded-md border border-we-border bg-we-section p-2.5"
    >
      <h3
        class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
      >
        Media timeline
      </h3>
      <div class="grid grid-cols-[110px_1fr] items-center gap-2">
        <Label for="media-position" class="text-[11px] text-we-muted"
          >position</Label
        >
        <Input
          id="media-position"
          v-model.number="timeline.position"
          type="number"
          class="h-7 text-xs"
        />
      </div>
      <div class="grid grid-cols-[110px_1fr] items-center gap-2">
        <Label for="media-duration" class="text-[11px] text-we-muted"
          >duration</Label
        >
        <Input
          id="media-duration"
          v-model.number="timeline.duration"
          type="number"
          class="h-7 text-xs"
        />
      </div>
      <Button size="sm" @click="fireTimeline">Fire timeline</Button>
    </section>

    <section
      class="space-y-2 rounded-md border border-we-border bg-we-section p-2.5"
    >
      <h3
        class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
      >
        Media thumbnail
      </h3>
      <div class="grid grid-cols-[110px_1fr] items-center gap-2">
        <Label for="media-primary" class="text-[11px] text-we-muted"
          >primary</Label
        >
        <Input
          id="media-primary"
          v-model="thumb.primaryColor"
          type="text"
          class="h-7 text-xs"
        />
      </div>
      <Button size="sm" @click="fireThumb">Fire thumbnail</Button>
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
