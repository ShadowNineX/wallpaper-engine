import { ColorSpace, parse, spaces, to } from 'colorjs.io/fn';

const NUMBER_PATTERN = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?`;
const WALLPAPER_COLOR_PATTERN = new RegExp(
  String.raw`^\s*(${NUMBER_PATTERN})\s+(${NUMBER_PATTERN})\s+(${NUMBER_PATTERN})\s*$`,
  'i',
);
const CHANNEL_PRECISION = 1_000_000;
let colorSpacesRegistered = false;

function ensureColorSpacesRegistered(): void {
  if (colorSpacesRegistered)
    return;
  for (const space of Object.values(spaces)) {
    ColorSpace.register(space);
  }
  colorSpacesRegistered = true;
}

function formatChannel(channel: number): string {
  const clamped = Math.min(1, Math.max(0, channel));
  return String(Math.round(clamped * CHANNEL_PRECISION) / CHANNEL_PRECISION);
}

function normalizeWallpaperChannels(value: string): string | undefined {
  const match = WALLPAPER_COLOR_PATTERN.exec(value);
  if (!match)
    return;

  const channels = match.slice(1).map(Number);
  if (channels.some(channel => channel < 0 || channel > 1)) {
    throw new RangeError(
      `Wallpaper Engine color channels must be between 0 and 1: "${value}"`,
    );
  }
  return channels.map(formatChannel).join(' ');
}

/**
 * Convert any color string supported by Color.js to Wallpaper Engine's
 * space-separated sRGB format (`"R G B"`, with channels from 0 to 1).
 *
 * Native Wallpaper Engine color strings are accepted unchanged after numeric
 * normalization. Wide-gamut colors are mapped into sRGB using Color.js's CSS
 * gamut-mapping algorithm. Alpha is discarded because Wallpaper Engine color
 * properties do not carry an alpha channel.
 *
 * @example
 * colorToWallpaperColor("hsl(120 100% 50%)");
 * // → "0 1 0"
 *
 * colorToWallpaperColor("#ff8000");
 * // → "1 0.501961 0"
 */
export function colorToWallpaperColor(value: string): string {
  const normalized = normalizeWallpaperChannels(value);
  if (normalized !== undefined)
    return normalized;

  ensureColorSpacesRegistered();
  const color = to(parse(value), 'srgb', { inGamut: true });
  const channels = color.coords.map((channel) => {
    if (channel === null || !Number.isFinite(channel)) {
      throw new TypeError(`Color cannot be converted to sRGB: "${value}"`);
    }
    return formatChannel(channel);
  });
  return channels.join(' ');
}
