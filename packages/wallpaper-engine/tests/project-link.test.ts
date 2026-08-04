import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  discoverWallpaperProjectsDirectory,
  ensureWallpaperProjectLink,
} from '../src/plugin/project-link';

const temporaryRoots: string[] = [];

async function createTemporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

async function createProjectsDirectory(root: string): Promise<string> {
  const projectsDirectory = join(root, 'myprojects');
  await mkdir(projectsDirectory, { recursive: true });
  return projectsDirectory;
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

describe('discoverWallpaperProjectsDirectory', () => {
  it('finds an escaped libraryfolders.vdf path', async () => {
    const root = await createTemporaryRoot('wallpaper-engine-discovery-');
    const steamRoot = join(root, 'Steam');
    const library = join(root, 'Library Two');
    const projectsDirectory = join(
      library,
      'steamapps',
      'common',
      'wallpaper_engine',
      'projects',
      'myprojects',
    );
    const escapedLibrary = library
      .replaceAll('\\', '\\\\')
      .replaceAll('"', '\\"');
    await mkdir(join(steamRoot, 'steamapps'), { recursive: true });
    await mkdir(projectsDirectory, { recursive: true });
    await writeFile(
      join(steamRoot, 'steamapps', 'libraryfolders.vdf'),
      `"libraryfolders" { "0" { "path" "ignored\\\\\\\"quoted" } "1" { "path" "${escapedLibrary}" } }`,
    );

    await expect(discoverWallpaperProjectsDirectory([steamRoot]))
      .resolves
      .toBe(await realpath(projectsDirectory));
  });

  it('reports the explicit override guidance when no installation matches', async () => {
    const steamRoot = await createTemporaryRoot('wallpaper-engine-no-match-');

    await expect(discoverWallpaperProjectsDirectory([steamRoot])).rejects.toThrow(
      'Unable to find Wallpaper Engine\'s projects/myprojects directory. Set projectLink.projectsDirectory explicitly.',
    );
  });

  it('lists every ambiguous installation match', async () => {
    const root = await createTemporaryRoot('wallpaper-engine-ambiguous-');
    const steamRoot = join(root, 'Steam');
    const library = join(root, 'Library');
    const first = join(
      steamRoot,
      'steamapps',
      'common',
      'wallpaper_engine',
      'projects',
      'myprojects',
    );
    const second = join(
      library,
      'steamapps',
      'common',
      'wallpaper_engine',
      'projects',
      'myprojects',
    );
    await mkdir(join(steamRoot, 'steamapps'), { recursive: true });
    await mkdir(first, { recursive: true });
    await mkdir(second, { recursive: true });
    await writeFile(
      join(steamRoot, 'steamapps', 'libraryfolders.vdf'),
      `"libraryfolders" { "1" { "path" "${library.replaceAll('\\', '\\\\')}" } }`,
    );

    const error = await discoverWallpaperProjectsDirectory([steamRoot])
      .catch(error => error as Error);
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error))
      throw new TypeError('discovery did not reject with an Error');
    expect(error.message).toContain(await realpath(first));
    expect(error.message).toContain(await realpath(second));
    expect(error.message).toContain('Set projectLink.projectsDirectory explicitly.');
  });
});

