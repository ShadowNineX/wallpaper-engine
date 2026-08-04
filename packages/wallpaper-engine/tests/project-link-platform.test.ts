import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { processState, registryState } = vi.hoisted(() => ({
  processState: {
    env: {} as Record<string, string | undefined>,
    platform: 'win32',
  },
  registryState: {
    error: undefined as Error | undefined,
    stdout: '',
  },
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    stat: async (path: Parameters<typeof actual.stat>[0]) => {
      if (String(path).toLowerCase().startsWith('c:\\program files')) {
        throw Object.assign(new Error('missing test installation'), {
          code: 'ENOENT',
        });
      }
      return await actual.stat(path);
    },
  };
});

vi.mock('node:process', () => ({
  get env() {
    return processState.env;
  },
  get platform() {
    return processState.platform;
  },
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: () => async () => {
    if (registryState.error !== undefined)
      throw registryState.error;
    return { stderr: '', stdout: registryState.stdout };
  },
}));

const temporaryRoots: string[] = [];

async function createSteamRoot(parent: string): Promise<string> {
  const steamRoot = join(parent, 'Steam');
  await mkdir(join(
    steamRoot,
    'steamapps',
    'common',
    'wallpaper_engine',
    'projects',
    'myprojects',
  ), { recursive: true });
  return steamRoot;
}

beforeEach(() => {
  vi.resetModules();
  processState.env = {};
  processState.platform = 'win32';
  registryState.error = undefined;
  registryState.stdout = '';
});

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(root => rm(root, { force: true, recursive: true })),
  );
});

describe('project link platform discovery', () => {
  it('uses case-sensitive candidate paths on non-Windows hosts', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'wallpaper-engine-linux-discovery-'));
    temporaryRoots.push(parent);
    const steamRoot = await createSteamRoot(parent);
    processState.platform = 'linux';
    const { discoverWallpaperProjectsDirectory } = await import(
      '../src/plugin/project-link',
    );

    await expect(discoverWallpaperProjectsDirectory([steamRoot])).resolves.toBe(
      await realpath(join(
        steamRoot,
        'steamapps',
        'common',
        'wallpaper_engine',
        'projects',
        'myprojects',
      )),
    );
  });

  it('rejects automatic discovery outside Windows', async () => {
    processState.platform = 'linux';
    const { discoverWallpaperProjectsDirectory } = await import(
      '../src/plugin/project-link',
    );

    await expect(discoverWallpaperProjectsDirectory()).rejects.toThrow(
      'Automatic discovery is only supported on Windows.',
    );
  });

  it('discovers the registry Steam installation on Windows', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'wallpaper-engine-registry-discovery-'));
    temporaryRoots.push(parent);
    const steamRoot = await createSteamRoot(parent);
    registryState.stdout = `SteamPath    REG_SZ    ${steamRoot}`;
    const { discoverWallpaperProjectsDirectory } = await import(
      '../src/plugin/project-link',
    );

    await expect(discoverWallpaperProjectsDirectory()).resolves.toBe(
      await realpath(join(
        steamRoot,
        'steamapps',
        'common',
        'wallpaper_engine',
        'projects',
        'myprojects',
      )),
    );
  });

  it('falls back to Program Files when the registry query fails', async () => {
    const programFiles = await mkdtemp(join(tmpdir(), 'wallpaper-engine-program-files-'));
    temporaryRoots.push(programFiles);
    const steamRoot = await createSteamRoot(programFiles);
    processState.env.ProgramFiles = programFiles;
    registryState.error = new Error('registry unavailable');
    const { discoverWallpaperProjectsDirectory } = await import(
      '../src/plugin/project-link',
    );

    await expect(discoverWallpaperProjectsDirectory()).resolves.toBe(
      await realpath(join(
        steamRoot,
        'steamapps',
        'common',
        'wallpaper_engine',
        'projects',
        'myprojects',
      )),
    );
  });
});
