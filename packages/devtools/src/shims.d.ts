/// <reference types="vite/client" />

declare const __WE_DEVTOOLS_VERSION__: string;
declare const __WE_DEVTOOLS_GIT_VERSION__: string;

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<object, object, unknown>;
  export default component;
}
