
export const WALLPAPER_IMAGE_EXTENSIONS = [
  ".jpeg",
  ".jpg",
  ".png",
  ".pnga",
  ".bmp",
  ".gif",
  ".svg",
  ".webp",
] as const;

export const WALLPAPER_VIDEO_EXTENSIONS = [
  ".webm",
  ".ogg",
  ".ogv",
] as const;

export interface DevFileEntry {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  url: string;
  size: number;
  mtimeMs: number;
}

export interface DevDirectorySelection {
  id: string;
  path: string;
  files: DevFileEntry[];
}

