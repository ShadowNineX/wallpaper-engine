import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FsOperation = 'lstat' | 'readFile' | 'readlink' | 'realpath' | 'stat' | 'symlink';

const { fsState, processState, registryState } = vi.hoisted(() => ({
  fsState: {
    failure: undefined as {
      error: unknown;
      operation: FsOperation;
      pathIncludes: string;
    } | undefined,
  },
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
  const failIfConfigured = (operation: FsOperation, path: unknown): void => {
    const failure = fsState.failure;
    if (
      failure?.operation === operation
      && String(path).includes(failure.pathIncludes)
    ) {
      throw failure.error;
    }
  };
  return {
    ...actual,
    lstat: async (path: Parameters<typeof actual.lstat>[0]) => {
      failIfConfigured('lstat', path);
      return await actual.lstat(path);
    },
    readFile: async (
      path: Parameters<typeof actual.readFile>[0],
      encoding: BufferEncoding,
    ) => {
      failIfConfigured('readFile', path);
      return await actual.readFile(path, { encoding });
    },
    readlink: async (path: Parameters<typeof actual.readlink>[0]) => {
      failIfConfigured('readlink', path);
      return await actual.readlink(path);
    },
    realpath: async (path: Parameters<typeof actual.realpath>[0]) => {
      failIfConfigured('realpath', path);
      return await actual.realpath(path);
    },
    stat: async (path: Parameters<typeof actual.stat>[0]) => {
      failIfConfigured('stat', path);
      if (
        String(path)
          .toLowerCase()
          .startsWith(String.raw`c:\program files`)
      ) {
        throw Object.assign(new Error('missing test installation'), {
          code: 'ENOENT',
        });
      }
      return await actual.stat(path);
    },
    symlink: async (
      target: Parameters<typeof actual.symlink>[0],
      path: Parameters<typeof actual.symlink>[1],
      type: Parameters<typeof actual.symlink>[2],
    ) => {
      failIfConfigured('symlink', path);
      return await actual.symlink(target, path, type);
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

async function createLinkFixture(prefix: string): Promise<{
  projectsDirectory: string;
  root: string;
}> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  const projectsDirectory = join(root, 'myprojects');
  await mkdir(projectsDirectory);
  return { projectsDirectory, root };
}

function steamProjectsDirectory(steamRoot: string): string {
  return join(
    steamRoot,
    'steamapps',
    'common',
    'wallpaper_engine',
    'projects',
    'myprojects',
  );
}

beforeEach(() => {
  vi.resetModules();
  fsState.failure = undefined;
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

  it('reports unreadable Steam library metadata with its path', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'wallpaper-engine-vdf-error-'));
    temporaryRoots.push(parent);
    const steamRoot = await createSteamRoot(parent);
    fsState.failure = {
      error: 'blocked',
      operation: 'readFile',
      pathIncludes: 'libraryfolders.vdf',
    };
    const { discoverWallpaperProjectsDirectory } = await import(
      '../src/plugin/project-link',
    );

    await expect(discoverWallpaperProjectsDirectory([steamRoot])).rejects.toThrow(
      'blocked',
    );
  });

  it('reports unexpected discovery stat failures', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'wallpaper-engine-stat-error-'));
    temporaryRoots.push(parent);
    const steamRoot = await createSteamRoot(parent);
    fsState.failure = {
      error: Object.assign(new Error('stat denied'), { code: 'EACCES' }),
      operation: 'stat',
      pathIncludes: 'wallpaper_engine',
    };
    const { discoverWallpaperProjectsDirectory } = await import(
      '../src/plugin/project-link',
    );

    await expect(discoverWallpaperProjectsDirectory([steamRoot])).rejects.toThrow(
      'stat denied',
    );
  });

  it('ignores a non-directory myprojects path', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'wallpaper-engine-file-projects-'));
    temporaryRoots.push(parent);
    const steamRoot = await createSteamRoot(parent);
    const projectsDirectory = steamProjectsDirectory(steamRoot);
    await rm(projectsDirectory, { recursive: true });
    await writeFile(projectsDirectory, 'not a directory');
    const { discoverWallpaperProjectsDirectory } = await import(
      '../src/plugin/project-link',
    );

    await expect(discoverWallpaperProjectsDirectory([steamRoot])).rejects.toThrow(
      'Set projectLink.projectsDirectory explicitly.',
    );
  });

  it('reports discovery realpath failures', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'wallpaper-engine-realpath-error-'));
    temporaryRoots.push(parent);
    const steamRoot = await createSteamRoot(parent);
    fsState.failure = {
      error: new Error('realpath denied'),
      operation: 'realpath',
      pathIncludes: 'myprojects',
    };
    const { discoverWallpaperProjectsDirectory } = await import(
      '../src/plugin/project-link',
    );

    await expect(discoverWallpaperProjectsDirectory([steamRoot])).rejects.toThrow(
      'realpath denied',
    );
  });
});

