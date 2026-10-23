import type { WallpaperMediaPlaybackState } from '../../wallpaper-engine/src/types/listeners';

export const MEDIA_PLAYBACK_STOPPED = 0 satisfies WallpaperMediaPlaybackState;
export const MEDIA_PLAYBACK_PLAYING = 1 satisfies WallpaperMediaPlaybackState;
export const MEDIA_PLAYBACK_PAUSED = 2 satisfies WallpaperMediaPlaybackState;
