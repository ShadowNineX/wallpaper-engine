/**
 * Common utility helpers for Wallpaper Engine web wallpapers.
 *
 * Every export is side-effect-free and tree-shakeable — import only what you need.
 *
 * @example
 * import { wallpaperColorToRgb, toFileUrl, clampAudio, createFpsLimiter } from 'wallpaper-engine/helpers';
 */

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/**
 * Parse a Wallpaper Engine color string (`"R G B"`, each channel 0–1) into
 * individual 0–255 integer channels.
 *
 * @example
 * const { r, g, b } = parseWallpaperColor(props.mycolor.value);
 * ctx.fillStyle = `rgb(${r},${g},${b})`;
 */
export function parseWallpaperColor(value: string): {
  r: number;
  g: number;
  b: number;
} {
  const parts = value.split(" ");
  return {
    r: Math.ceil(+(parts[0] ?? "0") * 255),
    g: Math.ceil(+(parts[1] ?? "0") * 255),
    b: Math.ceil(+(parts[2] ?? "0") * 255),
  };
}

/**
 * Convert a Wallpaper Engine color string to a CSS `rgb()` value.
 *
 * @example
 * el.style.color = wallpaperColorToRgb(props.mycolor.value);
 * // → "rgb(255,128,0)"
 */
export function wallpaperColorToRgb(value: string): string {
  const { r, g, b } = parseWallpaperColor(value);
  return `rgb(${r},${g},${b})`;
}

/**
 * Convert a Wallpaper Engine color string to a CSS hex color.
 *
 * @example
 * el.style.color = wallpaperColorToHex(props.mycolor.value);
 * // → "#ff8000"
 */
export function wallpaperColorToHex(value: string): string {
  const { r, g, b } = parseWallpaperColor(value);
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// File URL helpers
// ---------------------------------------------------------------------------

/**
 * Prefix a Wallpaper Engine file/directory path with `file:///` to make it
 * usable as an `<img>` or `<video>` `src`.
 *
 * The raw path delivered by `applyUserProperties` is not a valid URL on its own.
 *
 * @example
 * img.src = toFileUrl(props.myimage.value);
 * // → "file:///C:/Users/.../myimage.png"
 */
export function toFileUrl(path: string): string {
  return "file:///" + path;
}

// ---------------------------------------------------------------------------
// Audio helpers
// ---------------------------------------------------------------------------

/**
 * Clamp all values in a Wallpaper Engine audio array to the 0–1 range.
 *
 * Due to the internal FFT implementation, values can occasionally exceed 1.0.
 * Clamping before use is strongly recommended by the official documentation.
 *
 * @example
 * window.wallpaperRegisterAudioListener((raw) => {
 *   const audio = clampAudio(raw);
 *   renderBars(audio);
 * });
 */
export function clampAudio(audioArray: number[]): number[] {
  return audioArray.map((v) => Math.min(v, 1));
}

/**
 * Extract the **left** audio channel (indices 0–63) from a Wallpaper Engine
 * audio array. Index 0 = bass, index 63 = treble.
 *
 * The full array has 128 values: 0–63 left, 64–127 right.
 */
export function leftChannel(audioArray: number[]): number[] {
  return audioArray.slice(0, 64);
}

/**
 * Extract the **right** audio channel (indices 64–127) from a Wallpaper Engine
 * audio array. Index 64 = bass, index 127 = treble.
 *
 * The full array has 128 values: 0–63 left, 64–127 right.
 */
export function rightChannel(audioArray: number[]): number[] {
  return audioArray.slice(64, 128);
}

// ---------------------------------------------------------------------------
// RGB / LED helpers
// ---------------------------------------------------------------------------

/**
 * Encode an `HTMLCanvasElement` into the concatenated RGB byte string expected
 * by `window.wpPlugins.led.setAllDevicesByImageData` and
 * `window.cue.setLedColorsByImageData`.
 *
 * The alpha channel is discarded. Use a small canvas (e.g. 100×20 px) for
 * best performance — the plugins sample it to their device layout anyway.
 *
 * @example
 * const canvas = document.getElementById('RGBCanvas') as HTMLCanvasElement;
 * const encoded = encodeCanvasForLed(canvas);
 * window.wpPlugins.led.setAllDevicesByImageData(encoded, canvas.width, canvas.height);
 */
export function encodeCanvasForLed(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context from canvas");
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let result = "";
  for (let i = 0; i < data.length; i += 4) {
    result += String.fromCodePoint(data[i]!, data[i + 1]!, data[i + 2]!);
  }
  return result;
}

// ---------------------------------------------------------------------------
// FPS limiter
// ---------------------------------------------------------------------------

/**
 * Create a `requestAnimationFrame` loop with an optional FPS cap that mirrors
 * the limit delivered by `applyGeneralProperties`. Pass `0` for unlimited.
 *
 * @param draw - Called each allowed frame with `dt` — elapsed seconds since
 *   the last allowed frame (capped at 1 s to avoid spiral-of-death on tab focus).
 * @returns An object with `start`, `stop`, and `setLimit` methods.
 *
 * @example
 * const loop = createFpsLimiter((dt) => renderFrame(dt));
 *
 * window.wallpaperPropertyListener = {
 *   applyGeneralProperties(props) {
 *     if (props.fps !== undefined) loop.setLimit(props.fps);
 *   },
 * };
 *
 * window.onload = () => loop.start();
 */
export function createFpsLimiter(draw: (dt: number) => void): {
  /** Start (or restart) the animation loop. */
  start(): void;
  /** Stop the animation loop. */
  stop(): void;
  /**
   * Set the FPS cap. Pass `0` for unlimited.
   * Safe to call at any time — takes effect on the next frame.
   */
  setLimit(fps: number): void;
} {
  let limit = 0;
  let last = 0;
  let threshold = 0;
  let rafId: number | null = null;

  function loop(timestamp: number): void {
    rafId = requestAnimationFrame(loop);
    const now = timestamp / 1000;
    const dt = Math.min(now - last, 1);
    last = now;

    if (limit > 0) {
      threshold += dt;
      if (threshold < 1 / limit) return;
      threshold -= 1 / limit;
    }

    draw(dt);
  }

  return {
    start() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      last = performance.now() / 1000;
      threshold = 0;
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
    setLimit(fps: number) {
      limit = fps;
    },
  };
}
