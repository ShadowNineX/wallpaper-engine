<script setup lang="ts">
import type {
  WallpaperMediaPlaybackState,
  WallpaperMediaThumbnailEvent,
} from '../../../wallpaper-engine/src/types/listeners';
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import UInputNumber from '@nuxt/ui/components/InputNumber.vue';
import USelect from '@nuxt/ui/components/Select.vue';
import USwitch from '@nuxt/ui/components/Switch.vue';
import { storeToRefs } from 'pinia';
import { computed, onUnmounted, ref, shallowRef } from 'vue';
import Upload from '~icons/ph/upload-simple';
import { createAverageColorExtractor } from '../../../wallpaper-engine/src/helpers';
import CallbackStatus from '../components/CallbackStatus.vue';
import {
  MEDIA_PLAYBACK_PAUSED,
  MEDIA_PLAYBACK_PLAYING,
  MEDIA_PLAYBACK_STOPPED,
} from '../media';
import { notify as toast } from '../notifications';
import { useDevtoolsStore } from '../store';

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
const preparingArtwork = ref(false);
let artworkGeneration = 0;

onUnmounted(() => {
  artworkGeneration++;
});

const playbackStates: Array<{
  state: WallpaperMediaPlaybackState;
  label: string;
}> = [
  { state: MEDIA_PLAYBACK_PLAYING, label: 'Playing' },
  { state: MEDIA_PLAYBACK_PAUSED, label: 'Paused' },
  { state: MEDIA_PLAYBACK_STOPPED, label: 'Stopped' },
];

const contentTypes = [
  { label: 'Music', value: 'music' },
  { label: 'Video', value: 'video' },
  { label: 'Image', value: 'image' },
  { label: 'Unknown', value: 'unknown' },
];

const paletteFields: Array<{
  key: Exclude<keyof WallpaperMediaThumbnailEvent, 'thumbnail'>;
  label: string;
}> = [
  { key: 'primaryColor', label: 'Primary' },
  { key: 'secondaryColor', label: 'Secondary' },
  { key: 'tertiaryColor', label: 'Tertiary' },
  { key: 'textColor', label: 'Text' },
  { key: 'highContrastColor', label: 'High contrast' },
];

function setContentType(value: unknown): void {
  if (value === 'unknown')
    mediaProps.value.contentType = '';
  else if (value === 'music' || value === 'video' || value === 'image')
    mediaProps.value.contentType = value;
}

const selectedContentType = computed(() => mediaProps.value.contentType || 'unknown');

function setPosition(value: number): void {
  if (!Number.isFinite(value))
    return;
  timeline.value.position = Math.min(
    Math.max(0, value),
    Math.max(0, timeline.value.duration),
  );
}

function setDuration(value: number): void {
  if (!Number.isFinite(value))
    return;
  timeline.value.duration = Math.max(0, value);
  timeline.value.position = Math.min(
    timeline.value.position,
    timeline.value.duration,
  );
}

function pickThumbnail(): void {
  thumbnailInput.value?.click();
}

