import type * as NodeFsPromises from 'node:fs/promises';
import type * as NodePath from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import type {
  WallpaperBoolValue,
  WallpaperColorValue,
  WallpaperComboValue,
  WallpaperDirectoryValue,
  WallpaperFileValue,
  WallpaperSliderValue,
  WallpaperTextValue,
} from '../types/listeners';
import type {
  WallpaperBoolProperty,
  WallpaperColorProperty,
  WallpaperComboProperty,
  WallpaperDirectoryProperty,
  WallpaperFileProperty,
  WallpaperGroupProperty,
  WallpaperLocalization,
  WallpaperProjectGeneral,
  WallpaperProjectMetadata,
  WallpaperPropertyDefinition,
  WallpaperSliderProperty,
  WallpaperTextInputProperty,
} from '../types/project';
import type { WallpaperProjectLinkOptions } from './project-link';
import { colorToWallpaperColor } from '../color';
import { ensureWallpaperProjectLink } from './project-link';

export type {
  WallpaperBoolProperty,
  WallpaperColorProperty,
  WallpaperComboProperty,
  WallpaperDirectoryProperty,
  WallpaperFileProperty,
  WallpaperGroupProperty,
  WallpaperLocalization,
  WallpaperProjectGeneral,
  WallpaperProjectMetadata,
  WallpaperPropertyDefinition,
  WallpaperSliderProperty,
  WallpaperTextInputProperty,
};
export type {
  WallpaperComboOption,
  WallpaperFileType,
  WallpaperProject,
} from '../types/project';
export type { WallpaperProjectLinkOptions } from './project-link';

// ---------------------------------------------------------------------------
// Property builder helpers
// ---------------------------------------------------------------------------

type Without<T, K extends keyof T> = Omit<T, K>;

/**
 * Define a color property from any color syntax supported by Color.js.
 *
 * CSS named colors, hex, `rgb()`, `hsl()`, `hwb()`, Lab, LCH, OKLab, OKLCH,
 * wide-gamut `color()` values, and Wallpaper Engine's native `"R G B"` format
 * are normalized to the 0–1 sRGB channels required by `project.json`.
 *
 * @example
 * colorProperty({ text: "Accent", value: "hsl(120 100% 50%)" });
 * // → { type: "color", text: "Accent", value: "0 1 0" }
 */
export function colorProperty(
  opts: Without<WallpaperColorProperty, 'type'>,
): WallpaperColorProperty {
  return {
    type: 'color',
    ...opts,
    value: colorToWallpaperColor(opts.value),
  };
}

/**
 * Define a numeric slider property.
 *
 * Wallpaper Engine normalizes `step` to the configured `precision`. When
 * `precision` is omitted, it currently behaves as `precision: 1` and
 * `step: 0.1`, so finer custom steps must include a matching precision. When
 * only `precision` is supplied, this builder derives `step` as
 * `10 ** -precision`; an explicit `step` is emitted unchanged.
 *
 * @example
 * sliderProperty({
 *   text: "Opacity",
 *   value: 0.5,
 *   min: 0,
 *   max: 1,
 *   fraction: true,
 *   precision: 3,
 * }); // step: 0.001
 */
export function sliderProperty(
  opts: Without<WallpaperSliderProperty, 'type'>,
): WallpaperSliderProperty {
  const property: WallpaperSliderProperty = { type: 'slider', ...opts };
  if (property.step === undefined && property.precision !== undefined) {
    property.step = 10 ** -property.precision;
  }
  return property;
}

/** Define a boolean checkbox property */
export function boolProperty(
  opts: Without<WallpaperBoolProperty, 'type'>,
): WallpaperBoolProperty {
  return { type: 'bool', ...opts };
}

/** Define a dropdown (combo) property */
export function comboProperty(
  opts: Without<WallpaperComboProperty, 'type'>,
): WallpaperComboProperty {
  return { type: 'combo', ...opts };
}

/** Define a text input property */
export function textInputProperty(
  opts: Without<WallpaperTextInputProperty, 'type'>,
): WallpaperTextInputProperty {
  return { type: 'textinput', ...opts };
}

/** Define a file picker property */
export function fileProperty(
  opts: Without<WallpaperFileProperty, 'type'>,
): WallpaperFileProperty {
  return { type: 'file', ...opts };
}

/** Define a directory picker property */
export function directoryProperty(
  opts: Without<WallpaperDirectoryProperty, 'type'>,
): WallpaperDirectoryProperty {
  return { type: 'directory', ...opts };
}

