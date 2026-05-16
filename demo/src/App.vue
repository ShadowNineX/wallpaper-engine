<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import type { WallpaperUserPropertiesOf } from "wallpaper-engine/plugin";
import { wallpaperColorToHex } from "wallpaper-engine/helpers";
import { properties } from "./wallpaper";
import { Play, Pause, Square } from "lucide-vue-next";

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

// ── Clock ───────────────────────────────────────────────────────────────────
function getNow() {
  return new Date();
}
const now = ref(getNow());
let clockTimer: ReturnType<typeof setInterval> | undefined;
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
  () => mediaTitle.value !== "" || mediaArtist.value !== "",
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
  // getBoundingClientRect is more reliable than offsetWidth/Height in WE's CEF context
  const rect = c.getBoundingClientRect();
  const w = rect.width || c.offsetWidth || globalThis.innerWidth;
  const h =
    rect.height ||
    c.offsetHeight ||
    Math.min(Math.max(Math.round(globalThis.innerHeight * 0.22), 160), 420);
  if (w === 0 || h === 0) return; // layout not ready yet — retry triggered by rAF
  c.width = w * devicePixelRatio;
  c.height = h * devicePixelRatio;
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
    // Square-root curve boosts quiet audio without clipping loud peaks
    const raw = ((smoothed[li] ?? 0) + (smoothed[ri] ?? 0)) / 2;
    const sample = Math.sqrt(raw);
    const minH = Math.max(2, h * 0.005); // at least 0.5% of canvas height
    const barH = Math.max(minH, sample * h);
    const x = i * barW + gap / 2;
    const bw = barW - gap;

    const grad = ctx.createLinearGradient(0, h - barH, 0, h);
    const col = primaryColor.value || accentColor.value;
    grad.addColorStop(0, col + "ff");
    grad.addColorStop(0.6, col + "99");
    grad.addColorStop(1, col + "22");
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, h - barH, bw, barH, [3, 3, 0, 0]);
    } else {
      ctx.rect(x, h - barH, bw, barH);
    }
    ctx.fill();
  }
}

function animate(): void {
  const decay = 0.4;
  for (let i = 0; i < 128; i++) {
    smoothed[i] =
      (smoothed[i] ?? 0) + ((rawAudio[i] ?? 0) - (smoothed[i] ?? 0)) * decay;
  }
  drawBars();
  animFrame = requestAnimationFrame(animate);
}

// Register listeners immediately at script evaluation time.
// WE docs: don't put these in window.onload or similar — register at end of body.
// Must use window.wallpaperRegisterAudioListener (not globalThis) so WE's code
// scanner detects it and sets supportsaudioprocessing:true in project.json.
globalThis.wallpaperRegisterAudioListener((data) => {
  for (let i = 0; i < 128; i++) rawAudio[i] = Math.min(data[i] ?? 0, 1);
});

globalThis.wallpaperPropertyListener = {
  applyUserProperties(raw) {
    const props = raw as Partial<UserProps>;
    if (props.bgColor) bgColor.value = wallpaperColorToHex(props.bgColor.value);
    if (props.accentColor)
      accentColor.value = wallpaperColorToHex(props.accentColor.value);
    if (props.label != null) label.value = props.label.value;
    if (props.showLabel != null) showLabel.value = props.showLabel.value;
  },
};

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

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  clockTimer = globalThis.setInterval(() => {
    now.value = getNow();
  }, 1000);
  window.addEventListener("resize", resizeCanvas);
  // Defer by one frame so the browser finishes layout before we read dimensions.
  // In WE's live wallpaper renderer, offsetWidth/Height can be 0 at mount time.
  requestAnimationFrame(() => {
    resizeCanvas();
    animate();
  });
});

onBeforeUnmount(() => {
  clearInterval(clockTimer);
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(animFrame);
});
</script>

<template>
  <div class="wallpaper" :style="bgStyle">
    <!-- Ambient orb -->
    <div class="orb" :style="{ background: primaryColor || accentColor }" />

    <!-- Label (no media) -->
    <Transition name="fade">
      <div v-if="showLabel" class="label-group" :style="{ color: accentColor }">
        <p class="label" :style="{ textShadow: `0 0 30px ${accentColor}88` }">
          {{ label }}
        </p>
        <p class="clock-time">
          {{
            now.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          }}
        </p>
        <p class="clock-date">
          {{
            now.toLocaleDateString([], {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          }}
        </p>
      </div>
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
            <Play v-if="playbackState === 0" />
            <Pause v-else-if="playbackState === 1" />
            <Square v-else />
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

/* ambient orb */
.orb {
  position: absolute;
  width: clamp(280px, 40vmin, 720px);
  height: clamp(280px, 40vmin, 720px);
  border-radius: 50%;
  filter: blur(clamp(80px, 11vmin, 180px));
  opacity: 0.35;
  animation: pulse 8s ease-in-out infinite;
  transition: background 1s ease;
}

.label-group {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 0.8vw, 18px);
  transition: color 1s ease;
}

.label {
  position: relative;
  font-size: clamp(1.5rem, 4vw, 7rem);
  font-weight: 700;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  transition:
    color 1s ease,
    text-shadow 1s ease;
}

.clock-time {
  font-size: clamp(1rem, 2.5vw, 5rem);
  font-weight: 300;
  letter-spacing: 0.15em;
  opacity: 0.9;
}

.clock-date {
  font-size: clamp(0.7rem, 1.2vw, 2.2rem);
  font-weight: 400;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.6;
}

/* ── Media overlay ── */
.media-overlay {
  position: absolute;
  bottom: clamp(100px, 14vh, 240px);
  left: clamp(30px, 5vw, 120px);
  right: clamp(30px, 5vw, 120px);
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.2vmin, 22px);
}

.media-row {
  display: flex;
  align-items: center;
  gap: clamp(14px, 2vw, 64px);
}

.thumb {
  width: clamp(120px, 10vw, 360px);
  height: clamp(120px, 10vw, 360px);
  border-radius: clamp(6px, 0.8vw, 28px);
  object-fit: cover;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
}

.media-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(2px, 0.4vw, 10px);
}

.track-title {
  font-size: clamp(1.2rem, 2.5vw, 5rem);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
}

.track-artist {
  font-size: clamp(0.8rem, 1.6vw, 3.5rem);
  font-weight: 500;
  opacity: 0.75;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-album {
  font-size: clamp(0.65rem, 1.2vw, 2.5rem);
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playback-badge {
  opacity: 0.8;
  flex-shrink: 0;
}

.playback-badge svg {
  width: clamp(1.2rem, 2vw, 4rem);
  height: clamp(1.2rem, 2vw, 4rem);
  display: block;
}

/* timeline */
.timeline {
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.5vw, 28px);
}

.time {
  font-size: clamp(0.85rem, 1.5vw, 3rem);
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.progress-track {
  flex: 1;
  height: clamp(2px, 0.35vw, 8px);
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
  height: clamp(160px, 22vh, 420px);
  z-index: 1;
  mask-image: linear-gradient(to top, black 0%, black 80%, transparent 100%);
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