async function onThumbnailFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || preparingArtwork.value)
    return;

  const generation = ++artworkGeneration;
  const isCurrent = () => generation === artworkGeneration;
  preparingArtwork.value = true;
  let sourceUrl: string | undefined;
  try {
    const imageUrl = URL.createObjectURL(file);
    sourceUrl = imageUrl;
    const image = new globalThis.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to decode artwork'));
      image.src = imageUrl;
    });

    if (!isCurrent())
      return;

    if (image.naturalWidth < 1 || image.naturalHeight < 1)
      throw new Error('Artwork has no pixels');

    // The host supplies thumbnails; bound canvas memory for large photos.
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Canvas is unavailable');
    context.drawImage(image, 0, 0, width, height);

    const pngDataUrl = canvas.toDataURL('image/png');
    if (!pngDataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('Unable to encode artwork as PNG');
    }
    thumb.value.thumbnail = pngDataUrl;

    const averageColor = createAverageColorExtractor();
    try {
      const [full, topLeft, bottomRight] = await Promise.all([
        averageColor.getColorAsync(canvas),
        averageColor.getColorAsync(canvas, {
          left: 0,
          top: 0,
          width: Math.max(1, Math.floor(width / 2)),
          height: Math.max(1, Math.floor(height / 2)),
        }),
        averageColor.getColorAsync(canvas, {
          left: Math.floor(width / 2),
          top: Math.floor(height / 2),
          width: Math.max(1, Math.ceil(width / 2)),
          height: Math.max(1, Math.ceil(height / 2)),
        }),
      ]);
      if (!isCurrent())
        return;
      thumb.value.primaryColor = full.hex;
      thumb.value.secondaryColor = topLeft.hex;
      thumb.value.tertiaryColor = bottomRight.hex;
      thumb.value.textColor = full.isDark ? '#ffffff' : '#000000';
      thumb.value.highContrastColor = full.isDark ? '#ffffff' : '#000000';
    }
    catch (error) {
      if (!isCurrent())
        return;
      console.warn('[WE Dev] Unable to extract thumbnail colors', error);
      toast('Artwork converted to PNG, but its palette could not be extracted.');
    }
    finally {
      averageColor.destroy();
    }
  }
  catch (error) {
    if (!isCurrent())
      return;
    console.warn('[WE Dev] Unable to prepare thumbnail', error);
    toast(
      'Unable to decode or convert that image. Choose a format supported by this browser.',
    );
  }
  finally {
    if (sourceUrl)
      URL.revokeObjectURL(sourceUrl);
    if (isCurrent()) {
      input.value = '';
      preparingArtwork.value = false;
    }
  }
}
</script>

