<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { Image as ImageIcon, Music2, Pause, Play, Radio, Square } from "lucide-vue-next";
import { getMediaPlaybackStatus } from "wallpaper-engine/helpers";

const props = defineProps<{
  show: boolean;
  cardStyle: CSSProperties;
  title: string;
  artist: string;
  subtitle: string;
  album: string;
  albumArtist: string;
  genres: string;
  contentType: "music" | "video" | "image";
  thumbnail: string;
  playbackState: number;
  timelinePosition: number;
  timelineDuration: number;
}>();

const cubeFaces = ["front", "back", "right", "left", "top", "bottom"] as const;

const hasMedia = computed(() => props.title !== "" || props.artist !== "");
const heading = computed(() => props.title || "Awaiting playback");
const byline = computed(() => {
  if (props.artist && props.album) return `${props.artist} · ${props.album}`;
  return props.artist || props.album || "Media integration is standing by";
});
const detail = computed(
  () => props.subtitle || props.genres || props.albumArtist,
);
const progressPercent = computed(() =>
  props.timelineDuration > 0
    ? Math.min(100, (props.timelinePosition / props.timelineDuration) * 100)
    : 0,
);
const playbackStatus = computed(() =>
  getMediaPlaybackStatus(props.playbackState),
);
const playbackLabel = computed(() => playbackStatus.value.toUpperCase());
const playbackIcon = computed(() => {
  if (playbackStatus.value === "playing") return Play;
  if (playbackStatus.value === "paused") return Pause;
  return Square;
});

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}
</script>

<template>
  <Transition name="media-rise">
    <section v-if="show" class="media-card" :style="cardStyle">
      <div class="media-art-shell">
        <div
          class="media-cube"
          role="img"
          :aria-label="
            thumbnail ? 'Current media artwork' : 'Media artwork placeholder'
          "
        >
          <div
            v-for="face in cubeFaces"
            :key="face"
            class="media-cube-face"
            :class="`media-cube-face-${face}`"
            aria-hidden="true"
          >
            <img
              v-if="thumbnail"
              class="media-art"
              :src="thumbnail"
              alt=""
            />
            <div v-else class="media-art media-placeholder">
              <template v-if="face === 'front'">
                <Music2 v-if="contentType === 'music'" :size="38" />
                <ImageIcon v-else :size="38" />
              </template>
            </div>
          </div>
        </div>
        <span class="playback-badge">
          <component :is="playbackIcon" :size="12" fill="currentColor" />
        </span>
      </div>

      <div class="media-copy">
        <div class="media-meta-row">
          <span><Radio :size="12" /> NOW {{ playbackLabel }}</span>
          <span>{{ contentType.toUpperCase() }}</span>
        </div>
        <h2 :class="{ 'is-placeholder': !hasMedia }">{{ heading }}</h2>
        <p class="media-byline">{{ byline }}</p>
        <p v-if="detail" class="media-detail">{{ detail }}</p>

        <div class="timeline-row">
          <span>{{ formatDuration(timelinePosition) }}</span>
          <div class="timeline-track">
            <span :style="{ width: `${progressPercent}%` }" />
          </div>
          <span>{{ formatDuration(timelineDuration) }}</span>
        </div>
      </div>
    </section>
  </Transition>
</template>
