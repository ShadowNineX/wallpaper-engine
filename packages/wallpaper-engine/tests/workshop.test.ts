import type { BuildOptions, Rolldown } from 'vite';
import type { WallpaperEnginePluginOptions } from '../src/plugin/index';
import { lstat, mkdir, mkdtemp, readFile, readlink, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  boolProperty,
  wallpaperEnginePlugin,
} from '../src/plugin/index';

const temporaryRoots: string[] = [];

async function createWallpaperRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'wallpaper-engine-workshop-'));
  temporaryRoots.push(root);
  await writeFile(join(root, 'index.html'), '<main>Wallpaper</main>');
  return root;
}

async function buildWallpaper(
  root: string,
  options: WallpaperEnginePluginOptions,
  buildOptions: BuildOptions = {},
): Promise<Rolldown.RolldownOutput | Rolldown.RolldownOutput[]> {
  return await build({
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
  }) as Rolldown.RolldownOutput | Rolldown.RolldownOutput[];
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(root => rm(root, { force: true, recursive: true })),
  );
});

describe('steam Workshop project preservation', () => {
  it('survives Vite cleanup while refreshing generated core and preview output', async () => {
    const root = await createWallpaperRoot();
    const outDir = join(root, 'dist');
    const previewBytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    await mkdir(join(outDir, 'previews'), { recursive: true });
    await writeFile(join(outDir, 'project.json'), JSON.stringify({
      file: 'old.html',
      title: 'Editor title',
      type: 'web',
      general: { properties: { stale: { type: 'bool', value: false } } },
      description: 'Editor description',
      preview: 'previews/editor.jpg',
      workshopid: '1234567890',
      workshopurl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1234567890',
      version: 40,
      snapshotformat: 7,
      snapshotoverlay: 'opaque-editor-value',
      approved: false,
      monetization: false,
      futureField: { enabled: false },
    }));
    await writeFile(join(outDir, 'previews', 'editor.jpg'), previewBytes);
    await writeFile(join(outDir, 'stale.txt'), 'remove me');

    await buildWallpaper(root, {
      title: 'Generated title',
      file: 'wallpaper.html',
      metadata: {
        description: 'Source description',
        tags: [],
        contentrating: '',
      },
      properties: {
        enabled: boolProperty({ text: 'Enabled', value: true }),
      },
    });

    const project = JSON.parse(await readFile(join(outDir, 'project.json'), 'utf8'));
    expect(project).toEqual({
      description: 'Source description',
      preview: 'previews/editor.jpg',
      workshopid: '1234567890',
      workshopurl: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1234567890',
      version: 40,
      snapshotformat: 7,
      snapshotoverlay: 'opaque-editor-value',
      approved: false,
      monetization: false,
      futureField: { enabled: false },
      tags: [],
      contentrating: '',
      file: 'wallpaper.html',
      title: 'Generated title',
      type: 'web',
      general: {
        properties: {
          enabled: {
            index: 0,
            order: 0,
            text: 'Enabled',
            type: 'bool',
            value: true,
          },
        },
      },
    });
    expect([...await readFile(join(outDir, 'previews', 'editor.jpg'))])
      .toEqual([...previewBytes]);
    await expect(readFile(join(outDir, 'stale.txt'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('round-trips editor state through a persistent project link', async () => {
    const root = await createWallpaperRoot();
    const outDir = join(root, 'dist');
    const projectsDirectory = join(root, 'myprojects');
    const linkPath = join(projectsDirectory, 'linked-wallpaper');
    await mkdir(projectsDirectory);

    const options: WallpaperEnginePluginOptions = {
      title: 'First generated title',
      projectLink: {
        name: 'linked-wallpaper',
        projectsDirectory,
      },
    };
    await buildWallpaper(root, options);

    expect((await lstat(linkPath)).isSymbolicLink()).toBe(true);
    expect(await realpath(linkPath)).toBe(await realpath(outDir));
    const originalLinkTarget = await readlink(linkPath);
    expect(JSON.parse(await readFile(join(linkPath, 'project.json'), 'utf8')))
      .toMatchObject({
        file: 'index.html',
        title: 'First generated title',
        type: 'web',
      });

    await writeFile(join(linkPath, 'project.json'), JSON.stringify({
      file: 'editor.html',
      title: 'Editor title',
      type: 'video',
      general: { stale: true },
      workshopid: '9876543210',
      version: 12,
      approved: false,
      futureField: { retained: true },
    }));
    await buildWallpaper(root, {
      ...options,
      title: 'Second generated title',
      file: 'wallpaper.html',
    });

    expect(await readlink(linkPath)).toBe(originalLinkTarget);
    expect(JSON.parse(await readFile(join(outDir, 'project.json'), 'utf8')))
      .toEqual({
        workshopid: '9876543210',
        version: 12,
        approved: false,
        futureField: { retained: true },
        file: 'wallpaper.html',
        title: 'Second generated title',
        type: 'web',
      });
  });

  it('builds a clean clone from a metadata file and public preview', async () => {
    const root = await createWallpaperRoot();
    const previewBytes = new Uint8Array([9, 8, 7, 6]);
    await mkdir(join(root, 'public', 'previews'), { recursive: true });
    await writeFile(
      join(root, 'wallpaper-engine.metadata.json'),
      JSON.stringify({
        description: 'File description',
        preview: 'previews/clean.png',
        workshopid: 'file-id',
        version: 7,
        approved: false,
        futureField: '',
      }),
    );
    await writeFile(join(root, 'public', 'previews', 'clean.png'), previewBytes);

    await buildWallpaper(root, {
      title: 'Clean clone',
      metadataFile: 'wallpaper-engine.metadata.json',
      metadata: { description: 'Option description', tags: [] },
    });

    const project = JSON.parse(
      await readFile(join(root, 'dist', 'project.json'), 'utf8'),
    );
    expect(project).toEqual({
      description: 'Option description',
      preview: 'previews/clean.png',
      workshopid: 'file-id',
      version: 7,
      approved: false,
      futureField: '',
      tags: [],
      file: 'index.html',
      title: 'Clean clone',
      type: 'web',
    });
    expect([...await readFile(join(root, 'dist', 'previews', 'clean.png'))])
      .toEqual([...previewBytes]);
  });

  it('keeps cached preview bytes in an in-memory build', async () => {
    const root = await createWallpaperRoot();
    const outDir = join(root, 'dist');
    const previewBytes = new Uint8Array([3, 1, 4, 1, 5]);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      join(outDir, 'project.json'),
      JSON.stringify({ preview: 'preview.jpg' }),
    );
    await writeFile(join(outDir, 'preview.jpg'), previewBytes);

    const result = await buildWallpaper(
      root,
      { title: 'In memory' },
      { write: false },
    );
    const outputs = Array.isArray(result)
      ? result.flatMap(output => output.output)
      : result.output;
    const preview = outputs.find(
      output => output.type === 'asset' && output.fileName === 'preview.jpg',
    );

    expect(preview?.type).toBe('asset');
    if (preview?.type !== 'asset')
      throw new TypeError('preview asset was not emitted');
    expect([...preview.source as Uint8Array]).toEqual([...previewBytes]);
  });

  it('rejects malformed previous output before Vite deletes it or creates a link', async () => {
    const root = await createWallpaperRoot();
    const projectPath = join(root, 'dist', 'project.json');
    const projectsDirectory = join(root, 'myprojects');
    const linkPath = join(projectsDirectory, 'linked-wallpaper');
    await mkdir(join(root, 'dist'), { recursive: true });
    await mkdir(projectsDirectory);
    await writeFile(projectPath, '{ malformed');

    await expect(buildWallpaper(root, {
      title: 'T',
      projectLink: {
        name: 'linked-wallpaper',
        projectsDirectory,
      },
    })).rejects.toThrow(projectPath);
    expect(await readFile(projectPath, 'utf8')).toBe('{ malformed');
    await expect(lstat(linkPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each([
    ['null', null],
    ['array', []],
    ['string', 'metadata'],
  ])('rejects %s previous project JSON', async (_name, value) => {
    const root = await createWallpaperRoot();
    const projectPath = join(root, 'dist', 'project.json');
    await mkdir(join(root, 'dist'), { recursive: true });
    await writeFile(projectPath, JSON.stringify(value));

    await expect(buildWallpaper(root, { title: 'T' })).rejects.toThrow(
      'top-level JSON object',
    );
    expect(await readFile(projectPath, 'utf8')).toBe(JSON.stringify(value));
  });

  it('rejects a missing explicitly configured metadata file', async () => {
    const root = await createWallpaperRoot();
    const metadataPath = resolve(root, 'missing.metadata.json');

    await expect(buildWallpaper(root, {
      title: 'T',
      metadataFile: 'missing.metadata.json',
    })).rejects.toThrow(metadataPath);
  });

  it('rejects a non-object explicitly configured metadata file', async () => {
    const root = await createWallpaperRoot();
    const metadataPath = join(root, 'wallpaper-engine.metadata.json');
    await writeFile(metadataPath, 'null');

    await expect(buildWallpaper(root, {
      title: 'T',
      metadataFile: 'wallpaper-engine.metadata.json',
    })).rejects.toThrow(metadataPath);
  });

  it.each([
    '../outside.jpg',
    '/absolute.jpg',
    'C:\\outside.jpg',
    '\\\\server\\share\\preview.jpg',
  ])('rejects unsafe preview path %s', async (preview) => {
    const root = await createWallpaperRoot();
    await mkdir(join(root, 'dist'), { recursive: true });
    await writeFile(
      join(root, 'dist', 'project.json'),
      JSON.stringify({ preview }),
    );

    await expect(buildWallpaper(root, { title: 'T' })).rejects.toThrow(
      'Unsafe preview path',
    );
  });

  it('rejects a preview unavailable from output, public, or the bundle', async () => {
    const root = await createWallpaperRoot();

    await expect(buildWallpaper(root, {
      title: 'T',
      metadata: { preview: 'missing.jpg' },
    })).rejects.toThrow('publicDir');
  });
});