<template>
  <div class="space-y-4">
    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">
            Media integration
          </h2>
          <p class="we-card-description">
            Drafts stay editable while off. Enabling delivers the full current state.
          </p>
        </div>
        <label for="media-integration-enabled" class="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-we-muted">
          <USwitch
            id="media-integration-enabled"
            data-media-enabled
            aria-label="Media integration"
            :model-value="mediaActive"
            @update:model-value="(value) => store.setMediaEnabled(value === true)"
          />
          {{ mediaActive ? 'Enabled' : 'Disabled' }}
        </label>
      </div>
      <div class="border-t border-we-border/70 pt-3">
        <CallbackStatus
          :ready="listenerCounts.mediaStatus > 0"
          :ready-label="`${listenerCounts.mediaStatus} status ${listenerCounts.mediaStatus === 1 ? 'callback' : 'callbacks'}`"
          missing-label="No status callback registered"
        />
      </div>
    </section>

    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">
            Now playing
          </h2>
          <p class="we-card-description">
            Edit the draft shown to media listeners.
          </p>
        </div>
      </div>
      <div class="space-y-3">
        <div class="we-field">
          <label for="media-title" class="we-field-label">Title</label>
          <UInput id="media-title" v-model="mediaProps.title" size="sm" />
        </div>
        <div class="we-field">
          <label for="media-artist" class="we-field-label">Artist</label>
          <UInput id="media-artist" v-model="mediaProps.artist" size="sm" />
        </div>
        <div class="we-field">
          <label for="media-album" class="we-field-label">Album</label>
          <UInput id="media-album" v-model="mediaProps.albumTitle" size="sm" />
        </div>
        <div class="we-field">
          <label for="media-content-type" class="we-field-label">Content type</label>
          <USelect
            id="media-content-type"
            :items="contentTypes"
            :model-value="selectedContentType"
            size="sm"
            @update:model-value="setContentType"
          />
        </div>
      </div>
      <div class="we-section-footer">
        <CallbackStatus
          :ready="listenerCounts.mediaProps > 0"
          ready-label="Metadata callback ready"
          missing-label="No metadata callback registered"
        />
        <UButton size="sm" color="primary" :disabled="!mediaActive" @click="store.sendMediaProperties()">
          Send metadata
        </UButton>
      </div>
    </section>

    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">
            Playback
          </h2>
          <p class="we-card-description">
            Playback sends immediately. Timeline changes wait for Send.
          </p>
        </div>
      </div>
      <div
        aria-label="Media playback state"
        class="mb-3 grid grid-cols-3 gap-1"
      >
        <UButton
          v-for="playback in playbackStates"
          :key="playback.state"
          size="sm"
          color="neutral"
          :variant="lastPlaybackState === playback.state ? 'soft' : 'outline'"
          :aria-pressed="lastPlaybackState === playback.state"
          :disabled="!mediaActive"
          @click="store.sendMediaPlayback(playback.state)"
        >
          {{ playback.label }}
        </UButton>
      </div>

      <div class="we-two-column grid grid-cols-2 gap-3">
        <div>
          <label for="media-position" class="mb-1.5 block text-[11px] text-we-muted">Position (s)</label>
          <UInputNumber
            id="media-position"
            :model-value="timeline.position"
            :min="0"
            :max="timeline.duration"
            size="sm"
            aria-label="Position (s)"
            @update:model-value="(value) => value !== null && value !== undefined && setPosition(value)"
          />
        </div>
        <div>
          <label for="media-duration" class="mb-1.5 block text-[11px] text-we-muted">Duration (s)</label>
          <UInputNumber
            id="media-duration"
            :model-value="timeline.duration"
            :min="0"
            size="sm"
            aria-label="Duration (s)"
            @update:model-value="(value) => value !== null && value !== undefined && setDuration(value)"
          />
        </div>
      </div>
      <div class="we-section-footer">
        <div class="flex flex-col gap-1">
          <CallbackStatus
            :ready="listenerCounts.mediaPlayback > 0"
            ready-label="Playback callback ready"
            missing-label="No playback callback registered"
          />
          <CallbackStatus
            :ready="listenerCounts.mediaTimeline > 0"
            ready-label="Timeline callback ready"
            missing-label="No timeline callback registered"
          />
        </div>
        <UButton size="sm" color="neutral" variant="outline" :disabled="!mediaActive" @click="store.sendMediaTimeline()">
          Send timeline
        </UButton>
      </div>
    </section>

    <section class="we-card" :aria-busy="preparingArtwork">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">
            Artwork
          </h2>
          <p class="we-card-description">
            Choose an image and review the generated host palette.
          </p>
        </div>
      </div>

      <label for="media-thumbnail-input" class="sr-only">Artwork image</label>
      <input
        id="media-thumbnail-input"
        ref="thumbnailInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onThumbnailFile"
      >

      <div class="flex items-center gap-3">
        <div class="size-18 shrink-0 overflow-hidden rounded-lg border border-we-border bg-we-panel">
          <img :src="thumb.thumbnail" alt="Media artwork preview" class="size-full object-cover">
        </div>
        <div class="min-w-0 flex-1">
          <UButton size="sm" color="neutral" variant="outline" :disabled="preparingArtwork" @click="pickThumbnail">
            <Upload class="size-3" />
            {{ preparingArtwork ? 'Preparing image…' : 'Choose image' }}
          </UButton>
          <p class="mt-2 text-[11px] leading-4 text-we-faint">
            Converted to PNG with five extracted colors.
          </p>
        </div>
      </div>

      <details class="mt-4 border-y border-we-border/70">
        <summary class="cursor-pointer py-3 text-[12px] font-medium text-we-muted hover:text-we-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-we-primary">
          Adjust extracted palette
        </summary>
        <div class="space-y-3 border-t border-we-border/70 py-3">
          <div v-for="field in paletteFields" :key="field.key" class="we-field">
            <label :for="`thumb-${field.key}`" class="we-field-label">{{ field.label }}</label>
            <div class="flex gap-2">
              <input
                :id="`thumb-${field.key}`"
                v-model="thumb[field.key]"
                type="color"
                class="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-we-border bg-we-btn p-1"
              >
              <label :for="`thumb-${field.key}-value`" class="sr-only">
                {{ field.label }} color value
              </label>
              <UInput
                :id="`thumb-${field.key}-value`"
                v-model="thumb[field.key]"
                size="sm"
                class="font-mono"
              />
            </div>
          </div>
        </div>
      </details>

      <div class="we-section-footer">
        <CallbackStatus
          :ready="listenerCounts.mediaThumb > 0"
          ready-label="Artwork callback ready"
          missing-label="No artwork callback registered"
        />
        <UButton size="sm" color="primary" :disabled="!mediaActive || preparingArtwork" @click="store.sendMediaArtwork()">
          Send artwork
        </UButton>
      </div>
    </section>
  </div>
</template>
