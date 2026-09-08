import type { BuildOptions } from 'vite';
import type { WallpaperEnginePluginOptions } from '../src/plugin/index';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { wallpaperEnginePlugin } from '../src/plugin/index';

const temporaryRoots: string[] = [];

async function createWallpaperRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'wallpaper-engine-preservation-'));
  temporaryRoots.push(root);
  await writeFile(join(root, 'index.html'), '<main>Wallpaper</main>');
  return root;
}

async function buildWallpaper(
  root: string,
  options: WallpaperEnginePluginOptions,
  buildOptions: BuildOptions = {},
): Promise<void> {
  await build({
    configFile: false,
    logLevel: 'silent',
    root,
    plugins: [wallpaperEnginePlugin({ ...options, devtools: false })],
    build: {
      emptyOutDir: true,
      minify: false,
      outDir: 'dist',
      ...buildOptions,
    },
  });
}

interface BuildWatcher {
  close: () => Promise<void>;
  on: (event: 'event', listener: (event: { code: string }) => void) => void;
}

async function watchWallpaper(
  root: string,
  options: WallpaperEnginePluginOptions,
): Promise<BuildWatcher> {
  return await build({
    configFile: false,
    logLevel: 'silent',
    root,
    plugins: [wallpaperEnginePlugin({ ...options, devtools: false })],
    build: {
      emptyOutDir: true,
      minify: false,
      outDir: 'dist',
      watch: {},
    },
  }) as unknown as BuildWatcher;
}

async function createDirectoryLink(target: string, linkPath: string): Promise<void> {
  await symlink(
    target,
    linkPath,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(root => rm(root, { force: true, recursive: true })),
  );
});

describe('wallpaper plugin preservation boundaries', () => {
  it('emits public preview bytes when Vite public copying is disabled', async () => {
    const root = await createWallpaperRoot();
    const preview = new Uint8Array([0, 1, 2, 253, 254, 255]);
    await mkdir(join(root, 'public', 'previews'), { recursive: true });
    await writeFile(join(root, 'public', 'previews', 'preview.png'), preview);

    await buildWallpaper(root, {
      title: 'Preview capture',
      metadata: { preview: 'previews/preview.png' },
    }, { copyPublicDir: false });

    expect([...await readFile(join(root, 'dist', 'previews', 'preview.png'))])
      .toEqual([...preview]);
  });

  it('rejects a metadata junction into outDir before Vite cleanup', async () => {
    const root = await createWallpaperRoot();
    const outDir = join(root, 'dist');
    const preview = new Uint8Array([7, 8, 9]);
    const project = JSON.stringify({ preview: 'preview.jpg', description: 'keep' });
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'project.json'), project);
    await writeFile(join(outDir, 'preview.jpg'), preview);
    await createDirectoryLink(outDir, join(root, 'metadata-link'));

    await expect(buildWallpaper(root, {
      title: 'Rejected junction',
      metadataFile: 'metadata-link/project.json',
    })).rejects.toThrow(/must be outside Vite build\.outDir/);

    await expect(readFile(join(outDir, 'project.json'), 'utf8')).resolves.toBe(project);
    expect([...await readFile(join(outDir, 'preview.jpg'))]).toEqual([...preview]);
  });

  it('rejects a sidecar junction into outDir through its nearest existing parent', async () => {
    const root = await createWallpaperRoot();
    const outDir = join(root, 'dist');
    const preview = new Uint8Array([10, 11, 12]);
    const project = JSON.stringify({ preview: 'preview.jpg', description: 'keep output' });
    const metadata = JSON.stringify({ preview: 'missing/preview.jpg', description: 'keep' });
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'project.json'), project);
    await writeFile(join(outDir, 'preview.jpg'), preview);
    await writeFile(join(root, 'metadata.json'), metadata);
    await createDirectoryLink(outDir, join(root, 'metadata.assets'));

    await expect(buildWallpaper(root, {
      title: 'Rejected sidecar junction',
      metadataFile: 'metadata.json',
    })).rejects.toThrow(/metadata preview backup .* must be outside Vite build\.outDir/);

    await expect(readFile(join(root, 'metadata.json'), 'utf8')).resolves.toBe(metadata);
    await expect(readFile(join(outDir, 'project.json'), 'utf8')).resolves.toBe(project);
    expect([...await readFile(join(outDir, 'preview.jpg'))]).toEqual([...preview]);
  });

  it('settles after a source edit when imported metadata and preview bytes are unchanged', async () => {
    const root = await createWallpaperRoot();
    const sourcePath = join(root, 'src', 'main.js');
    const metadata = JSON.stringify({
      description: 'Imported metadata',
      preview: 'preview.jpg',
      workshopid: '123',
    });
    await mkdir(join(root, 'src'), { recursive: true });
    await mkdir(join(root, 'metadata.assets'), { recursive: true });
    await writeFile(join(root, 'index.html'), '<script type="module" src="/src/main.js"></script>');
    await writeFile(sourcePath, [
      'import metadata from \'../metadata.json\';',
      'import preview from \'../metadata.assets/preview.jpg\';',
      'console.log(metadata, preview);',
    ].join('\n'));
    await writeFile(join(root, 'metadata.json'), metadata);
    await writeFile(
      join(root, 'metadata.assets', 'preview.jpg'),
      new Uint8Array([1, 2, 3]),
    );

    const watcher = await watchWallpaper(root, {
      title: 'Watch preservation',
      metadataFile: 'metadata.json',
    });
    let completedBuilds = 0;
    watcher.on('event', (event) => {
      if (event.code === 'BUNDLE_END')
        completedBuilds++;
    });
    try {
      await vi.waitFor(() => expect(completedBuilds).toBeGreaterThanOrEqual(1), {
        timeout: 2000,
      });
      await writeFile(sourcePath, [
        'import metadata from \'../metadata.json\';',
        'import preview from \'../metadata.assets/preview.jpg\';',
        'console.log(metadata, preview, \'changed\');',
      ].join('\n'));
      await vi.waitFor(() => expect(completedBuilds).toBeGreaterThanOrEqual(2), {
        timeout: 2000,
      });
      await new Promise(resolve => setTimeout(resolve, 500));
      const settledBuilds = completedBuilds;
      expect(settledBuilds).toBeLessThanOrEqual(3);
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(completedBuilds).toBe(settledBuilds);
    }
    finally {
      await watcher.close();
    }
  });
});
