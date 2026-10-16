import type { Pinia } from 'pinia';
import type { Component } from 'vue';
import UApp from '@nuxt/ui/components/App.vue';
import ui from '@nuxt/ui/vue-plugin';
import { createPinia, disposePinia, getActivePinia, setActivePinia } from 'pinia';
import { createApp, h } from 'vue';
import { setAudioMode } from './audio';
import NotificationBridge from './components/NotificationBridge.vue';
import { releaseDevFiles } from './dev-files';
import { installGlobals } from './globals';

const INSTANCE_KEY = Symbol.for('wallpaper-engine.devtools.mount');

interface MountedDevtools {
  host: HTMLElement;
  unmount: () => void;
}

type DevtoolsWindow = Window & { [INSTANCE_KEY]?: MountedDevtools };

/** Mount Nuxt UI in the dedicated frontend document (iframe, popup or preview). */
export function mountDevtools(component: Component, css?: string, options: { runtime?: boolean; pinia?: Pinia } = {}): MountedDevtools {
  const targetWindow = window as DevtoolsWindow;
  const existing = targetWindow[INSTANCE_KEY];
  if (existing?.host.isConnected)
    return existing;
  existing?.unmount();

  const previousPinia = getActivePinia();
  const pinia = options.pinia ?? createPinia();
  const host = document.createElement('wallpaper-engine-devtools');
  const style = css ? document.createElement('style') : undefined;
  const addedDarkClass = !document.documentElement.classList.contains('dark');
  let removeGlobals = () => {};
  let app: ReturnType<typeof createApp> | undefined;
  let disposed = false;
  const instance: MountedDevtools = {
    host,
    unmount() {
      if (disposed)
        return;
      disposed = true;
      try {
        app?.unmount();
      }
      finally {
        if (options.runtime !== false)
          setAudioMode('off');
        removeGlobals();
        releaseDevFiles();
        disposePinia(pinia);
        style?.remove();
        host.remove();
        if (addedDarkClass)
          document.documentElement.classList.remove('dark');
        if (targetWindow[INSTANCE_KEY] === instance)
          Reflect.deleteProperty(targetWindow, INSTANCE_KEY);
        if (getActivePinia() === pinia)
          setActivePinia(previousPinia);
      }
    },
  };
  try {
    if (options.runtime !== false)
      removeGlobals = installGlobals(pinia);
    host.id = 'we-devtools-root';
    if (style) {
      style.dataset.weDevtoolsStyles = '';
      style.textContent = css!;
      document.head.appendChild(style);
    }
    document.documentElement.classList.add('dark');
    document.body.appendChild(host);
    app = createApp({
      render: () => h(UApp, { toaster: { position: 'bottom-right' } }, () => [h(NotificationBridge), h(component)]),
    });
    app.use(pinia);
    app.use(ui);
    targetWindow[INSTANCE_KEY] = instance;
    app.mount(host);
  }
  catch (error) {
    instance.unmount();
    throw error;
  }
  finally {
    setActivePinia(previousPinia);
  }
  return instance;
}
