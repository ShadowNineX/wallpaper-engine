import { FastAverageColor } from "fast-average-color";
import type { FastAverageColorOptions } from "fast-average-color";

type RgbColor = [number, number, number];
type RgbaColor = [number, number, number, number];
type RgbaColorWithThreshold = [number, number, number, number, number];
type IgnoredColor =
  | RgbColor
  | RgbaColor
  | RgbaColorWithThreshold
  | Array<RgbColor | RgbaColor | RgbaColorWithThreshold>;

/**
 * An image or media source accepted by the average-color helpers.
 *
 * String sources may be image URLs, data URLs, or blob URLs. Loaded images,
 * videos, canvases, `ImageBitmap`s, and `VideoFrame`s are also supported.
 *
 * @example
 * const source: AverageColorSource = document.querySelector('video')!;
 */
export type AverageColorSource =
  | string
  | HTMLImageElement
  | HTMLVideoElement
  | HTMLCanvasElement
  | OffscreenCanvas
  | ImageBitmap
  | VideoFrame;

/**
 * Controls image sampling and color calculation.
 *
 * These options correspond one-for-one with FastAverageColor's options and
 * are forwarded unchanged.
 *
 * @example
 * const options: AverageColorOptions = {
 *   algorithm: 'dominant',
 *   mode: 'precision',
 *   ignoredColor: [255, 255, 255, 255, 10],
 *   left: 20,
 *   top: 20,
 *   width: 200,
 *   height: 100,
 * };
 */
export interface AverageColorOptions {
  /** Color returned when no usable pixels are available. */
  defaultColor?: RgbaColor;
  /** One color, or a list of colors, to exclude from the calculation. */
  ignoredColor?: IgnoredColor;
  /** `speed` downsizes large sources; `precision` samples at source size. */
  mode?: "precision" | "speed";
  /** Color calculation algorithm. Defaults to `sqrt`. */
  algorithm?: "simple" | "sqrt" | "dominant";
  /** Sample every nth pixel. Defaults to `1`. */
  step?: number;
  /** Left edge of the source region to sample. */
  left?: number;
  /** Top edge of the source region to sample. */
  top?: number;
  /** Width of the source region to sample. */
  width?: number;
  /** Height of the source region to sample. */
  height?: number;
  /** Suppress FastAverageColor's console errors when synchronous extraction fails. */
  silent?: boolean;
  /** `crossOrigin` value used when loading a string source. */
  crossOrigin?: string;
  /** RGB bucket size used by the `dominant` algorithm. */
  dominantDivider?: number;
}

/**
 * Every color representation returned by an average-color extraction.
 *
 * @example
 * const color: AverageColorResult = await getAverageColor(image);
 * element.style.backgroundColor = color.rgba;
 */
export interface AverageColorResult {
  /** CSS `rgb()` representation. */
  rgb: string;
  /** CSS `rgba()` representation. */
  rgba: string;
  /** Six-digit CSS hex representation. */
  hex: string;
  /** Eight-digit CSS hex representation including alpha. */
  hexa: string;
  /** Raw `[red, green, blue, alpha]` channels in the 0–255 range. */
  value: RgbaColor;
  /** Whether the perceived brightness is below FastAverageColor's threshold. */
  isDark: boolean;
  /** Whether the perceived brightness meets FastAverageColor's threshold. */
  isLight: boolean;
  /** Extraction failure returned by the synchronous API. */
  error?: Error;
}

/**
 * A reusable color extractor for repeated images, video frames, or raw pixels.
 * Call `destroy()` when its internal canvas is no longer needed.
 *
 * @example
 * const extractor = createAverageColorExtractor();
 * const color = extractor.getColor(video, { mode: 'speed' });
 * extractor.destroy();
 */
export interface AverageColorExtractor {
  /** Extract from an already-loaded image, video, canvas, bitmap, or video frame. */
  getColor(
    source: Exclude<AverageColorSource, string>,
    options?: AverageColorOptions,
  ): AverageColorResult;
  /** Extract from any supported source, loading string and pending image sources first. */
  getColorAsync(
    source: AverageColorSource,
    options?: AverageColorOptions,
  ): Promise<AverageColorResult>;
  /** Extract raw RGBA channels from an array containing four values per pixel. */
  getColorFromArray4(
    pixels: number[] | Uint8Array | Uint8ClampedArray,
    options?: AverageColorOptions,
  ): RgbaColor;
  /** Release the extractor's internal canvas and rendering context. */
  destroy(): void;
}

type Assert<T extends true> = T;
type AllFastAverageColorOptionsSupported = Assert<
  [keyof FastAverageColorOptions] extends [keyof AverageColorOptions]
    ? [keyof AverageColorOptions] extends [keyof FastAverageColorOptions]
      ? true
      : false
    : false
>;

/**
 * Create a reusable FastAverageColor-backed extractor.
 *
 * Prefer this for video frames, multiple crops of one image, or any repeated
 * work so the extractor can reuse its internal canvas.
 *
 * @example
 * const extractor = createAverageColorExtractor();
 * const primary = await extractor.getColorAsync(image);
 * const accent = await extractor.getColorAsync(image, {
 *   algorithm: 'dominant',
 *   ignoredColor: [primary.value],
 * });
 * extractor.destroy();
 */
export function createAverageColorExtractor(): AverageColorExtractor {
  return new FastAverageColor();
}

/**
 * Extract the average or dominant color from an image or media source.
 *
 * This one-shot helper creates and disposes an extractor automatically. Use
 * `createAverageColorExtractor()` when processing multiple sources or frames.
 * Every `AverageColorOptions` field is forwarded to FastAverageColor unchanged.
 *
 * @example
 * const color = await getAverageColor(imageUrl, {
 *   algorithm: 'dominant',
 *   crossOrigin: 'anonymous',
 *   mode: 'precision',
 * });
 * document.body.style.backgroundColor = color.hex;
 */
export async function getAverageColor(
  source: AverageColorSource,
  options?: AverageColorOptions,
): Promise<AverageColorResult> {
  const extractor = createAverageColorExtractor();
  try {
    return await extractor.getColorAsync(source, options);
  } finally {
    extractor.destroy();
  }
}
