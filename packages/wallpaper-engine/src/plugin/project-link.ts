interface ProjectLinkResult {
  created: boolean;
  linkPath: string;
  targetPath: string;
}
type NodeFs = typeof import('node:fs/promises');
type NodePath = typeof import('node:path');
type PathNormalizer = (path: string) => string;
type DirectoryLinkType = 'dir' | 'junction';

/**
 * Configure a persistent link from Wallpaper Engine's local projects directory
 * to Vite's build output.
 *
 * @example
 * projectLink: { name: 'my-wallpaper' }
 */
export interface WallpaperProjectLinkOptions {
  /** Directory name created below Wallpaper Engine's `projects/myprojects`. */
  name: string;
  /** Absolute path to Wallpaper Engine's `projects/myprojects` directory. */
  projectsDirectory?: string;
}

const DISCOVERY_ERROR = 'Unable to find Wallpaper Engine\'s projects/myprojects directory. Set projectLink.projectsDirectory explicitly.';

/**
 * Find the local Wallpaper Engine `projects/myprojects` directory.
 *
 * Candidate Steam roots are intended for deterministic tests and bypass
 * Windows registry and conventional-install discovery.
 *
 * @example
 * const projectsDirectory = await discoverWallpaperProjectsDirectory();
 */
export async function discoverWallpaperProjectsDirectory(
  candidateSteamRoots?: readonly string[],
): Promise<string> {
  // Node modules stay dynamic so property builders remain browser-safe.
  const [fs, path, nodeProcess] = await Promise.all([
    import(/* @vite-ignore */ 'node:fs/promises'),
    import(/* @vite-ignore */ 'node:path'),
    import(/* @vite-ignore */ 'node:process'),
  ]);
  assertAutomaticDiscoverySupported(
    candidateSteamRoots,
    nodeProcess.platform,
  );

  const normalizePath = pathNormalizerForPlatform(nodeProcess.platform);
  const steamRoots = candidateSteamRoots === undefined
    ? await collectWindowsSteamRoots(path, nodeProcess.env)
    : [...candidateSteamRoots];
  const libraries = await collectSteamLibraries(
    fs,
    path,
    deduplicatePaths(steamRoots, path, normalizePath),
  );
  const matches = await findWallpaperProjectsDirectories(
    fs,
    path,
    libraries,
    normalizePath,
  );
  return selectDiscoveredProjectsDirectory(matches);
}

/**
 * Create or validate the configured Wallpaper Engine project link.
 *
 * @example
 * await ensureWallpaperProjectLink(root, 'dist', true, {
 *   name: 'my-wallpaper',
 *   projectsDirectory: 'C:\\Wallpaper Engine\\projects\\myprojects',
 * });
 */
export async function ensureWallpaperProjectLink(
  root: string,
  outDir: string,
  write: boolean,
  options: WallpaperProjectLinkOptions | undefined,
): Promise<ProjectLinkResult | undefined> {
  if (options === undefined || !write)
    return;

  validateProjectName(options.name);
  // Node modules stay dynamic so property builders remain browser-safe.
  const [fs, path, nodeProcess] = await Promise.all([
    import(/* @vite-ignore */ 'node:fs/promises'),
    import(/* @vite-ignore */ 'node:path'),
    import(/* @vite-ignore */ 'node:process'),
  ]);
  validateProjectsDirectoryOption(path, options.projectsDirectory);

  const requestedTargetPath = path.resolve(root, outDir);
  const requestedProjectsDirectory = options.projectsDirectory
    ?? await discoverWallpaperProjectsDirectory();
  const projectsDirectory = await resolveProjectsDirectory(
    fs,
    requestedProjectsDirectory,
  );
  const normalizePath = pathNormalizerForPlatform(nodeProcess.platform);
  const { linkPath, targetPath } = await prepareProjectLinkPaths(
    fs,
    path,
    requestedTargetPath,
    projectsDirectory,
    options.name,
    normalizePath,
  );
  const created = await createProjectLink(
    fs,
    path,
    linkPath,
    targetPath,
    directoryLinkTypeForPlatform(nodeProcess.platform),
    normalizePath,
  );
  return { created, linkPath, targetPath };
}

