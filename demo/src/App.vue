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
import type { WallpaperMediaPlaybackState } from "wallpaper-engine";
import type { WallpaperUserPropertiesOf } from "wallpaper-engine/plugin";
import {
  createFpsLimiter,
  toFileUrl,
  wallpaperColorToHex,
} from "wallpaper-engine/helpers";
import ClockPanel from "./components/ClockPanel.vue";
import GeneratedShaderBackground from "./components/GeneratedShaderBackground.vue";
import MediaPanel from "./components/MediaPanel.vue";
import SourceFooter from "./components/SourceFooter.vue";
import SystemHeader from "./components/SystemHeader.vue";
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

interface Particle {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  phase: number;
}

interface PrismSpark {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  size: number;
  life: number;
  maxLife: number;
  colorIndex: 0 | 1;
}
type RgbColor = [number, number, number];

const backgroundColor = ref(
  wallpaperColorToHex(properties.backgroundcolor.value),
);
const accentColor = ref(wallpaperColorToHex(properties.accentcolor.value));
const glowColor = ref(wallpaperColorToHex(properties.glowcolor.value));
const animationSpeed = ref(properties.animationspeed.value);
const particleDensity = ref(properties.particledensity.value);
const visualSensitivity = ref(properties.visualsensitivity.value);
const visualStyle = ref<VisualStyle>(
  properties.visualstyle.value as VisualStyle,
);
const showClock = ref(properties.showclock.value);
const clockFormat = ref<ClockFormat>(
  properties.clockformat.value as ClockFormat,
);
const showSeconds = ref(properties.showseconds.value);
const showMedia = ref(properties.showmedia.value);
const useMediaColors = ref(properties.usemediacolors.value);
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

const mediaEnabled = ref<boolean | null>(null);
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
const playbackState = ref<WallpaperMediaPlaybackState>(
  globalThis.wallpaperMediaIntegration.PLAYBACK_STOPPED,
);
const timelinePosition = ref(0);
const timelineDuration = ref(0);

const showDebugInfo = import.meta.env.DEV;
const now = ref(new Date());
const paused = ref(false);
const fpsLimit = ref(60);
const measuredFps = ref(0);
const lastFrameDelta = ref(0);
const canvas = ref<HTMLCanvasElement | null>(null);
const backgroundVideo = ref<HTMLVideoElement | null>(null);
const rawAudio = new Float32Array(128);
const smoothedAudio = new Float32Array(128);
const particles: Particle[] = [];
const prismSparks: PrismSpark[] = [];
const PRISM_BAR_COUNT = 56;
let bassEnergyBaseline = 0;
let previousBassEnergy = 0;
let pendingPrismBurst = 0;
let lastPrismBurstAt = Number.NEGATIVE_INFINITY;
let animationRunning = false;
let fpsSampleStart = 0;
let renderedFrames = 0;
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
      return files.length > 0
        ? (files[galleryIndex.value % files.length] ?? "")
        : "";
    }
    case "randomvideo":
      return randomVideo.value;
    case "videogallery": {
      const files = videoGallery.value;
      return files.length > 0
        ? (files[galleryIndex.value % files.length] ?? "")
        : "";
    }
    default:
      return "";
  }
});

const activeUrl = computed(() => toFileUrl(activePath.value));
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


const hasMedia = computed(
  () => mediaTitle.value !== "" || mediaArtist.value !== "",
);
const mediaLinked = computed(() => mediaEnabled.value ?? hasMedia.value);

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

function requestRandomFile(
  propertyName?: "randomimages" | "randomvideos",
): void {
  let target = propertyName;
  if (!target) {
    target = "randomimages";
    if (backgroundSource.value === "randomvideo") target = "randomvideos";
  }
  if (typeof globalThis.wallpaperRequestRandomFileForProperty !== "function")
    return;
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
  if (files.length > 1)
    galleryIndex.value = (galleryIndex.value + 1) % files.length;
  previousGalleryChange = performance.now();
}

function getDirectoryFilesTarget(propertyName: string) {
  if (propertyName === "imagegallery") return imageGallery;
  if (propertyName === "videogallery") return videoGallery;
  return undefined;
}

