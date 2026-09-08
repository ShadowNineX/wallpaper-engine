import { toast } from 'vue-sonner';

/** Keep wallpaper failures from interrupting simulator state and cleanup. */
export function invokeHostCallback(action: () => void, showToast = true): boolean {
  try {
    action();
    return true;
  }
  catch (error) {
    console.error('[WE Dev] wallpaper callback threw', error);
    if (showToast)
      toast('Wallpaper callback failed. Check the browser console for details.');
    return false;
  }
}