/**
 * Define a collapsible property group marker.
 *
 * Properties after this marker belong to the group until the next marker.
 * The marker itself has no runtime value in `applyUserProperties`.
 *
 * @example
 * const properties = {
 *   appearance: groupProperty({ text: "Appearance" }),
 *   background: colorProperty({ text: "Background", value: "0 0 0" }),
 * };
 */
export function groupProperty(
  opts: Without<WallpaperGroupProperty, 'type' | 'value'>,
): WallpaperGroupProperty {
  return { ...opts, type: 'group', value: '' };
}

// ---------------------------------------------------------------------------
// Property definition → runtime value type mapping
// ---------------------------------------------------------------------------

/**
 * Maps a single property **definition** type to its **runtime value** type.
 *
 * Useful for building generic helpers that operate on any property kind.
 *
 * @example
 * type T = PropertyDefinitionToValue<WallpaperColorProperty>;
 * // → WallpaperColorValue
 */
export type PropertyDefinitionToValue<T extends WallpaperPropertyDefinition>
  = T extends { type: 'color' }
    ? WallpaperColorValue
    : T extends { type: 'slider' }
      ? WallpaperSliderValue
      : T extends { type: 'bool' }
        ? WallpaperBoolValue
        : T extends { type: 'combo' }
          ? WallpaperComboValue
          : T extends { type: 'textinput' }
            ? WallpaperTextValue
            : T extends { type: 'file' }
              ? WallpaperFileValue
              : T extends { type: 'directory' }
                ? WallpaperDirectoryValue
                : never;

/**
 * Infer the strongly-typed `applyUserProperties` argument from a property
 * definition record. Define your properties once in a shared file, then pass
 * `typeof yourProperties` here to get full autocomplete on every property key
 * and its value type.
 *
 * @example
 * // properties.ts — shared between vite.config.ts and wallpaper source
 * import { colorProperty, sliderProperty } from 'wallpaper-engine/plugin';
 *
 * export const myProperties = {
 *   bgcolor: colorProperty({ text: 'Background Color', value: '0 0 0' }),
 *   speed:   sliderProperty({ text: 'Speed', value: 1, min: 0, max: 5 }),
 * };
 *
 * // vite.config.ts
 * import { wallpaperEnginePlugin } from 'wallpaper-engine/plugin';
 * import { myProperties } from './properties';
 *
 * export default defineConfig({
 *   plugins: [wallpaperEnginePlugin({ title: 'My Wallpaper', properties: myProperties })],
 * });
 *
 * // wallpaper.ts
 * import type { WallpaperUserPropertiesOf } from 'wallpaper-engine/plugin';
 * import type { myProperties } from './properties';
 *
 * type MyProps = WallpaperUserPropertiesOf<typeof myProperties>;
 * // → { bgcolor: WallpaperColorValue; speed: WallpaperSliderValue }
 *
 * window.wallpaperPropertyListener = {
 *   applyUserProperties(props: Partial<MyProps>) {
 *     if (props.bgcolor) el.style.background = wallpaperColorToRgb(props.bgcolor.value);
 *     if (props.speed !== undefined) setSpeed(props.speed.value); // number ✓
 *   },
 * };
 */
export type WallpaperUserPropertiesOf<
  T extends Record<string, WallpaperPropertyDefinition>,
> = {
  readonly [K in keyof T as T[K] extends { type: 'group' }
    ? never
    : K]: PropertyDefinitionToValue<T[K]>;
};

// ---------------------------------------------------------------------------
// Vite plugin
// ---------------------------------------------------------------------------