function updateDirectoryFiles(
  propertyName: string,
  changedFiles: string[],
): void {
  const target = getDirectoryFilesTarget(propertyName);
  if (!target) return;
  target.value = [...new Set([...target.value, ...changedFiles])].sort();
  galleryIndex.value %= Math.max(1, target.value.length);
}

function removeDirectoryFiles(
  propertyName: string,
  removedFiles: string[],
): void {
  const target = getDirectoryFilesTarget(propertyName);
  if (!target) return;
  const removed = new Set(removedFiles);
  target.value = target.value.filter((path) => !removed.has(path));
  galleryIndex.value %= Math.max(1, target.value.length);
}

/**
 * Particle placement is cosmetic and never used for security-sensitive work.
 */
function randomUnit(): number {
  return Math.random(); // NOSONAR
}

function ensureParticles(): void {
  const target = Math.max(0, Math.round(particleDensity.value));
  while (particles.length < target) {
    particles.push({
      x: randomUnit(),
      y: randomUnit(),
      radius: 0.45 + randomUnit() * 1.8,
      speed: 0.006 + randomUnit() * 0.016,
      drift: (randomUnit() - 0.5) * 0.012,
      phase: randomUnit() * Math.PI * 2,
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

function ensurePrismContrast(color: RgbColor): RgbColor {
  const minimumLuminance = 170;
  const peak = Math.max(...color);
  const saturationScale = peak > 0 ? Math.max(1, 190 / peak) : 0;
  const saturated: RgbColor =
    peak > 0
      ? [
          Math.min(255, Math.round(color[0] * saturationScale)),
          Math.min(255, Math.round(color[1] * saturationScale)),
          Math.min(255, Math.round(color[2] * saturationScale)),
        ]
      : [minimumLuminance, minimumLuminance, minimumLuminance];
  const luminance =
    saturated[0] * 0.2126 +
    saturated[1] * 0.7152 +
    saturated[2] * 0.0722;
  if (luminance >= minimumLuminance) return saturated;

  const whiteMix = (minimumLuminance - luminance) / (255 - luminance);
  return saturated.map((channel) =>
    Math.round(channel + (255 - channel) * whiteMix),
  ) as RgbColor;
}

function resizeCanvas(): void {
  const element = canvas.value;
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  element.width = Math.max(1, Math.round(rect.width * ratio));
  element.height = Math.max(1, Math.round(rect.height * ratio));
}

function getUiScale(width: number, height: number): number {
  return Math.min(4, Math.max(0.75, Math.min(width, height) / 1_080));
}

function detectBassPunch(time = performance.now()): void {
  let bassEnergy = 0;
  for (let index = 1; index <= 10; index++) {
    bassEnergy += (rawAudio[index] ?? 0) + (rawAudio[index + 64] ?? 0);
  }
  bassEnergy = Math.min(1, (bassEnergy / 20) * visualSensitivity.value);

  const baseline = bassEnergyBaseline;
  const rise = bassEnergy - previousBassEnergy;
  bassEnergyBaseline +=
    (bassEnergy - bassEnergyBaseline) * (bassEnergy > baseline ? 0.08 : 0.025);
  previousBassEnergy = bassEnergy;

  const riseThreshold = Math.max(0.035, baseline * 0.2);
  if (
    visualStyle.value !== "bars" ||
    time - lastPrismBurstAt < 140 ||
    bassEnergy < Math.max(0.12, baseline * 1.28) ||
    rise < riseThreshold
  ) {
    return;
  }

  pendingPrismBurst = Math.max(
    pendingPrismBurst,
    Math.min(1, bassEnergy * 0.7 + rise * 1.8),
  );
  lastPrismBurstAt = time;
}

function clearPrismSparks(resetDetector = false): void {
  prismSparks.length = 0;
  pendingPrismBurst = 0;
  if (!resetDetector) return;
  bassEnergyBaseline = 0;
  previousBassEnergy = 0;
  lastPrismBurstAt = Number.NEGATIVE_INFINITY;
}

function sampleAudio(index: number, time: number): number {
  const real = Math.min(
    1,
    (smoothedAudio[index] ?? 0) * visualSensitivity.value,
  );
  const idle = 0.018 + Math.sin(time * 0.0018 + index * 0.34) * 0.008;
  return Math.max(real, idle);
}

function samplePrismBarLevel(index: number, time: number): number {
  const audioIndex = Math.round((index / (PRISM_BAR_COUNT - 1)) * 63);
  const mirrorIndex = 127 - audioIndex;
  return Math.sqrt(
    (sampleAudio(audioIndex, time) + sampleAudio(mirrorIndex, time)) / 2,
  );
}

function drawBarsVisualizer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  accent: RgbColor,
  glow: RgbColor,
): void {
  const uiScale = getUiScale(width, height);
  const count = PRISM_BAR_COUNT;
  const floor = height * 0.92;
  const span = width * 0.72;
  const start = (width - span) / 2;
  const slot = span / count;
  for (let index = 0; index < count; index++) {
    const level = samplePrismBarLevel(index, time);
    const barHeight = 5 * uiScale + level * height * 0.19;
    const barWidth = Math.max(1, slot * 0.54);
    const x = start + index * slot;
    const y = floor - barHeight;
    const alpha = 0.52 + level * 0.45;
    const [r, g, b] = index % 2 === 0 ? accent : glow;
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    context.fillRect(x, y, barWidth, barHeight);
    context.fillStyle = `rgba(255, 255, 255, ${0.16 + level * 0.22})`;
    context.fillRect(
      x,
      y,
      barWidth,
      Math.min(barHeight, Math.max(1, uiScale * 1.5)),
    );
  }
}

function spawnPrismSparks(
  width: number,
  height: number,
  time: number,
  intensity: number,
): void {
  const uiScale = getUiScale(width, height);
  const count = PRISM_BAR_COUNT;
  const floor = height * 0.92;
  const span = width * 0.72;
  const start = (width - span) / 2;
  const slot = span / count;
  const burstSize = Math.min(
    96 - prismSparks.length,
    Math.round(6 + intensity * 18),
  );

  for (let index = 0; index < burstSize; index++) {
    const barIndex = Math.floor(randomUnit() * count);
    const level = samplePrismBarLevel(barIndex, time);
    const barHeight = 5 * uiScale + level * height * 0.19;
    const direction = (barIndex / (count - 1) - 0.5) * 2;
    const life = 0.28 + randomUnit() * 0.42;

    prismSparks.push({
      x: start + (barIndex + 0.27) * slot,
      y: floor - barHeight,
      velocityX: (direction * 45 + (randomUnit() - 0.5) * 70) * uiScale,
      velocityY:
        -(80 + randomUnit() * 180) * (0.7 + intensity * 0.6) * uiScale,
      size: (1 + randomUnit() * 2.4) * uiScale,
      life,
      maxLife: life,
      colorIndex: randomUnit() < 0.5 ? 0 : 1,
    });
  }
}

function drawPrismSparks(
  context: CanvasRenderingContext2D,
  deltaSeconds: number,
  uiScale: number,
  accent: RgbColor,
  glow: RgbColor,
): void {
  const step = Math.min(0.05, Math.max(0, deltaSeconds));

  for (let index = prismSparks.length - 1; index >= 0; index--) {
    const spark = prismSparks[index];
    if (!spark) continue;
    spark.life -= step;
    if (spark.life <= 0) {
      const last = prismSparks.pop();
      if (last && index < prismSparks.length) prismSparks[index] = last;
      continue;
    }

    spark.x += spark.velocityX * step;
    spark.y += spark.velocityY * step;
    spark.velocityY += 180 * uiScale * step;

    const alpha = (spark.life / spark.maxLife) ** 2;
    const [r, g, b] = spark.colorIndex === 0 ? accent : glow;
    context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    context.lineWidth = Math.max(uiScale * 0.75, spark.size * 0.45);
    context.beginPath();
    context.moveTo(
      spark.x - spark.velocityX * step * 1.8,
      spark.y - spark.velocityY * step * 1.8,
    );
    context.lineTo(spark.x, spark.y);
    context.stroke();

    if (alpha < 0.42) continue;
    const flare = spark.size * (0.8 + alpha * 1.7);
    context.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
    context.lineWidth = Math.max(uiScale * 0.5, spark.size * 0.3);
    context.beginPath();
    context.moveTo(spark.x - flare, spark.y);
    context.lineTo(spark.x + flare, spark.y);
    context.moveTo(spark.x, spark.y - flare);
    context.lineTo(spark.x, spark.y + flare);
    context.stroke();
  }
}

function drawWaveVisualizer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  accent: RgbColor,
  glow: RgbColor,
): void {
  const uiScale = getUiScale(width, height);
  const floor = height * 0.88;
  const gradient = context.createLinearGradient(
    width * 0.12,
    0,
    width * 0.88,
    0,
  );
  gradient.addColorStop(0, `rgba(${glow.join(",")}, 0)`);
  gradient.addColorStop(0.22, `rgba(${glow.join(",")}, 0.58)`);
  gradient.addColorStop(0.72, `rgba(${accent.join(",")}, 0.72)`);
  gradient.addColorStop(1, `rgba(${accent.join(",")}, 0)`);
  context.strokeStyle = gradient;
  context.lineWidth = 1.5 * uiScale;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  let previousX = 0;
  let previousY = floor;
  for (let index = 0; index <= 96; index++) {
    const ratio = index / 96;
    const audioIndex = Math.min(63, Math.floor(ratio * 64));
    let level = 0;
    for (let offset = -2; offset <= 2; offset++) {
      const band = Math.max(0, Math.min(63, audioIndex + offset));
      level +=
        (sampleAudio(band, time) + sampleAudio(127 - band, time)) / 10;
    }
    const x = ratio * width;
    const y =
      floor -
      Math.sin(ratio * Math.PI * 7 + time * 0.0014) *
        (5 * uiScale + level * height * 0.085);
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.quadraticCurveTo(
        previousX,
        previousY,
        (previousX + x) / 2,
        (previousY + y) / 2,
      );
    }
    previousX = x;
    previousY = y;
  }
  context.lineTo(width, previousY);
  context.stroke();
}

function drawRingVisualizer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  accent: RgbColor,
  glow: RgbColor,
): void {
  const uiScale = getUiScale(width, height);
  const centerX = width * 0.5;
  const centerY = height * 0.46;
  const radius = Math.min(width, height) * 0.2;
  for (let index = 0; index < 72; index++) {
    const angle = (index / 72) * Math.PI * 2 - Math.PI / 2;
    const audioIndex = Math.min(127, Math.floor((index / 72) * 128));
    const level = Math.sqrt(sampleAudio(audioIndex, time));
    const extension = 3 * uiScale + level * Math.min(width, height) * 0.055;
    const [r, g, b] = index < 36 ? accent : glow;
    context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.25 + level * 0.65})`;
    context.lineWidth = 1.5 * uiScale;
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

function drawVisualizer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  accent: RgbColor,
  glow: RgbColor,
): void {
  if (visualStyle.value === "off") return;
  context.lineCap = "round";
  context.globalCompositeOperation = "lighter";
  if (visualStyle.value === "bars") {
    drawBarsVisualizer(context, width, height, time, accent, glow);
    return;
  }
  if (visualStyle.value === "wave") {
    drawWaveVisualizer(context, width, height, time, accent, glow);
    return;
  }
  drawRingVisualizer(context, width, height, time, accent, glow);
}

function smoothAudioFrame(): void {
  for (let index = 0; index < 128; index++) {
    const current = smoothedAudio[index] ?? 0;
    smoothedAudio[index] = current + ((rawAudio[index] ?? 0) - current) * 0.18;
  }
}

function drawSceneParticles(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  deltaSeconds: number,
  accent: RgbColor,
  glow: RgbColor,
): void {
  const uiScale = getUiScale(width, height);
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
      particle.x = randomUnit();
    }
    if (particle.x < -0.03) particle.x = 1.03;
    if (particle.x > 1.03) particle.x = -0.03;
    const pulse =
      0.65 + Math.sin(time * 0.001 + particle.phase) * 0.2 + bass * 0.18;
    const [r, g, b] = particle.phase > Math.PI ? accent : glow;
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0.08, pulse * 0.34)})`;
    context.beginPath();
    context.arc(
      particle.x * width,
      particle.y * height,
      particle.radius * uiScale * (1 + bass * 0.22),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function drawPrismEffects(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  deltaSeconds: number,
  accent: RgbColor,
  glow: RgbColor,
): void {
  const uiScale = getUiScale(width, height);
  if (visualStyle.value === "bars") {
    if (pendingPrismBurst > 0) {
      spawnPrismSparks(width, height, time, pendingPrismBurst);
      pendingPrismBurst = 0;
    }
    drawPrismSparks(context, deltaSeconds, uiScale, accent, glow);
    return;
  }
  if (prismSparks.length > 0 || pendingPrismBurst > 0) clearPrismSparks();
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

  smoothAudioFrame();
  ensureParticles();

  const accent = parseHex(effectiveAccent.value);
  const glow = parseHex(effectiveGlow.value);
  const visualAccent =
    visualStyle.value === "bars" ? ensurePrismContrast(accent) : accent;
  const visualGlow =
    visualStyle.value === "bars" ? ensurePrismContrast(glow) : glow;
  drawSceneParticles(
    context,
    width,
    height,
    time,
    deltaSeconds,
    accent,
    glow,
  );
  drawVisualizer(context, width, height, time, visualAccent, visualGlow);
  drawPrismEffects(
    context,
    width,
    height,
    time,
    deltaSeconds,
    visualAccent,
    visualGlow,
  );
  context.globalCompositeOperation = "source-over";
}

function resetFpsMeasurement(time = performance.now()): void {
  if (!showDebugInfo) return;
  fpsSampleStart = time;
  renderedFrames = 0;
  measuredFps.value = 0;
  lastFrameDelta.value = 0;
}

function renderAnimationFrame(deltaSeconds: number): void {
  const time = performance.now();
  if (showDebugInfo) {
    lastFrameDelta.value = deltaSeconds;
    renderedFrames += 1;

    const sampleDuration = time - fpsSampleStart;
    if (sampleDuration >= 1_000) {
      measuredFps.value = Math.round((renderedFrames * 1_000) / sampleDuration);
      fpsSampleStart = time;
      renderedFrames = 0;
    }
  }

  drawScene(time, deltaSeconds);
  if (
    isGallerySource.value &&
    time - previousGalleryChange >= galleryInterval.value * 1_000
  ) {
    advanceGallery();
  }
}

const animationLoop = createFpsLimiter(renderAnimationFrame);
animationLoop.setLimit(fpsLimit.value);

function startAnimation(force = false): void {
  if (paused.value || (animationRunning && !force)) return;
  animationRunning = true;
  previousGalleryChange = performance.now();
  resetFpsMeasurement(previousGalleryChange);
  animationLoop.start();
}

function stopAnimation(): void {
  if (!animationRunning) return;
  animationLoop.stop();
  animationRunning = false;
  resetFpsMeasurement();
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

function resumeWallpaper(): void {
  if (paused.value) return;
  resizeCanvas();
  startAnimation(true);
  startClock();
  backgroundVideo.value?.play().catch(() => undefined);
}

function handleVisibilityChange(): void {
  if (document.visibilityState === "visible") resumeWallpaper();
}

function setWallpaperPaused(value: boolean): void {
  paused.value = value;
  if (value) {
    clearPrismSparks(true);
    stopAnimation();
    stopClock();
    backgroundVideo.value?.pause();
    return;
  }
  resumeWallpaper();
}

function applyColorAndMotionProperties(values: Partial<UserProps>): void {
  if (values.backgroundcolor) {
    backgroundColor.value = wallpaperColorToHex(values.backgroundcolor.value);
  }
  if (values.accentcolor) {
    accentColor.value = wallpaperColorToHex(values.accentcolor.value);
  }
  if (values.glowcolor) {
    glowColor.value = wallpaperColorToHex(values.glowcolor.value);
  }
  if (values.animationspeed) {
    animationSpeed.value = values.animationspeed.value;
  }
  if (values.particledensity) {
    particleDensity.value = values.particledensity.value;
  }
  if (values.visualsensitivity) {
    visualSensitivity.value = values.visualsensitivity.value;
  }
  if (values.visualstyle) {
    visualStyle.value = values.visualstyle.value as VisualStyle;
    if (visualStyle.value !== "bars") clearPrismSparks();
  }
}

function applyOverlayProperties(values: Partial<UserProps>): void {
  if (values.showclock) showClock.value = values.showclock.value;
  if (values.clockformat) {
    clockFormat.value = values.clockformat.value as ClockFormat;
  }
  if (values.showseconds) showSeconds.value = values.showseconds.value;
  if (values.showmedia) showMedia.value = values.showmedia.value;
  if (values.usemediacolors) {
    useMediaColors.value = values.usemediacolors.value;
  }
}

function applyBackgroundProperties(values: Partial<UserProps>): void {
  if (values.customimage) customImage.value = values.customimage.value;
  if (values.customvideo) customVideo.value = values.customvideo.value;
  if (values.galleryinterval) {
    galleryInterval.value = values.galleryinterval.value;
  }

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
}

function refreshRandomBackground(values: Partial<UserProps>): void {
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
}

function applyUserPropertyUpdate(values: Partial<UserProps>): void {
  applyColorAndMotionProperties(values);
  applyOverlayProperties(values);
  applyBackgroundProperties(values);
  refreshRandomBackground(values);
}

// Register host listeners immediately. Wallpaper Engine may deliver startup
// events before mounted hooks and only sends changed properties thereafter.
globalThis.wallpaperRegisterAudioListener((data) => {
  if (paused.value) return;
  for (let index = 0; index < 128; index++) {
    rawAudio[index] = Math.max(0, Math.min(1, data[index] ?? 0));
  }
  detectBassPunch();
});

globalThis.wallpaperPropertyListener = {
  applyUserProperties(rawProperties) {
    applyUserPropertyUpdate(rawProperties as Partial<UserProps>);
  },
  applyGeneralProperties(values) {
    if (values.fps === undefined) return;
    fpsLimit.value = Math.max(0, values.fps);
    animationLoop.setLimit(fpsLimit.value);
    resetFpsMeasurement();
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
  playbackState.value = globalThis.wallpaperMediaIntegration.PLAYBACK_STOPPED;
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
  else await video.play().catch(() => undefined);
});

watch(particleDensity, ensureParticles);

onMounted(() => {
  ensureParticles();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("focus", resumeWallpaper);
  window.addEventListener("pageshow", resumeWallpaper);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  startClock();
  startAnimation();
});

onBeforeUnmount(() => {
  stopAnimation();
  stopClock();
  window.removeEventListener("resize", resizeCanvas);
  window.removeEventListener("focus", resumeWallpaper);
  window.removeEventListener("pageshow", resumeWallpaper);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});
</script>

<template>
  <div class="wallpaper" :style="wallpaperStyle">
    <GeneratedShaderBackground
      v-if="backgroundSource === 'generated'"
      :background="backgroundColor"
      :accent="effectiveAccent"
      :glow="effectiveGlow"
      :base-accent="accentColor"
      :base-glow="glowColor"
      :audio-data="rawAudio"
      :sensitivity="visualSensitivity"
      :animation-speed="animationSpeed"
      :paused="paused"
      :fps-limit="fpsLimit"
    />
    <div
      v-if="isImageBackground"
      class="source-layer source-image"
      :style="imageStyle"
    />
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
    <div
      class="source-scrim"
      :class="{ 'is-generated': backgroundSource === 'generated' }"
    />
    <template v-if="backgroundSource !== 'generated'">
      <div class="aurora aurora-a" />
      <div class="aurora aurora-b" />
    </template>
    <div class="grain" />
    <canvas ref="canvas" class="ambient-canvas">
      Decorative audio visualization.
    </canvas>

    <SystemHeader
      :show-debug-info="showDebugInfo"
      :media-linked="mediaLinked"
      :fps-limit="fpsLimit"
      :measured-fps="measuredFps"
      :last-frame-delta="lastFrameDelta"
    />

    <main class="stage">
      <ClockPanel
        :show="showClock"
        :now="now"
        :format="clockFormat"
        :show-seconds="showSeconds"
      />
      <MediaPanel
        :show="showMedia"
        :card-style="mediaCardStyle"
        :title="mediaTitle"
        :artist="mediaArtist"
        :subtitle="mediaSubtitle"
        :album="mediaAlbum"
        :album-artist="mediaAlbumArtist"
        :genres="mediaGenres"
        :content-type="mediaContentType"
        :thumbnail="mediaThumbnail"
        :playback-state="playbackState"
        :timeline-position="timelinePosition"
        :timeline-duration="timelineDuration"
      />
    </main>

    <SourceFooter
      v-if="isRandomSource || isGallerySource"
      :random-source="isRandomSource"
      :gallery-source="isGallerySource"
      @shuffle="requestRandomFile()"
      @advance="advanceGallery"
    />
  </div>
</template>