function assertAutomaticDiscoverySupported(
  candidateSteamRoots: readonly string[] | undefined,
  platform: string,
): void {
  if (candidateSteamRoots === undefined && platform !== 'win32') {
    throw new Error(
      `${DISCOVERY_ERROR} Automatic discovery is only supported on Windows.`,
    );
  }
}

async function collectSteamLibraries(
  fs: NodeFs,
  path: NodePath,
  steamRoots: readonly string[],
): Promise<string[]> {
  const libraries: string[] = [];
  for (const steamRoot of steamRoots) {
    libraries.push(
      steamRoot,
      ...await readSteamLibraryPaths(fs, path, steamRoot),
    );
  }
  return libraries;
}

async function readSteamLibraryPaths(
  fs: NodeFs,
  path: NodePath,
  steamRoot: string,
): Promise<string[]> {
  const libraryFoldersPath = path.join(
    steamRoot,
    'steamapps',
    'libraryfolders.vdf',
  );
  try {
    return parseSteamLibraryPaths(
      await fs.readFile(libraryFoldersPath, 'utf8'),
    );
  }
  catch (error) {
    if (isMissingPathError(error))
      return [];
    throw pathError('read Steam library file', libraryFoldersPath, error);
  }
}

async function findWallpaperProjectsDirectories(
  fs: NodeFs,
  path: NodePath,
  libraries: readonly string[],
  normalizePath: PathNormalizer,
): Promise<string[]> {
  const matches: string[] = [];
  const seenMatches = new Set<string>();
  const uniqueLibraries = deduplicatePaths(libraries, path, normalizePath);
  for (const library of uniqueLibraries) {
    const match = await resolveWallpaperProjectsDirectory(fs, path, library);
    if (match === undefined)
      continue;
    const matchKey = normalizePath(match);
    if (seenMatches.has(matchKey))
      continue;
    seenMatches.add(matchKey);
    matches.push(match);
  }
  return matches;
}

async function resolveWallpaperProjectsDirectory(
  fs: NodeFs,
  path: NodePath,
  library: string,
): Promise<string | undefined> {
  const projectsDirectory = path.join(
    library,
    'steamapps',
    'common',
    'wallpaper_engine',
    'projects',
    'myprojects',
  );
  let projectsStat;
  try {
    projectsStat = await fs.stat(projectsDirectory);
  }
  catch (error) {
    if (isMissingPathError(error))
      return;
    throw pathError(
      'inspect Wallpaper Engine projects directory',
      projectsDirectory,
      error,
    );
  }
  if (!projectsStat.isDirectory())
    return;
  try {
    return await fs.realpath(projectsDirectory);
  }
  catch (error) {
    throw pathError(
      'resolve Wallpaper Engine projects directory',
      projectsDirectory,
      error,
    );
  }
}

function selectDiscoveredProjectsDirectory(matches: readonly string[]): string {
  if (matches.length === 0)
    throw new Error(DISCOVERY_ERROR);
  if (matches.length === 1)
    return matches[0]!;

  const listedMatches = matches.map(match => `- ${match}`).join('\n');
  throw new Error(
    `Found multiple Wallpaper Engine projects/myprojects directories:\n${listedMatches}\nSet projectLink.projectsDirectory explicitly.`,
  );
}

function validateProjectsDirectoryOption(
  path: NodePath,
  projectsDirectory: string | undefined,
): void {
  if (projectsDirectory !== undefined && !path.isAbsolute(projectsDirectory)) {
    throw new TypeError(
      'projectLink.projectsDirectory must be an absolute path.',
    );
  }
}

async function resolveProjectsDirectory(
  fs: NodeFs,
  requestedProjectsDirectory: string,
): Promise<string> {
  let projectsStat;
  try {
    projectsStat = await fs.stat(requestedProjectsDirectory);
  }
  catch (error) {
    throw new Error(
      `Wallpaper Engine projects directory "${requestedProjectsDirectory}" must already exist and be a directory.`,
      { cause: error },
    );
  }
  if (!projectsStat.isDirectory()) {
    throw new Error(
      `Wallpaper Engine projects directory "${requestedProjectsDirectory}" must already exist and be a directory.`,
    );
  }
  try {
    return await fs.realpath(requestedProjectsDirectory);
  }
  catch (error) {
    throw pathError(
      'resolve Wallpaper Engine projects directory',
      requestedProjectsDirectory,
      error,
    );
  }
}

