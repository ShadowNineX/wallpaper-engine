<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type CSSProperties,
} from "vue";
import {
  CalendarDays,
  ChevronRight,
  Image as ImageIcon,
  Music2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Sparkles,
  Square,
  Waves,
} from "lucide-vue-next";
import type { WallpaperUserPropertiesOf } from "wallpaper-engine/plugin";
import { wallpaperColorToHex } from "wallpaper-engine/helpers";
import { properties } from "./wallpaper";

type UserProps = WallpaperUserPropertiesOf<typeof properties>;
type BackgroundSource =
  | "generated"
  | "image"
  | "video"
  | "randomimage"
  | "imagegallery"
  | "randomvideo"
  | "videogallery";
type VisualStyle = "bars" | "wave" | "ring" | "off";
type ClockFormat = "twelve" | "twentyfour";
type PlaybackState = 0 | 1 | 2;

interface Particle {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  phase: number;
}

const backgroundColor = ref(
  wallpaperColorToHex(properties.backgroundcolor.value),
);
const accentColor = ref(wallpaperColorToHex(properties.accentcolor.value));
const glowColor = ref(wallpaperColorToHex(properties.glowcolor.value));
const animationSpeed = ref(properties.animationspeed.value);
const particleDensity = ref(properties.particledensity.value);
const visualSensitivity = ref(properties.visualsensitivity.value);
const visualStyle = ref<VisualStyle>(properties.visualstyle.value as VisualStyle);
const showClock = ref(properties.showclock.value);
const clockFormat = ref<ClockFormat>(properties.clockformat.value as ClockFormat);
const showSeconds = ref(properties.showseconds.value);
const showMedia = ref(properties.showmedia.value);
const useMediaColors = ref(properties.usemediacolors.value);
const greeting = ref(properties.greeting.value);
const backgroundSource = ref<BackgroundSource>(
  properties.backgroundsource.value as BackgroundSource,
);
const customImage = ref(properties.customimage.value);
const customVideo = ref(properties.customvideo.value);
const randomImageDirectory = ref(properties.randomimages.value);
const imageGalleryDirectory = ref(properties.imagegallery.value);
const randomVideoDirectory = ref(properties.randomvideos.value);
const videoGalleryDirectory = ref(properties.videogallery.value);
const galleryInterval = ref(properties.galleryinterval.value);

const randomImage = ref("");
const randomVideo = ref("");
const imageGallery = ref<string[]>([]);
const videoGallery = ref<string[]>([]);
const galleryIndex = ref(0);

const mediaEnabled = ref(false);
const mediaTitle = ref("");
const mediaArtist = ref("");
const mediaSubtitle = ref("");
const mediaAlbum = ref("");
const mediaAlbumArtist = ref("");
const mediaGenres = ref("");
const mediaContentType = ref<"music" | "video" | "image">("music");
const mediaThumbnail = ref("");
const mediaPrimary = ref("");
const mediaSecondary = ref("");
const mediaTertiary = ref("");
const mediaText = ref("");
const mediaHighContrast = ref("");
const playbackState = ref<PlaybackState>(2);
const timelinePosition = ref(0);
const timelineDuration = ref(0);

const now = ref(new Date());
const paused = ref(false);
const fpsLimit = ref(60);
const canvas = ref<HTMLCanvasElement | null>(null);
const backgroundVideo = ref<HTMLVideoElement | null>(null);
const rawAudio = new Float32Array(128);
const smoothedAudio = new Float32Array(128);
const particles: Particle[] = [];
let animationFrame = 0;
let previousFrame = 0;
let previousGalleryChange = 0;
let clockTimer: ReturnType<typeof setInterval> | undefined;

const effectiveAccent = computed(() =>
  useMediaColors.value && mediaPrimary.value
    ? mediaPrimary.value
    : accentColor.value,
);
const effectiveGlow = computed(() =>
  useMediaColors.value && mediaSecondary.value
    ? mediaSecondary.value
    : glowColor.value,
);

const activePath = computed(() => {
  switch (backgroundSource.value) {
    case "image":
      return customImage.value;
    case "video":
      return customVideo.value;
    case "randomimage":
      return randomImage.value;
    case "imagegallery": {
      const files = imageGallery.value;
      return files.length > 0 ? (files[galleryIndex.value % files.length] ?? "") : "";
    }
    case "randomvideo":
      return randomVideo.value;
    case "videogallery": {
      const files = videoGallery.value;
      return files.length > 0 ? (files[galleryIndex.value % files.length] ?? "") : "";
    }
    default:
      return "";
  }
});