describe('ensureWallpaperProjectLink', () => {
  it('creates a link once and accepts the same link idempotently', async () => {
    const root = await createTemporaryRoot('wallpaper-engine-link-');
    const projectsDirectory = await createProjectsDirectory(root);
    const options = { name: 'wallpaper', projectsDirectory };

    const created = await ensureWallpaperProjectLink(root, 'dist', true, options);
    const repeated = await ensureWallpaperProjectLink(root, 'dist', true, options);
    const linkPath = join(projectsDirectory, 'wallpaper');

    expect(created).toEqual({
      created: true,
      linkPath: await realpath(projectsDirectory).then(parent => join(parent, 'wallpaper')),
      targetPath: await realpath(join(root, 'dist')),
    });
    expect(repeated).toEqual({ ...created, created: false });
    expect((await lstat(linkPath)).isSymbolicLink()).toBe(true);
    expect(await realpath(linkPath)).toBe(await realpath(join(root, 'dist')));
  });

  it('accepts concurrent creation with one created result', async () => {
    const root = await createTemporaryRoot('wallpaper-engine-race-');
    const projectsDirectory = await createProjectsDirectory(root);
    const options = { name: 'wallpaper', projectsDirectory };

    const results = await Promise.all([
      ensureWallpaperProjectLink(root, 'dist', true, options),
      ensureWallpaperProjectLink(root, 'dist', true, options),
    ]);

    expect(results.map(result => result?.created).sort()).toEqual([false, true]);
    expect(await realpath(join(projectsDirectory, 'wallpaper')))
      .toBe(await realpath(join(root, 'dist')));
  });

  it('rejects and preserves an existing real directory', async () => {
    const root = await createTemporaryRoot('wallpaper-engine-directory-collision-');
    const projectsDirectory = await createProjectsDirectory(root);
    const destination = join(projectsDirectory, 'wallpaper');
    const sentinel = join(destination, 'sentinel.txt');
    await mkdir(destination);
    await writeFile(sentinel, 'keep');

    await expect(ensureWallpaperProjectLink(root, 'dist', true, {
      name: 'wallpaper',
      projectsDirectory,
    })).rejects.toThrow('the path already exists and is not a link');
    await expect(readFile(sentinel, 'utf8')).resolves.toBe('keep');
  });

  it('rejects and preserves an existing real file', async () => {
    const root = await createTemporaryRoot('wallpaper-engine-file-collision-');
    const projectsDirectory = await createProjectsDirectory(root);
    const destination = join(projectsDirectory, 'wallpaper');
    await writeFile(destination, 'keep');

    await expect(ensureWallpaperProjectLink(root, 'dist', true, {
      name: 'wallpaper',
      projectsDirectory,
    })).rejects.toThrow('the path already exists and is not a link');
    await expect(readFile(destination, 'utf8')).resolves.toBe('keep');
  });

  it('rejects and preserves a link to another existing target', async () => {
    const root = await createTemporaryRoot('wallpaper-engine-wrong-link-');
    const projectsDirectory = await createProjectsDirectory(root);
    const wrongTarget = join(root, 'wrong-target');
    const sentinel = join(wrongTarget, 'sentinel.txt');
    await mkdir(wrongTarget);
    await writeFile(sentinel, 'keep');
    await createDirectoryLink(wrongTarget, join(projectsDirectory, 'wallpaper'));

    await expect(ensureWallpaperProjectLink(root, 'dist', true, {
      name: 'wallpaper',
      projectsDirectory,
    })).rejects.toThrow('the path already exists and is not a link');
    await expect(readFile(sentinel, 'utf8')).resolves.toBe('keep');
    expect(await realpath(join(projectsDirectory, 'wallpaper')))
      .toBe(await realpath(wrongTarget));
  });

  it('rejects and preserves a broken link to another target', async () => {
    const root = await createTemporaryRoot('wallpaper-engine-broken-link-');
    const projectsDirectory = await createProjectsDirectory(root);
    const destination = join(projectsDirectory, 'wallpaper');
    await createDirectoryLink(join(root, 'missing-target'), destination);

    await expect(ensureWallpaperProjectLink(root, 'dist', true, {
      name: 'wallpaper',
      projectsDirectory,
    })).rejects.toThrow('the path already exists and is not a link');
    expect((await lstat(destination)).isSymbolicLink()).toBe(true);
  });

  it.each([
    '',
    ' ',
    ' leading',
    'trailing ',
    '.',
    '..',
    'nested/name',
    'nested\\name',
    'nul\0name',
  ])('rejects invalid project name %j', async (name) => {
    await expect(ensureWallpaperProjectLink('root', 'dist', true, {
      name,
      projectsDirectory: 'ignored',
    })).rejects.toThrow(
      'projectLink.name must be a single non-empty directory name without path separators.',
    );
  });

  it('rejects a relative projects directory', async () => {
    await expect(ensureWallpaperProjectLink('root', 'dist', true, {
      name: 'wallpaper',
      projectsDirectory: 'relative/myprojects',
    })).rejects.toThrow(
      'projectLink.projectsDirectory must be an absolute path.',
    );
  });

  it('rejects missing and non-directory project parents', async () => {
    const root = await createTemporaryRoot('wallpaper-engine-parent-');
    const missing = join(root, 'missing');
    const file = join(root, 'file');
    await writeFile(file, 'not a directory');

    await expect(ensureWallpaperProjectLink(root, 'dist', true, {
      name: 'wallpaper',
      projectsDirectory: missing,
    })).rejects.toThrow('must already exist and be a directory');
    await expect(ensureWallpaperProjectLink(root, 'dist', true, {
      name: 'wallpaper',
      projectsDirectory: file,
    })).rejects.toThrow('must already exist and be a directory');
  });

  it('rejects equal and nested source/destination paths', async () => {
    const root = await createTemporaryRoot('wallpaper-engine-overlap-');
    const projectsDirectory = await createProjectsDirectory(root);
    const equalTarget = join(projectsDirectory, 'equal');
    const containingTarget = join(root, 'target');
    const nestedProjects = join(containingTarget, 'projects');
    await mkdir(nestedProjects, { recursive: true });

    await expect(ensureWallpaperProjectLink(root, equalTarget, true, {
      name: 'equal',
      projectsDirectory,
    })).rejects.toThrow('paths overlap');
    await expect(ensureWallpaperProjectLink(root, containingTarget, true, {
      name: 'nested',
      projectsDirectory: nestedProjects,
    })).rejects.toThrow('paths overlap');
    await expect(ensureWallpaperProjectLink(root, join(projectsDirectory, 'outer', 'dist'), true, {
      name: 'outer',
      projectsDirectory,
    })).rejects.toThrow('paths overlap');
  });

  it('does nothing for unwritten builds', async () => {
    const root = await createTemporaryRoot('wallpaper-engine-no-write-');

    await expect(ensureWallpaperProjectLink(root, 'dist', false, {
      name: 'invalid/name',
      projectsDirectory: 'relative',
    })).resolves.toBeUndefined();
    await expect(lstat(join(root, 'dist'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