export interface WallpaperEnginePluginOptions {
  /**
   * Entry HTML file name relative to the project root.
   * @default "index.html"
   */
  file?: string;
  /** Wallpaper title shown in the Wallpaper Engine UI */
  title: string;
  /**
   * Wallpaper Engine browser scheme color. Accepts any syntax supported by
   * Color.js and emits the reserved index-free
   * `general.properties.schemecolor` property.
   *
   * When omitted, a valid editor-managed value from previous output is
   * preserved.
   *
   * @example
   * schemeColor: '#5994ff'
   */
  schemeColor?: string;
  /**
   * Source-controlled author metadata merged into `project.json`.
   * `undefined` fields do not override preserved values.
   *
   * @example
   * metadata: {
   *   description: 'An animated night sky.',
   *   preview: 'preview.jpg',
   *   tags: ['Landscape'],
   * }
   */
  metadata?: WallpaperProjectMetadata;
  /**
   * JSON file containing a flat top-level metadata/state object. Relative
   * paths are resolved from Vite's final project root. Generated `file`,
   * `title`, `type`, and `general` fields always take precedence.
   *
   * @example
   * metadataFile: 'wallpaper-engine.metadata.json'
   */
  metadataFile?: string;
  /**
   * Link this wallpaper's written build output into Wallpaper Engine's local
   * projects directory. Automatic directory discovery is Windows-only.
   *
   * @example
   * projectLink: { name: 'my-wallpaper' }
   */
  projectLink?: WallpaperProjectLinkOptions;
  /**
   * Emit `project.json` without indentation or line breaks. Defaults to
   * enabled for production builds and disabled during development.
   *
   * @default `true` for build, `false` for dev
   * @example
   * minify: false
   */
  minify?: boolean;
  /**
   * Override automatic audio-listener detection.
   *
   * By default, production JavaScript and HTML are scanned for calls to
   * `wallpaperRegisterAudioListener`. Set this to `true` to always enable
   * audio processing or `false` to explicitly disable it.
   */
  supportsAudioProcessing?: boolean;
  /**
   * User-configurable properties exposed in the Wallpaper Engine properties panel.
   * Keys become the property identifiers accessed in `applyUserProperties`.
   *
   * @example
   * properties: {
   *   bgcolor: colorProperty({ text: 'Background Color', value: '0 0 0' }),
   *   speed:   sliderProperty({ text: 'Speed', value: 1, min: 0, max: 5 }),
   * }
   */
  properties?: Record<string, WallpaperPropertyDefinition>;
  /**
   * Localization strings for property labels and combo option labels.
   * Keys are BCP 47 language codes (e.g. `"en-us"`, `"de-de"`, `"zh-chs"`).
   * Property labels that should be translated must start with `ui_`.
   *
   * @example
   * localization: {
   *   'en-us': { 'ui_bgcolor': 'Background Color' },
   *   'de-de': { 'ui_bgcolor': 'Hintergrundfarbe' },
   * }
   */
  localization?: WallpaperLocalization;
  /**
   * Enable the in-browser dev overlay during `vite dev`. The overlay stubs
   * every `window.wallpaper*` global, renders a draggable panel to edit each
   * property in real time, and lets you fire audio/media/plugin events
   * manually — so wallpapers can be developed without round-tripping through
   * the Wallpaper Engine host application.
   *
   * Disabled automatically for production builds regardless of this setting.
   *
   * @default true
   */
  devtools?: boolean;
}

/**
 * Vite plugin that auto-generates `project.json` into the build output.
 *
 * @example
 * // vite.config.ts
 * import { wallpaperEnginePlugin, colorProperty } from 'wallpaper-engine/plugin';
 *
 * export default defineConfig({
 *   plugins: [
 *     wallpaperEnginePlugin({
 *       title: 'My Wallpaper',
 *       properties: {
 *         bgcolor: colorProperty({ text: 'Background Color', value: '0 0 0' }),
 *       },
 *     }),
 *   ],
 * });
 */
