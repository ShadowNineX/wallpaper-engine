<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import type { WallpaperUserPropertiesOf } from "wallpaper-engine/plugin";
import { wallpaperColorToHex } from "wallpaper-engine/helpers";
import { properties } from "./wallpaper";

type UserProps = WallpaperUserPropertiesOf<typeof properties>;

// ── User properties ──────────────────────────────────────────────────────────
const bgColor = ref(wallpaperColorToHex(properties.bgColor.value));
const accentColor = ref(wallpaperColorToHex(properties.accentColor.value));
const label = ref(properties.label.value);
const showLabel = ref(properties.showLabel.value);

// ── Media state ───────────────────────────────────────────────────────────────
const mediaEnabled = ref(false);
const mediaTitle = ref("");
const mediaArtist = ref("");
const mediaAlbum = ref("");
const mediaThumbnail = ref("");
const primaryColor = ref("");
const secondaryColor = ref("");
/** 0 = playing, 1 = paused, 2 = stopped */
const playbackState = ref<0 | 1 | 2>(2);
const timelinePos = ref(0);
const timelineDur = ref(0);

// ── Audio ─────────────────────────────────────────────────────────────────────
const canvas = ref<HTMLCanvasElement | null>(null);
let animFrame = 0;
const rawAudio = new Float32Array(128);
const smoothed = new Float32Array(128);

// ── Derived ───────────────────────────────────────────────────────────────────
const bgStyle = computed(() => {
  // Always blend accent so the background stays vibrant even when media
  // primaryColor is very dark.
  const c1 = primaryColor.value || accentColor.value;
  const c2 = accentColor.value;
  return {
    background: `radial-gradient(ellipse at 50% 60%, ${c1}44 0%, ${c2}33 40%, ${bgColor.value} 75%)`,
  };
});

const progressPct = computed(() =>
  timelineDur.value > 0
    ? Math.min((timelinePos.value / timelineDur.value) * 100, 100)
    : 0,
);

const hasMedia = computed(
  () => mediaEnabled.value && (mediaTitle.value || mediaArtist.value),
);

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
}

// ── Canvas visualizer ─────────────────────────────────────────────────────────
function resizeCanvas(): void {
  const c = canvas.value;
  if (!c) return;
  c.width = c.offsetWidth * devicePixelRatio;
  c.height = c.offsetHeight * devicePixelRatio;
}

function drawBars(): void {
  const c = canvas.value;
  if (!c) return;
  const ctx = c.getContext("2d");
  if (!ctx) return;

  const w = c.width;
  const h = c.height;
  ctx.clearRect(0, 0, w, h);

  // 64 symmetric bars: left half mirrors indices 63→0, right half 64→127
  const barCount = 64;
  const barW = w / barCount;
  const gap = barW * 0.18;

  for (let i = 0; i < barCount; i++) {
    // Left half reversed, right half forward — gives symmetric waveform
    const li = 63 - i;
    const ri = 64 + i;
    const sample = ((smoothed[li] ?? 0) + (smoothed[ri] ?? 0)) / 2;
    const barH = Math.max(2, sample * h * 0.92);
    const x = i * barW + gap / 2;
    const bw = barW - gap;

    const grad = ctx.createLinearGradient(0, h - barH, 0, h);
    const col = primaryColor.value || accentColor.value;
    grad.addColorStop(0, col + "ff");
    grad.addColorStop(0.6, col + "99");
    grad.addColorStop(1, col + "22");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, h - barH, bw, barH, [3, 3, 0, 0]);
    ctx.fill();
  }
}

