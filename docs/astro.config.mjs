import process from 'node:process';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

function pagefindMainThreadFallback() {
  const virtualModuleId = 'virtual:starlight/pagefind-config';
  const declaration = 'export const pagefindUserConfig = ';

  return {
    name: 'pagefind-main-thread-fallback',
    enforce: 'post',
    transform(code, id) {
      if (!id.endsWith(virtualModuleId) || !code.startsWith(declaration))
        return;

      const config = code.slice(declaration.length).trim().replace(/;$/, '');
      return `${declaration}{ ...(${config}), noWorker: true };`;
    },
  };
}

export default defineConfig({
  site: 'https://shadowninex.github.io',
  base: process.env.NODE_ENV === 'development' ? '/' : '/wallpaper-engine',
  integrations: [
    starlight({
      title: 'wallpaper-engine',
      description: 'Typed host APIs, Vite tooling, runtime helpers, and a development simulator for Wallpaper Engine web wallpapers.',
      favicon: '/favicon.svg',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/ShadowNineX/wallpaper-engine',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/ShadowNineX/wallpaper-engine/edit/main/docs/',
      },
      pagefind: true,
      sidebar: [
        {
          label: 'Start Here',
          items: [
            { label: 'Overview', slug: '' },
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
          ],
        },
        {
          label: 'Properties & Host APIs',
          items: [
            { label: 'Property Schemas', slug: 'guides/property-schemas' },
            { label: 'Type Inference', slug: 'guides/type-inference' },
            { label: 'Host Listeners', slug: 'guides/host-listeners' },
            { label: 'Files & Directories', slug: 'guides/files-and-directories' },
            { label: 'Audio', slug: 'guides/audio' },
            { label: 'Media', slug: 'guides/media' },
          ],
        },
        {
          label: 'Runtime Helpers',
          items: [
            { label: 'Helper Overview', slug: 'helpers' },
            { label: 'Colors & Media', slug: 'helpers/colors-and-media' },
            { label: 'Files, LED & Frames', slug: 'helpers/files-led-and-frames' },
          ],
        },
        {
          label: 'Development Simulator',
          items: [
            { label: 'Simulation', slug: 'devtools/simulation' },
          ],
        },
        {
          label: 'Build & Publish',
          items: [
            { label: 'Project Metadata', slug: 'build/project-metadata' },
            { label: 'Project Links', slug: 'build/project-links' },
            { label: 'Workshop Workflow', slug: 'build/workshop-workflow' },
          ],
        },
        {
          label: 'Troubleshooting',
          items: [
            { label: 'Troubleshooting', slug: 'troubleshooting' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'Entry Points', slug: 'reference' },
            { label: 'Root Types', slug: 'reference/root' },
            { label: 'Plugin API', slug: 'reference/plugin' },
            { label: 'Helpers API', slug: 'reference/helpers' },
          ],
        },
      ],
    }),
  ],
  vite: {
    // Pagefind 1.5.2 sends root-relative metadata URLs to its worker, which
    // current Chromium rejects. Its documented main-thread mode avoids that.
    plugins: [pagefindMainThreadFallback()],
  },
});