export function wallpaperEnginePlugin(
  options: WallpaperEnginePluginOptions,
): Plugin {
  const devtoolsEnabled = options.devtools !== false;
  const VIRTUAL_ID = 'virtual:wallpaper-engine/devtools';
  const RESOLVED_ID = `\0${VIRTUAL_ID}`;
  let isServe = false;
  let cachedClientCode: Promise<string> | undefined;
  let preservationState: PreservationState | undefined;
  const loadClientCode = (): Promise<string> => {
    cachedClientCode ??= (async () => {
      // Reads the bundled Vue UI asynchronously. Dynamic imports keep this
      // entry browser-safe when consumers import only its property builders.
      const [{ readFile }, { fileURLToPath }] = await Promise.all([
        import(/* @vite-ignore */ 'node:fs/promises'),
        import(/* @vite-ignore */ 'node:url'),
      ]);
      const url = new URL('./devtools/client.js', import.meta.url);
      return readFile(fileURLToPath(url), 'utf8');
    })();
    return cachedClientCode;
  };

  return {
    name: 'wallpaper-engine',

    configResolved(config) {
      isServe = config.command === 'serve';
      if (isServe)
        return;
      return capturePreservationState(
        config,
        options.metadata,
        options.metadataFile,
      ).then(async (state) => {
        const link = await ensureWallpaperProjectLink(
          config.root,
          config.build.outDir,
          config.build.write,
          options.projectLink,
        );
        preservationState = state;
        if (link?.created) {
          config.logger.info(
            `[wallpaper-engine] linked ${link.linkPath} -> ${link.targetPath}`,
          );
        }
      });
    },

    async configureServer(server) {
      if (!devtoolsEnabled)
        return;
      const [fs, { fileURLToPath }] = await Promise.all([
        import(/* @vite-ignore */ 'node:fs'),
        import(/* @vite-ignore */ 'node:url'),
      ]);
      const clientPath = fileURLToPath(
        new URL('./devtools/client.js', import.meta.url),
      );
      // Use stat-polling watchFile instead of chokidar: avoids Windows
      // path-normalisation mismatches (forward vs back slashes) and works
      // correctly across Bun workspace symlinks.
      fs.watchFile(clientPath, { interval: 500 }, () => {
        cachedClientCode = undefined;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod)
          server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
      server.httpServer?.once('close', () => {
        fs.unwatchFile(clientPath);
      });
    },

    resolveId(id) {
      if (id === VIRTUAL_ID)
        return RESOLVED_ID;
      return null;
    },

    async load(id) {
      if (id !== RESOLVED_ID)
        return null;
      const properties = options.properties
        ? assignIndices(options.properties)
        : {};
      const cfg = {
        title: options.title,
        properties,
        localization: options.localization ?? {},
      };
      return (
        `window.__WE_DEVTOOLS_CONFIG__ = ${
          JSON.stringify(cfg)
        };\n${
          await loadClientCode()}`
      );
    },

    transformIndexHtml() {
      if (!isServe || !devtoolsEnabled)
        return;
      return [
        {
          tag: 'script',
          attrs: { type: 'module', src: `/@id/${VIRTUAL_ID}` },
          injectTo: 'head-prepend',
        },
      ];
    },

    generateBundle(_outputOptions, bundle) {
      let properties = options.properties
        ? assignIndices(options.properties)
        : undefined;
      if (options.schemeColor !== undefined) {
        properties = {
          ...properties,
          schemecolor: createSchemeColorProperty(options.schemeColor),
        };
      }
      else {
        const preserved = preservationState?.schemeColor;
        if (preserved !== undefined && properties?.schemecolor === undefined)
          properties = { schemecolor: preserved, ...properties };
      }

      const general: WallpaperProjectGeneral = {};
      if (properties)
        general.properties = properties;
      if (options.localization)
        general.localization = options.localization;
      if (
        options.supportsAudioProcessing
        ?? Object.values(bundle).some(bundleOutputRegistersAudioListener)
      ) {
        general.supportsaudioprocessing = true;
      }

      const project: JsonObject = {
        ...(preservationState?.project
          ?? mergePreservationSources(undefined, undefined, options.metadata)),
        file: options.file ?? 'index.html',
        title: options.title,
        type: 'web',
      };
      if (Object.keys(general).length > 0)
        project.general = general;

      const restoredPreview = preservationState === undefined
        ? undefined
        : previewToRestore(project, bundle, preservationState);
      if (restoredPreview) {
        this.emitFile({
          type: 'asset',
          fileName: restoredPreview.fileName,
          source: restoredPreview.source,
        });
      }

      this.emitFile({
        type: 'asset',
        fileName: 'project.json',
        source:
          (options.minify ?? !isServe)
            ? JSON.stringify(project)
            : JSON.stringify(project, null, '\t'),
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
type JsonObject = Record<string, unknown>;

interface CapturedPreview {
  fileName: string;
  path: string;
  source: Uint8Array;
}

interface PreservationState {
  finalPreviewFileName?: string;
  outDir: string;
  preview?: CapturedPreview;
  schemeColor?: WallpaperColorProperty;
  project: JsonObject;
  publicPreviewFileName?: string;
  write: boolean;
}

function previewToRestore(
  project: JsonObject,
  bundle: Record<string, BundleOutput>,
  state: PreservationState,
): CapturedPreview | undefined {
  const finalPreview = project.preview;
  if (typeof finalPreview !== 'string' || finalPreview.length === 0)
    return;

  const finalPreviewFileName = state.finalPreviewFileName;
  const previewInBundle = finalPreviewFileName !== undefined
    && Object.values(bundle).some(
      output =>
        output.fileName.replaceAll('\\', '/') === finalPreviewFileName,
    );
  const previewInPublicDir = state.write
    && state.publicPreviewFileName === finalPreviewFileName;
  if (previewInBundle || previewInPublicDir)
    return;

  const capturedPreview = state.preview;
  if (
    capturedPreview?.path === finalPreview
    && capturedPreview.fileName === finalPreviewFileName
  ) {
    return capturedPreview;
  }
  if (state.write) {
    throw new Error(
      `Wallpaper Engine preview "${finalPreview}" is not available in the Vite bundle, publicDir, or the previous output. Place it under publicDir at "${finalPreviewFileName}" before building.`,
    );
  }
}

async function capturePreservationState(
  config: ResolvedConfig,
  metadata: WallpaperProjectMetadata | undefined,
  metadataFileOption: string | undefined,
): Promise<PreservationState> {
  const [fs, path] = await Promise.all([
    import(/* @vite-ignore */ 'node:fs/promises'),
    import(/* @vite-ignore */ 'node:path'),
  ]);
  const outDir = path.resolve(config.root, config.build.outDir);
  const projectPath = path.join(outDir, 'project.json');
  const metadataPath = metadataFileOption === undefined
    ? undefined
    : path.resolve(config.root, metadataFileOption);
  const [previousProject, metadataFile] = await Promise.all([
    readJsonObject(fs.readFile, projectPath, false),
    metadataPath === undefined
      ? undefined
      : readJsonObject(fs.readFile, metadataPath, true),
  ]);
  const project = mergePreservationSources(
    previousProject,
    metadataFile,
    metadata,
  );
  const preview = await capturePreviousPreview(
    fs,
    path,
    outDir,
    projectPath,
    previousProject,
  );

  const finalPreview = project.preview;
  let finalPreviewFileName: string | undefined;
  if (typeof finalPreview === 'string' && finalPreview.length > 0) {
    finalPreviewFileName = resolveProjectFile(
      path,
      outDir,
      finalPreview,
      projectPath,
    ).fileName;
  }
  const publicDir = config.publicDir === ''
    ? undefined
    : path.resolve(config.root, config.publicDir);
  const publicPreviewFileName = await findPublicPreviewFileName(
    fs,
    path,
    publicDir,
    finalPreview,
    projectPath,
  );

  return {
    finalPreviewFileName,
    outDir,
    preview,
    project,
    publicPreviewFileName,
    schemeColor: preservedSchemeColor(previousProject),
    write: config.build.write,
  };
}

function createSchemeColorProperty(color: string): WallpaperColorProperty {
  return {
    order: 0,
    text: 'ui_browse_properties_scheme_color',
    type: 'color',
    value: colorToWallpaperColor(color),
  };
}

function preservedSchemeColor(
  previousProject: JsonObject | undefined,
): WallpaperColorProperty | undefined {
  const general = previousProject?.general;
  if (!isJsonObject(general))
    return;
  const properties = general.properties;
  if (!isJsonObject(properties))
    return;
  const schemeColor = properties.schemecolor;
  if (
    !isJsonObject(schemeColor)
    || schemeColor.type !== 'color'
    || typeof schemeColor.text !== 'string'
    || typeof schemeColor.value !== 'string'
  ) {
    return;
  }
  return schemeColor as unknown as WallpaperColorProperty;
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

async function capturePreviousPreview(
  fs: typeof NodeFsPromises,
  path: typeof NodePath,
  outDir: string,
  projectPath: string,
  previousProject: JsonObject | undefined,
): Promise<CapturedPreview | undefined> {
  const previewPath = previousProject?.preview;
  if (typeof previewPath !== 'string' || previewPath.length === 0)
    return;

  const resolvedPreview = resolveProjectFile(
    path,
    outDir,
    previewPath,
    projectPath,
  );
  try {
    return {
      fileName: resolvedPreview.fileName,
      path: previewPath,
      source: await fs.readFile(resolvedPreview.absolutePath),
    };
  }
  catch (error) {
    if (isFileNotFound(error))
      return;
    throw new Error(
      `Unable to read Wallpaper Engine preview "${resolvedPreview.absolutePath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function findPublicPreviewFileName(
  fs: typeof NodeFsPromises,
  path: typeof NodePath,
  publicDir: string | undefined,
  previewPath: unknown,
  projectPath: string,
): Promise<string | undefined> {
  if (
    publicDir === undefined
    || typeof previewPath !== 'string'
    || previewPath.length === 0
  ) {
    return;
  }

  const publicPreview = resolveProjectFile(
    path,
    publicDir,
    previewPath,
    projectPath,
  );
  try {
    return (await fs.stat(publicPreview.absolutePath)).isFile()
      ? publicPreview.fileName
      : undefined;
  }
  catch (error) {
    if (isFileNotFound(error))
      return;
    throw new Error(
      `Unable to inspect Wallpaper Engine preview "${publicPreview.absolutePath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function mergePreservationSources(
  previousProject: JsonObject | undefined,
  metadataFile: JsonObject | undefined,
  metadata: WallpaperProjectMetadata | undefined,
): JsonObject {
  const project = { ...previousProject, ...metadataFile };
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (value !== undefined)
      project[key] = value;
  }
  delete project.file;
  delete project.title;
  delete project.type;
  delete project.general;
  return project;
}

async function readJsonObject(
  readFile: typeof NodeFsPromises.readFile,
  filePath: string,
  required: boolean,
): Promise<JsonObject | undefined> {
  let source: string;
  try {
    source = await readFile(filePath, 'utf8');
  }
  catch (error) {
    if (isFileNotFound(error)) {
      if (!required)
        return;
      throw new Error(
        `Wallpaper Engine metadata file not found: "${filePath}".`,
      );
    }
    throw new Error(
      `Unable to read Wallpaper Engine metadata "${filePath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  }
  catch (error) {
    throw new Error(
      `Invalid JSON in Wallpaper Engine metadata "${filePath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new TypeError(
      `Wallpaper Engine metadata "${filePath}" must contain a top-level JSON object.`,
    );
  }
  return value as JsonObject;
}

function resolveProjectFile(
  path: typeof NodePath,
  root: string,
  projectPath: string,
  sourcePath: string,
): { absolutePath: string; fileName: string } {
  const fileName = projectPath.replaceAll('\\', '/');
  if (
    path.posix.isAbsolute(fileName)
    || path.win32.isAbsolute(projectPath)
    || /^[A-Z]:/i.test(projectPath)
    || fileName.startsWith('//')
  ) {
    throw new RangeError(
      `Unsafe preview path "${projectPath}" in "${sourcePath}": expected a project-relative file inside "${root}".`,
    );
  }

  const normalizedFileName = path.posix.normalize(fileName);
  const absolutePath = path.resolve(root, ...normalizedFileName.split('/'));
  const relativePath = path.relative(root, absolutePath);
  if (
    normalizedFileName === '.'
    || relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    throw new RangeError(
      `Unsafe preview path "${projectPath}" in "${sourcePath}": expected a project-relative file inside "${root}".`,
    );
  }
  return { absolutePath, fileName: normalizedFileName };
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'ENOENT'
  );
}

type BundleOutput
  = | { type: 'chunk'; code: string; fileName: string }
    | { type: 'asset'; fileName: string; source: string | Uint8Array };

const AUDIO_LISTENER_CALLS = [
  /\bwallpaperRegisterAudioListener\s*(?:\?\.\s*)?\(/,
  /\b(?:window|globalThis)\s*\[\s*["']wallpaperRegisterAudioListener["']\s*\]\s*(?:\?\.\s*)?\(/,
] as const;

function bundleOutputRegistersAudioListener(output: BundleOutput): boolean {
  if (output.type === 'chunk') {
    return AUDIO_LISTENER_CALLS.some(pattern => pattern.test(output.code));
  }

  if (!/\.(?:[cm]?js|html?)$/i.test(output.fileName))
    return false;
  const source
    = typeof output.source === 'string'
      ? output.source
      : new TextDecoder().decode(output.source);
  return AUDIO_LISTENER_CALLS.some(pattern => pattern.test(source));
}

/**
 * Auto-assigns `index` and `order` to any properties that don't already have
 * them, based on their insertion order in the record.
 */
function assignIndices(
  properties: Record<string, WallpaperPropertyDefinition>,
): Record<string, WallpaperPropertyDefinition> {
  const result: Record<string, WallpaperPropertyDefinition> = {};
  let i = 0;

  for (const [key, prop] of Object.entries(properties)) {
    result[key] = {
      index: i,
      order: i,
      ...prop,
    };
    i++;
  }

  return result;
}