function animate(): void {
  const decay = 0.18;
  for (let i = 0; i < 128; i++) {
    smoothed[i] =
      (smoothed[i] ?? 0) + ((rawAudio[i] ?? 0) - (smoothed[i] ?? 0)) * decay;
  }
  drawBars();
  animFrame = requestAnimationFrame(animate);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  animate();

  globalThis.wallpaperPropertyListener = {
    applyUserProperties(raw) {
      const props = raw as Partial<UserProps>;
      if (props.bgColor)
        bgColor.value = wallpaperColorToHex(props.bgColor.value);
      if (props.accentColor)
        accentColor.value = wallpaperColorToHex(props.accentColor.value);
      if (props.label != null) label.value = props.label.value;
      if (props.showLabel != null) showLabel.value = props.showLabel.value;
    },
  };

  globalThis.wallpaperRegisterAudioListener((data) => {
    for (let i = 0; i < 128; i++) rawAudio[i] = Math.min(data[i] ?? 0, 1);
  });

  globalThis.wallpaperRegisterMediaStatusListener((e) => {
    mediaEnabled.value = e.enabled;
    if (!e.enabled) {
      mediaTitle.value = "";
      mediaArtist.value = "";
      mediaAlbum.value = "";
      mediaThumbnail.value = "";
      primaryColor.value = "";
      secondaryColor.value = "";
    }
  });

  globalThis.wallpaperRegisterMediaPropertiesListener((e) => {
    mediaTitle.value = e.title ?? "";
    mediaArtist.value = e.artist ?? "";
    mediaAlbum.value = e.albumTitle ?? "";
  });

  globalThis.wallpaperRegisterMediaThumbnailListener((e) => {
    mediaThumbnail.value = e.thumbnail ?? "";
    primaryColor.value = e.primaryColor ?? "";
    secondaryColor.value = e.secondaryColor ?? "";
  });

  globalThis.wallpaperRegisterMediaPlaybackListener((e) => {
    playbackState.value = e.state as 0 | 1 | 2;
  });

  globalThis.wallpaperRegisterMediaTimelineListener((e) => {
    timelinePos.value = e.position ?? 0;
    timelineDur.value = e.duration ?? 0;
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(animFrame);
});
</script>

<template>
  <div class="wallpaper" :style="bgStyle">
    <!-- Blurred thumbnail backdrop -->
    <Transition name="fade">
      <div
        v-if="mediaThumbnail"
        class="thumb-bg"
        :style="{ backgroundImage: `url(${mediaThumbnail})` }"
      />
    </Transition>

    <!-- Ambient orb -->
    <div class="orb" :style="{ background: primaryColor || accentColor }" />

    <!-- Label (no media) -->
    <Transition name="fade">
      <p
        v-if="showLabel && !hasMedia"
        class="label"
        :style="{ color: accentColor, textShadow: `0 0 30px ${accentColor}88` }"
      >
        {{ label }}
      </p>
    </Transition>

    <!-- ── Media overlay ── -->
    <Transition name="slide-up">
      <div v-if="hasMedia" class="media-overlay">
        <!-- Thumbnail + info -->
        <div class="media-row">
          <img
            v-if="mediaThumbnail"
            class="thumb"
            :src="mediaThumbnail"
            alt="album art"
          />
          <div class="media-info">
            <p class="track-title">{{ mediaTitle }}</p>
            <p class="track-artist">{{ mediaArtist }}</p>
            <p v-if="mediaAlbum" class="track-album">{{ mediaAlbum }}</p>
          </div>
          <!-- Playback state badge -->
          <div class="playback-badge">
            <span v-if="playbackState === 0">▶</span>
            <span v-else-if="playbackState === 1">⏸</span>
            <span v-else>⏹</span>
          </div>
        </div>

        <!-- Timeline -->
        <div v-if="timelineDur > 0" class="timeline">
          <span class="time">{{ formatTime(timelinePos) }}</span>
          <div class="progress-track">
            <div
              class="progress-fill"
              :style="{
                width: `${progressPct}%`,
                background: primaryColor || accentColor,
              }"
            />
          </div>
          <span class="time">{{ formatTime(timelineDur) }}</span>
        </div>
      </div>
    </Transition>

    <!-- ── Audio visualizer ── -->
    <div class="visualizer-wrap">
      <canvas ref="canvas" class="visualizer" />
    </div>
  </div>
</template>

<style scoped>
.wallpaper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: background 2s ease;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  color: #fff;
}

/* full-screen album art background */
.thumb-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-size: cover;
  background-position: center;
  opacity: 1;
  transition: background-image 1s ease;
}

/* dark scrim so text stays readable */
.thumb-bg::after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

/* ambient orb */
.orb {
  position: absolute;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  filter: blur(140px);
  opacity: 0.35;
  animation: pulse 8s ease-in-out infinite;
  transition: background 1s ease;
}

.label {
  position: relative;
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  z-index: 1;
  transition:
    color 1s ease,
    text-shadow 1s ease;
}

/* ── Media overlay ── */
.media-overlay {
  position: absolute;
  bottom: 160px;
  left: 60px;
  right: 60px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.media-row {
  display: flex;
  align-items: center;
  gap: 20px;
}

.thumb {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
}

.media-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.track-title {
  font-size: 1.6rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
}

.track-artist {
  font-size: 1rem;
  font-weight: 500;
  opacity: 0.75;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-album {
  font-size: 0.78rem;
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playback-badge {
  font-size: 1.4rem;
  opacity: 0.8;
  flex-shrink: 0;
}

/* timeline */
.timeline {
  display: flex;
  align-items: center;
  gap: 10px;
}

.time {
  font-size: 0.72rem;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.progress-track {
  flex: 1;
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 1s linear;
}

/* ── Visualizer ── */
.visualizer-wrap {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 130px;
  z-index: 1;
  mask-image: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.7) 0%,
    rgba(0, 0, 0, 0) 100%
  );
}

.visualizer {
  width: 100%;
  height: 100%;
  display: block;
}

/* ── Animations ── */
@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.35;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.52;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.6s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active {
  transition:
    opacity 0.5s ease,
    transform 0.5s ease;
}
.slide-up-leave-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