const activeUrl = computed(() => wallpaperFileUrl(activePath.value));
const isVideoBackground = computed(
  () =>
    backgroundSource.value === "video" ||
    backgroundSource.value === "randomvideo" ||
    backgroundSource.value === "videogallery",
);
const isImageBackground = computed(
  () => activeUrl.value !== "" && !isVideoBackground.value,
);
const isRandomSource = computed(
  () =>
    backgroundSource.value === "randomimage" ||
    backgroundSource.value === "randomvideo",
);
const isGallerySource = computed(
  () =>
    backgroundSource.value === "imagegallery" ||
    backgroundSource.value === "videogallery",
);

const sourceLabel = computed(() => {
  const labels: Record<BackgroundSource, string> = {
    generated: "GENERATED ATMOSPHERE",
    image: "CUSTOM IMAGE",
    video: "CUSTOM VIDEO",
    randomimage: "RANDOM IMAGE",
    imagegallery: `IMAGE GALLERY · ${imageGallery.value.length}`,
    randomvideo: "RANDOM VIDEO",
    videogallery: `VIDEO GALLERY · ${videoGallery.value.length}`,
  };
  return labels[backgroundSource.value];
});

const timeText = computed(() =>
  now.value.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: showSeconds.value ? "2-digit" : undefined,
    hour12: clockFormat.value === "twelve",
  }),
);
const dateText = computed(() =>
  now.value.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  }),
);
const yearText = computed(() => now.value.getFullYear());
const timezoneText = Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll("_", " ");
const hasMedia = computed(
  () => mediaTitle.value !== "" || mediaArtist.value !== "",
);
const mediaHeading = computed(() => mediaTitle.value || "Awaiting playback");
const mediaByline = computed(() => {
  if (mediaArtist.value && mediaAlbum.value) {
    return `${mediaArtist.value} · ${mediaAlbum.value}`;
  }
  return mediaArtist.value || mediaAlbum.value || "Media integration is standing by";
});
const mediaDetail = computed(
  () => mediaSubtitle.value || mediaGenres.value || mediaAlbumArtist.value,
);
const progressPercent = computed(() =>
  timelineDuration.value > 0
    ? Math.min(100, (timelinePosition.value / timelineDuration.value) * 100)
    : 0,
);
const playbackLabel = computed(() => {
  if (!mediaEnabled.value) return "OFFLINE";
  if (playbackState.value === 0) return "PLAYING";
  if (playbackState.value === 1) return "PAUSED";
  return "READY";
});
const playbackIcon = computed(() => {
  if (playbackState.value === 0) return Play;
  if (playbackState.value === 1) return Pause;
  return Square;
});

const wallpaperStyle = computed<CSSProperties>(() => ({
  "--wallpaper-bg": backgroundColor.value,
  "--wallpaper-accent": effectiveAccent.value,
  "--wallpaper-glow": effectiveGlow.value,
  "--media-text": mediaText.value || "#f8fafc",
  background: [
    `radial-gradient(circle at 20% 18%, ${effectiveAccent.value}38, transparent 38%)`,
    `radial-gradient(circle at 78% 72%, ${effectiveGlow.value}30, transparent 42%)`,
    `linear-gradient(145deg, ${backgroundColor.value}, #03050c 72%)`,
  ].join(", "),
}));
const imageStyle = computed<CSSProperties>(() => ({
  backgroundImage: activeUrl.value
    ? `url(${JSON.stringify(activeUrl.value)})`
    : undefined,
}));
const mediaCardStyle = computed<CSSProperties>(() => ({
  "--card-primary": mediaPrimary.value || effectiveAccent.value,
  "--card-secondary": mediaSecondary.value || effectiveGlow.value,
  "--card-tertiary": mediaTertiary.value || backgroundColor.value,
  "--card-contrast": mediaHighContrast.value || "#ffffff",
}));