async function prepareProjectLinkPaths(
  fs: NodeFs,
  path: NodePath,
  requestedTargetPath: string,
  projectsDirectory: string,
  name: string,
  normalizePath: PathNormalizer,
): Promise<Pick<ProjectLinkResult, 'linkPath' | 'targetPath'>> {
  const linkPath = path.join(projectsDirectory, name);
  assertPathsDoNotOverlap(path, requestedTargetPath, linkPath, normalizePath);
  try {
    await fs.mkdir(requestedTargetPath, { recursive: true });
  }
  catch (error) {
    throw linkFilesystemError(linkPath, requestedTargetPath, error);
  }

  let targetPath: string;
  try {
    targetPath = await fs.realpath(requestedTargetPath);
  }
  catch (error) {
    throw linkFilesystemError(linkPath, requestedTargetPath, error);
  }
  assertPathsDoNotOverlap(path, targetPath, linkPath, normalizePath);
  return { linkPath, targetPath };
}

async function createProjectLink(
  fs: NodeFs,
  path: NodePath,
  linkPath: string,
  targetPath: string,
  linkType: DirectoryLinkType,
  normalizePath: PathNormalizer,
): Promise<boolean> {
  const existing = await inspectExistingLink(
    fs,
    path,
    linkPath,
    targetPath,
    normalizePath,
  );
  const existingResult = resolveExistingLink(existing, linkPath, targetPath);
  if (existingResult !== undefined)
    return existingResult;

  try {
    await fs.symlink(targetPath, linkPath, linkType);
    return true;
  }
  catch (error) {
    if (!isErrorCode(error, 'EEXIST'))
      throw linkFilesystemError(linkPath, targetPath, error);
    const raced = await inspectExistingLink(
      fs,
      path,
      linkPath,
      targetPath,
      normalizePath,
    );
    const racedResult = resolveExistingLink(raced, linkPath, targetPath);
    if (racedResult !== undefined)
      return racedResult;
    throw linkFilesystemError(linkPath, targetPath, error);
  }
}

function resolveExistingLink(
  state: 'absent' | 'correct' | 'wrong',
  linkPath: string,
  targetPath: string,
): boolean | undefined {
  if (state === 'absent')
    return;
  if (state === 'correct')
    return false;
  throw wrongDestinationError(linkPath, targetPath);
}

function pathNormalizerForPlatform(platform: string): PathNormalizer {
  return platform === 'win32' ? normalizeWindowsPath : preservePath;
}

function directoryLinkTypeForPlatform(platform: string): DirectoryLinkType {
  return platform === 'win32' ? 'junction' : 'dir';
}

function normalizeWindowsPath(path: string): string {
  return path.toLocaleLowerCase('en-US');
}

function preservePath(path: string): string {
  return path;
}

async function collectWindowsSteamRoots(
  path: typeof import('node:path'),
  environment: Record<string, string | undefined>,
): Promise<string[]> {
  const roots: Array<string | undefined> = [
    await readRegistrySteamPath(),
    environment['ProgramFiles(x86)'] === undefined
      ? undefined
      : path.join(environment['ProgramFiles(x86)'], 'Steam'),
    environment.ProgramFiles === undefined
      ? undefined
      : path.join(environment.ProgramFiles, 'Steam'),
    String.raw`C:\Program Files (x86)\Steam`,
    String.raw`C:\Program Files\Steam`,
  ];
  return roots.filter((root): root is string => root !== undefined);
}

async function readRegistrySteamPath(): Promise<string | undefined> {
  // Platform-only modules stay dynamic so browser imports never load them.
  const [{ execFile }, { promisify }] = await Promise.all([
    import(/* @vite-ignore */ 'node:child_process'),
    import(/* @vite-ignore */ 'node:util'),
  ]);
  let stdout: string;
  try {
    ({ stdout } = await promisify(execFile)(
      'reg.exe',
      ['query', String.raw`HKCU\Software\Valve\Steam`, '/v', 'SteamPath'],
      { encoding: 'utf8', timeout: 2_000, windowsHide: true },
    ));
  }
  catch {
    return;
  }

  const line = stdout
    .split(/\r?\n/)
    .find(line => line.trimStart().startsWith('SteamPath'));
  const trimmed = line?.trim();
  const type = trimmed === undefined
    ? undefined
    : /\bREG_[A-Z_]+\b/i.exec(trimmed);
  if (trimmed === undefined || type === undefined || type === null)
    return;
  const name = trimmed.slice(0, type.index).trim();
  const value = trimmed.slice(type.index + type[0].length).trim();
  return name === 'SteamPath' && value.length > 0 ? value : undefined;
}