describe('project link filesystem failures', () => {
  it('reports project-parent canonicalization failures', async () => {
    const { projectsDirectory, root } = await createLinkFixture(
      'wallpaper-engine-parent-realpath-',
    );
    fsState.failure = {
      error: new Error('parent realpath denied'),
      operation: 'realpath',
      pathIncludes: projectsDirectory,
    };
    const { ensureWallpaperProjectLink } = await import(
      '../src/plugin/project-link',
    );

    await expect(ensureWallpaperProjectLink(root, 'dist', true, {
      name: 'wallpaper',
      projectsDirectory,
    })).rejects.toThrow('parent realpath denied');
  });

  it('reports target canonicalization failures', async () => {
    const { projectsDirectory, root } = await createLinkFixture(
      'wallpaper-engine-target-realpath-',
    );
    fsState.failure = {
      error: new Error('target realpath denied'),
      operation: 'realpath',
      pathIncludes: join(root, 'dist'),
    };
    const { ensureWallpaperProjectLink } = await import(
      '../src/plugin/project-link',
    );

    await expect(ensureWallpaperProjectLink(root, 'dist', true, {
      name: 'wallpaper',
      projectsDirectory,
    })).rejects.toThrow('target realpath denied');
  });

  it('wraps link creation failures with link and target context', async () => {
    const { projectsDirectory, root } = await createLinkFixture(
      'wallpaper-engine-symlink-error-',
    );
    fsState.failure = {
      error: Object.assign(new Error('symlink denied'), { code: 'EACCES' }),
      operation: 'symlink',
      pathIncludes: join(projectsDirectory, 'wallpaper'),
    };
    const { ensureWallpaperProjectLink } = await import(
      '../src/plugin/project-link',
    );

    await expect(ensureWallpaperProjectLink(root, 'dist', true, {
      name: 'wallpaper',
      projectsDirectory,
    })).rejects.toThrow('symlink denied');
  });

  it('reports destination inspection failures', async () => {
    const { projectsDirectory, root } = await createLinkFixture(
      'wallpaper-engine-lstat-error-',
    );
    fsState.failure = {
      error: Object.assign(new Error('lstat denied'), { code: 'EACCES' }),
      operation: 'lstat',
      pathIncludes: join(projectsDirectory, 'wallpaper'),
    };
    const { ensureWallpaperProjectLink } = await import(
      '../src/plugin/project-link',
    );

    await expect(ensureWallpaperProjectLink(root, 'dist', true, {
      name: 'wallpaper',
      projectsDirectory,
    })).rejects.toThrow('lstat denied');
  });

  it('reports existing-link read failures', async () => {
    const { projectsDirectory, root } = await createLinkFixture(
      'wallpaper-engine-readlink-error-',
    );
    const targetPath = join(root, 'dist');
    const linkPath = join(projectsDirectory, 'wallpaper');
    await mkdir(targetPath);
    await symlink(
      targetPath,
      linkPath,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    fsState.failure = {
      error: new Error('readlink denied'),
      operation: 'readlink',
      pathIncludes: linkPath,
    };
    const { ensureWallpaperProjectLink } = await import(
      '../src/plugin/project-link',
    );

    await expect(ensureWallpaperProjectLink(root, 'dist', true, {
      name: 'wallpaper',
      projectsDirectory,
    })).rejects.toThrow('readlink denied');
  });

  it('reports existing-link canonicalization failures', async () => {
    const { projectsDirectory, root } = await createLinkFixture(
      'wallpaper-engine-link-realpath-error-',
    );
    const wrongTarget = join(root, 'wrong-target');
    const linkPath = join(projectsDirectory, 'wallpaper');
    await mkdir(wrongTarget);
    await symlink(
      wrongTarget,
      linkPath,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    fsState.failure = {
      error: new Error('link realpath denied'),
      operation: 'realpath',
      pathIncludes: linkPath,
    };
    const { ensureWallpaperProjectLink } = await import(
      '../src/plugin/project-link',
    );

    await expect(ensureWallpaperProjectLink(root, 'dist', true, {
      name: 'wallpaper',
      projectsDirectory,
    })).rejects.toThrow('link realpath denied');
  });

  it('fails closed when an EEXIST race leaves no destination', async () => {
    const { projectsDirectory, root } = await createLinkFixture(
      'wallpaper-engine-vanished-race-',
    );
    fsState.failure = {
      error: Object.assign(new Error('raced'), { code: 'EEXIST' }),
      operation: 'symlink',
      pathIncludes: join(projectsDirectory, 'wallpaper'),
    };
    const { ensureWallpaperProjectLink } = await import(
      '../src/plugin/project-link',
    );

    await expect(ensureWallpaperProjectLink(root, 'dist', true, {
      name: 'wallpaper',
      projectsDirectory,
    })).rejects.toThrow('raced');
  });
});