function wallpaperFileUrl(path: string): string {
  if (!path) return "";
  if (/^(?:data:|blob:|https?:|file:)/i.test(path)) return path;
  return `file:///${path.replaceAll("\\", "/")}`;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function requestRandomFile(propertyName?: "randomimages" | "randomvideos"): void {
  const target =
    propertyName ??
    (backgroundSource.value === "randomvideo" ? "randomvideos" : "randomimages");
  if (typeof globalThis.wallpaperRequestRandomFileForProperty !== "function") return;
  globalThis.wallpaperRequestRandomFileForProperty(target, (name, filePath) => {
    if (name === "randomimages") randomImage.value = filePath;
    if (name === "randomvideos") randomVideo.value = filePath;
  });
}

function advanceGallery(): void {
  const files =
    backgroundSource.value === "videogallery"
      ? videoGallery.value
      : imageGallery.value;
  if (files.length > 1) galleryIndex.value = (galleryIndex.value + 1) % files.length;
  previousGalleryChange = performance.now();
}

function updateDirectoryFiles(
  propertyName: string,
  changedFiles: string[],
): void {
  const target =
    propertyName === "imagegallery"
      ? imageGallery
      : propertyName === "videogallery"
        ? videoGallery
        : undefined;
  if (!target) return;
  target.value = [...new Set([...target.value, ...changedFiles])].sort();
  galleryIndex.value %= Math.max(1, target.value.length);
}

function removeDirectoryFiles(
  propertyName: string,
  removedFiles: string[],
): void {
  const target =
    propertyName === "imagegallery"
      ? imageGallery
      : propertyName === "videogallery"
        ? videoGallery
        : undefined;
  if (!target) return;
  const removed = new Set(removedFiles);
  target.value = target.value.filter((path) => !removed.has(path));
  galleryIndex.value %= Math.max(1, target.value.length);
}

function ensureParticles(): void {
  const target = Math.max(0, Math.round(particleDensity.value));
  while (particles.length < target) {
    particles.push({
      x: Math.random(),
      y: Math.random(),
      radius: 0.45 + Math.random() * 1.8,
      speed: 0.006 + Math.random() * 0.016,
      drift: (Math.random() - 0.5) * 0.012,
      phase: Math.random() * Math.PI * 2,
    });
  }
  if (particles.length > target) particles.length = target;
}

function parseHex(color: string): [number, number, number] {
  const match = color.match(/^#([\da-f]{6})$/i);
  if (!match?.[1]) return [120, 160, 255];
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function resizeCanvas(): void {
  const element = canvas.value;
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  element.width = Math.max(1, Math.round(rect.width * ratio));
  element.height = Math.max(1, Math.round(rect.height * ratio));
}

function sampleAudio(index: number, time: number): number {
  const real = Math.min(1, (smoothedAudio[index] ?? 0) * visualSensitivity.value);
  const idle = 0.018 + Math.sin(time * 0.0018 + index * 0.34) * 0.008;
  return Math.max(real, idle);
}

function drawVisualizer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  accent: [number, number, number],
  glow: [number, number, number],
): void {
  if (visualStyle.value === "off") return;
  const floor = height * 0.92;
  context.lineCap = "round";
  context.globalCompositeOperation = "lighter";

  if (visualStyle.value === "bars") {
    const count = 56;
    const span = width * 0.72;
    const start = (width - span) / 2;
    const slot = span / count;
    for (let index = 0; index < count; index++) {
      const audioIndex = Math.round((index / (count - 1)) * 63);
      const mirrorIndex = 127 - audioIndex;
      const level = Math.sqrt(
        (sampleAudio(audioIndex, time) + sampleAudio(mirrorIndex, time)) / 2,
      );
      const barHeight = 5 + level * height * 0.19;
      const alpha = 0.2 + level * 0.75;
      const [r, g, b] = index % 2 === 0 ? accent : glow;
      context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      context.fillRect(start + index * slot, floor - barHeight, Math.max(1, slot * 0.54), barHeight);
    }
    return;
  }

  if (visualStyle.value === "wave") {
    const gradient = context.createLinearGradient(width * 0.15, 0, width * 0.85, 0);
    gradient.addColorStop(0, `rgba(${glow.join(",")}, 0)`);
    gradient.addColorStop(0.28, `rgba(${glow.join(",")}, 0.75)`);
    gradient.addColorStop(0.72, `rgba(${accent.join(",")}, 0.9)`);
    gradient.addColorStop(1, `rgba(${accent.join(",")}, 0)`);
    context.strokeStyle = gradient;
    context.lineWidth = 2;
    context.beginPath();
    for (let index = 0; index <= 96; index++) {
      const ratio = index / 96;
      const audioIndex = Math.min(63, Math.floor(ratio * 64));
      const level = sampleAudio(audioIndex, time);
      const x = ratio * width;
      const y = floor - Math.sin(ratio * Math.PI * 8 + time * 0.002) * (8 + level * height * 0.13);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    return;
  }

  const centerX = width * 0.5;
  const centerY = height * 0.46;
  const radius = Math.min(width, height) * 0.2;
  for (let index = 0; index < 72; index++) {
    const angle = (index / 72) * Math.PI * 2 - Math.PI / 2;
    const audioIndex = Math.min(127, Math.floor((index / 72) * 128));
    const level = Math.sqrt(sampleAudio(audioIndex, time));
    const extension = 3 + level * Math.min(width, height) * 0.055;
    const [r, g, b] = index < 36 ? accent : glow;
    context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.25 + level * 0.65})`;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(
      centerX + Math.cos(angle) * radius,
      centerY + Math.sin(angle) * radius,
    );
    context.lineTo(
      centerX + Math.cos(angle) * (radius + extension),
      centerY + Math.sin(angle) * (radius + extension),
    );
    context.stroke();
  }
}

function drawScene(time: number, deltaSeconds: number): void {
  const element = canvas.value;
  if (!element) return;
  const context = element.getContext("2d");
  if (!context) return;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const width = element.width / ratio;
  const height = element.height / ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  for (let index = 0; index < 128; index++) {
    const current = smoothedAudio[index] ?? 0;
    smoothedAudio[index] = current + ((rawAudio[index] ?? 0) - current) * 0.18;
  }
  ensureParticles();

  const accent = parseHex(effectiveAccent.value);
  const glow = parseHex(effectiveGlow.value);
  const bass = sampleAudio(4, time) + sampleAudio(68, time);
  context.globalCompositeOperation = "lighter";
  for (const particle of particles) {
    particle.y -= particle.speed * animationSpeed.value * deltaSeconds;
    particle.x +=
      (particle.drift + Math.sin(time * 0.00035 + particle.phase) * 0.004) *
      animationSpeed.value *
      deltaSeconds;
    if (particle.y < -0.03) {
      particle.y = 1.03;
      particle.x = Math.random();
    }
    if (particle.x < -0.03) particle.x = 1.03;
    if (particle.x > 1.03) particle.x = -0.03;
    const pulse = 0.65 + Math.sin(time * 0.001 + particle.phase) * 0.2 + bass * 0.18;
    const [r, g, b] = particle.phase > Math.PI ? accent : glow;
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0.08, pulse * 0.34)})`;
    context.beginPath();
    context.arc(
      particle.x * width,
      particle.y * height,
      particle.radius * (1 + bass * 0.22),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  drawVisualizer(context, width, height, time, accent, glow);
  context.globalCompositeOperation = "source-over";
}

function animate(time: number): void {
  animationFrame = requestAnimationFrame(animate);
  const interval = 1000 / Math.max(1, fpsLimit.value);
  if (previousFrame > 0 && time - previousFrame < interval) return;
  const deltaSeconds = Math.min(0.1, (time - (previousFrame || time)) / 1000);
  previousFrame = time;
  drawScene(time, deltaSeconds);
  if (
    isGallerySource.value &&
    time - previousGalleryChange >= galleryInterval.value * 1000
  ) {
    advanceGallery();
  }
}

function startAnimation(): void {
  if (paused.value || animationFrame !== 0) return;
  previousFrame = 0;
  previousGalleryChange = performance.now();
  animationFrame = requestAnimationFrame(animate);
}

function stopAnimation(): void {
  if (animationFrame !== 0) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
}

function startClock(): void {
  clearInterval(clockTimer);
  now.value = new Date();
  clockTimer = globalThis.setInterval(() => {
    now.value = new Date();
  }, 1000);
}

function stopClock(): void {
  clearInterval(clockTimer);
  clockTimer = undefined;
}

function setWallpaperPaused(value: boolean): void {
  paused.value = value;
  if (value) {
    stopAnimation();
    stopClock();
    backgroundVideo.value?.pause();
    return;
  }
  startAnimation();
  startClock();
  void backgroundVideo.value?.play().catch(() => undefined);
}

// Register host listeners immediately. Wallpaper Engine may deliver startup
// events before mounted hooks and only sends changed properties thereafter.
globalThis.wallpaperRegisterAudioListener((data) => {
  if (paused.value) return;
  for (let index = 0; index < 128; index++) {
    rawAudio[index] = Math.max(0, Math.min(1, data[index] ?? 0));
  }
});

globalThis.wallpaperPropertyListener = {
  applyUserProperties(rawProperties) {
    const values = rawProperties as Partial<UserProps>;
    if (values.backgroundcolor)
      backgroundColor.value = wallpaperColorToHex(values.backgroundcolor.value);
    if (values.accentcolor)
      accentColor.value = wallpaperColorToHex(values.accentcolor.value);
    if (values.glowcolor)
      glowColor.value = wallpaperColorToHex(values.glowcolor.value);
    if (values.animationspeed)
      animationSpeed.value = values.animationspeed.value;
    if (values.particledensity)
      particleDensity.value = values.particledensity.value;
    if (values.visualsensitivity)
      visualSensitivity.value = values.visualsensitivity.value;
    if (values.visualstyle)
      visualStyle.value = values.visualstyle.value as VisualStyle;
    if (values.showclock) showClock.value = values.showclock.value;
    if (values.clockformat)
      clockFormat.value = values.clockformat.value as ClockFormat;
    if (values.showseconds) showSeconds.value = values.showseconds.value;
    if (values.showmedia) showMedia.value = values.showmedia.value;
    if (values.usemediacolors)
      useMediaColors.value = values.usemediacolors.value;
    if (values.greeting) greeting.value = values.greeting.value;
    if (values.customimage) customImage.value = values.customimage.value;
    if (values.customvideo) customVideo.value = values.customvideo.value;
    if (values.galleryinterval)
      galleryInterval.value = values.galleryinterval.value;

    if (values.randomimages) {
      randomImageDirectory.value = values.randomimages.value;
      randomImage.value = "";
    }
    if (values.imagegallery) {
      imageGalleryDirectory.value = values.imagegallery.value;
      imageGallery.value = [];
      galleryIndex.value = 0;
    }
    if (values.randomvideos) {
      randomVideoDirectory.value = values.randomvideos.value;
      randomVideo.value = "";
    }
    if (values.videogallery) {
      videoGalleryDirectory.value = values.videogallery.value;
      videoGallery.value = [];
      galleryIndex.value = 0;
    }
    if (values.backgroundsource) {
      backgroundSource.value = values.backgroundsource.value as BackgroundSource;
      galleryIndex.value = 0;
      previousGalleryChange = performance.now();
    }
    if (
      (values.randomimages || values.backgroundsource) &&
      backgroundSource.value === "randomimage" &&
      randomImageDirectory.value
    ) {
      requestRandomFile("randomimages");
    }
    if (
      (values.randomvideos || values.backgroundsource) &&
      backgroundSource.value === "randomvideo" &&
      randomVideoDirectory.value
    ) {
      requestRandomFile("randomvideos");
    }
  },
  applyGeneralProperties(values) {
    fpsLimit.value = values.fps && values.fps > 0 ? values.fps : 60;
  },
  setPaused: setWallpaperPaused,
  userDirectoryFilesAddedOrChanged: updateDirectoryFiles,
  userDirectoryFilesRemoved: removeDirectoryFiles,
};

globalThis.wallpaperRegisterMediaStatusListener((event) => {
  mediaEnabled.value = event.enabled;
  if (event.enabled) return;
  mediaTitle.value = "";
  mediaArtist.value = "";
  mediaSubtitle.value = "";
  mediaAlbum.value = "";
  mediaAlbumArtist.value = "";
  mediaGenres.value = "";
  mediaThumbnail.value = "";
  mediaPrimary.value = "";
  mediaSecondary.value = "";
  mediaTertiary.value = "";
  mediaText.value = "";
  mediaHighContrast.value = "";
  timelinePosition.value = 0;
  timelineDuration.value = 0;
  playbackState.value = 2;
});

globalThis.wallpaperRegisterMediaPropertiesListener((event) => {
  mediaTitle.value = event.title ?? "";
  mediaArtist.value = event.artist ?? "";
  mediaSubtitle.value = event.subTitle ?? "";
  mediaAlbum.value = event.albumTitle ?? "";
  mediaAlbumArtist.value = event.albumArtist ?? "";
  mediaGenres.value = event.genres ?? "";
  mediaContentType.value = event.contentType;
});

globalThis.wallpaperRegisterMediaThumbnailListener((event) => {
  mediaThumbnail.value = event.thumbnail ?? "";
  mediaPrimary.value = event.primaryColor ?? "";
  mediaSecondary.value = event.secondaryColor ?? "";
  mediaTertiary.value = event.tertiaryColor ?? "";
  mediaText.value = event.textColor ?? "";
  mediaHighContrast.value = event.highContrastColor ?? "";
});

globalThis.wallpaperRegisterMediaPlaybackListener((event) => {
  playbackState.value = event.state;
});

globalThis.wallpaperRegisterMediaTimelineListener((event) => {
  timelinePosition.value = Math.max(0, event.position ?? 0);
  timelineDuration.value = Math.max(0, event.duration ?? 0);
});

watch([activeUrl, isVideoBackground, paused], async () => {
  await nextTick();
  const video = backgroundVideo.value;
  if (!video) return;
  if (paused.value) video.pause();
  else void video.play().catch(() => undefined);
});

watch(particleDensity, ensureParticles);

onMounted(() => {
  ensureParticles();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  startClock();
  startAnimation();
});

onBeforeUnmount(() => {
  stopAnimation();
  stopClock();
  window.removeEventListener("resize", resizeCanvas);
});
</script>

<template>
  <div class="wallpaper" :style="wallpaperStyle">
    <div v-if="isImageBackground" class="source-layer source-image" :style="imageStyle" />
    <video
      v-if="isVideoBackground && activeUrl"
      ref="backgroundVideo"
      :key="activeUrl"
      class="source-layer source-video"
      :src="activeUrl"
      muted
      loop
      autoplay
      playsinline
    />
    <div class="source-scrim" />
    <div class="aurora aurora-a" />
    <div class="aurora aurora-b" />
    <div class="grain" />
    <canvas ref="canvas" class="ambient-canvas" aria-hidden="true" />

    <header class="topbar">
      <div class="brand-lockup">
        <span class="brand-mark"><Sparkles :size="15" /></span>
        <div>
          <p class="eyebrow">{{ greeting }}</p>
          <p class="brand-subtitle">Reactive desktop atmosphere</p>
        </div>
      </div>
      <div class="system-cluster">
        <span class="system-pill">
          <span class="status-dot" :class="mediaEnabled ? 'is-live' : ''" />
          MEDIA {{ mediaEnabled ? "LINKED" : "STANDBY" }}
        </span>
        <span class="system-pill"><Waves :size="13" /> {{ fpsLimit }} FPS</span>
      </div>
    </header>

    <main class="stage">
      <Transition name="clock-shift">
        <section v-if="showClock" class="clock-block">
          <div class="clock-kicker">
            <span>{{ timezoneText }}</span>
            <span class="hairline" />
            <span>{{ yearText }}</span>
          </div>
          <time class="clock-time">{{ timeText }}</time>
          <div class="date-line">
            <CalendarDays :size="17" />
            <span>{{ dateText }}</span>
          </div>
        </section>
      </Transition>

      <Transition name="media-rise">
        <section v-if="showMedia" class="media-card" :style="mediaCardStyle">
          <div class="media-art-shell">
            <img
              v-if="mediaThumbnail"
              class="media-art"
              :src="mediaThumbnail"
              alt="Current media artwork"
            />
            <div v-else class="media-art media-placeholder">
              <Music2 v-if="mediaContentType === 'music'" :size="38" />
              <ImageIcon v-else :size="38" />
            </div>
            <span class="playback-badge">
              <component :is="playbackIcon" :size="12" fill="currentColor" />
            </span>
          </div>

          <div class="media-copy">
            <div class="media-meta-row">
              <span><Radio :size="12" /> NOW {{ playbackLabel }}</span>
              <span>{{ mediaContentType.toUpperCase() }}</span>
            </div>
            <h2 :class="{ 'is-placeholder': !hasMedia }">{{ mediaHeading }}</h2>
            <p class="media-byline">{{ mediaByline }}</p>
            <p v-if="mediaDetail" class="media-detail">{{ mediaDetail }}</p>

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
    </main>

    <footer class="footerbar">
      <div class="source-readout">
        <span class="source-icon"><ImageIcon :size="14" /></span>
        <div>
          <span class="micro-label">BACKGROUND SOURCE</span>
          <strong>{{ sourceLabel }}</strong>
        </div>
      </div>
      <button
        v-if="isRandomSource"
        class="source-action"
        type="button"
        title="Load another random file"
        @click="requestRandomFile()"
      >
        <RefreshCw :size="14" />
        SHUFFLE
      </button>
      <button
        v-else-if="isGallerySource"
        class="source-action"
        type="button"
        title="Advance gallery"
        @click="advanceGallery"
      >
        NEXT
        <ChevronRight :size="14" />
      </button>
      <div v-else class="audio-readout">
        <span class="audio-bars"><i /><i /><i /><i /></span>
        AUDIO REACTIVE
      </div>
    </footer>
  </div>
</template>
