import type { Pinia } from 'pinia';
import { getActivePinia, setActivePinia } from 'pinia';
import { notify } from './notifications';

/** Keep wallpaper failures from interrupting simulator state and cleanup. */
export function invokeHostCallback(action: () => void, showToast = true): boolean {
  try {
    action();
    return true;
  }
  catch (error) {
    console.error('[WE Dev] wallpaper callback threw', error);
    if (showToast)
      notify('Wallpaper callback failed. Check the browser console for details.');
    return false;
  }
}

/** Runs a wallpaper callback without exposing the simulator's active Pinia. */
export function withCallbackPinia<T>(
  store: { $onAction: (callback: () => void, detached?: boolean) => () => void },
  simulatorPinia: Pinia | undefined,
  callerPinia: Pinia | undefined,
  callback: () => T,
): T {
  const stopRestoringPinia = store.$onAction(() => {
    if (getActivePinia() === simulatorPinia)
      setActivePinia(callerPinia);
  }, true);

  try {
    if (getActivePinia() === simulatorPinia)
      setActivePinia(callerPinia);
    return callback();
  }
  finally {
    stopRestoringPinia();
    if (getActivePinia() === simulatorPinia)
      setActivePinia(callerPinia);
  }
}