function parseSteamLibraryPaths(source: string): string[] {
  const paths: string[] = [];
  const pattern = /"path"\s*"((?:\\.|[^"\\])*)"/gi;
  for (const match of source.matchAll(pattern)) {
    const value = match[1];
    if (value !== undefined) {
      paths.push(value.replace(/\\\\|\\"/g, escaped => escaped.slice(1)));
    }
  }
  return paths;
}

function deduplicatePaths(
  paths: readonly string[],
  path: NodePath,
  normalizePath: PathNormalizer,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of paths) {
    const resolved = path.resolve(candidate);
    const key = normalizePath(resolved);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(resolved);
    }
  }
  return result;
}

function validateProjectName(name: string): void {
  if (
    typeof name !== 'string'
    || name.length === 0
    || name.trim() !== name
    || name === '.'
    || name === '..'
    || name.includes('\0')
    || name.includes('/')
    || name.includes('\\')
  ) {
    throw new TypeError(
      'projectLink.name must be a single non-empty directory name without path separators.',
    );
  }
}

function assertPathsDoNotOverlap(
  path: NodePath,
  targetPath: string,
  linkPath: string,
  normalizePath: PathNormalizer,
): void {
  const target = normalizePath(path.resolve(targetPath));
  const link = normalizePath(path.resolve(linkPath));
  if (
    containsPath(path, target, link)
    || containsPath(path, link, target)
  ) {
    throw new Error(
      `Wallpaper Engine project link paths overlap: target "${targetPath}" and destination "${linkPath}" must not be equal or contain one another.`,
    );
  }
}

function containsPath(
  path: typeof import('node:path'),
  parent: string,
  child: string,
): boolean {
  const relative = path.relative(parent, child);
  return relative === ''
    || (
      relative !== '..'
      && !relative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relative)
    );
}

async function inspectExistingLink(
  fs: NodeFs,
  path: NodePath,
  linkPath: string,
  targetPath: string,
  normalizePath: PathNormalizer,
): Promise<'absent' | 'correct' | 'wrong'> {
  let destinationStat;
  try {
    destinationStat = await fs.lstat(linkPath);
  }
  catch (error) {
    if (isMissingPathError(error))
      return 'absent';
    throw linkFilesystemError(linkPath, targetPath, error);
  }
  if (!destinationStat.isSymbolicLink())
    return 'wrong';

  let rawTarget: string;
  try {
    rawTarget = await fs.readlink(linkPath);
  }
  catch (error) {
    throw linkFilesystemError(linkPath, targetPath, error);
  }
  const resolvedRawTarget = path.resolve(path.dirname(linkPath), rawTarget);
  if (pathsEqual(resolvedRawTarget, targetPath, normalizePath))
    return 'correct';

  try {
    const resolvedTarget = await fs.realpath(linkPath);
    return pathsEqual(resolvedTarget, targetPath, normalizePath)
      ? 'correct'
      : 'wrong';
  }
  catch (error) {
    if (isMissingPathError(error))
      return 'wrong';
    throw linkFilesystemError(linkPath, targetPath, error);
  }
}

function pathsEqual(
  left: string,
  right: string,
  normalizePath: PathNormalizer,
): boolean {
  return normalizePath(left) === normalizePath(right);
}

function wrongDestinationError(linkPath: string, targetPath: string): Error {
  return new Error(
    `Cannot create Wallpaper Engine project link at "${linkPath}": the path already exists and is not a link to "${targetPath}".`,
  );
}

function linkFilesystemError(
  linkPath: string,
  targetPath: string,
  cause: unknown,
): Error {
  return new Error(
    `Unable to create Wallpaper Engine project link at "${linkPath}" to "${targetPath}": ${errorMessage(cause)}`,
    { cause },
  );
}

function pathError(action: string, path: string, cause: unknown): Error {
  return new Error(
    `Unable to ${action} "${path}": ${errorMessage(cause)}`,
    { cause },
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingPathError(error: unknown): boolean {
  return isErrorCode(error, 'ENOENT') || isErrorCode(error, 'ENOTDIR');
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === code;
}
