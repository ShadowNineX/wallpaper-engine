import type * as NodeFsPromises from 'node:fs/promises';
import type * as NodePath from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import type {
  PropertyDefinitionToValue as InferredPropertyDefinitionToValue,
  WallpaperUserPropertiesOf as InferredWallpaperUserPropertiesOf,
} from '../types/inference';
import type {
  WallpaperBoolProperty,
  WallpaperColorProperty,
  WallpaperComboProperty,
  WallpaperDirectoryProperty,
  WallpaperDividerProperty,
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
  WallpaperDividerProperty,
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
    ...opts,
    type: 'color',
    value: colorToWallpaperColor(opts.value),
  };
}

/**
 * Define a numeric slider property.
 *
 * When only `precision` is supplied, this builder derives an explicit `step`
 * as `10 ** -precision`; a supplied `step` is emitted unchanged. The native
 * property panel falls back to step `1` when it is absent or zero, and rounds
 * slider interactions to `precision` decimal places (default `1`). Supply
 * enough precision for the requested fractional step.
 *
 * @throws {TypeError} If a numeric option is not finite.
 * @throws {RangeError} If `step` is not positive, `precision` is not a
 * non-negative integer, or the derived step underflows.
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
  for (const [name, value] of [
    ['value', opts.value],
    ['min', opts.min],
    ['max', opts.max],
    ['step', opts.step],
    ['precision', opts.precision],
  ] as const) {
    if (value !== undefined && !Number.isFinite(value))
      throw new TypeError(`Slider ${name} must be a finite number.`);
  }
  if (opts.step !== undefined && opts.step <= 0)
    throw new RangeError('Slider step must be greater than zero.');
  if (
    opts.precision !== undefined
    && (!Number.isInteger(opts.precision) || opts.precision < 0)
  ) {
    throw new RangeError('Slider precision must be a non-negative integer.');
  }
  const property: WallpaperSliderProperty = { ...opts, type: 'slider' };
  if (property.step === undefined && property.precision !== undefined) {
    property.step = 10 ** -property.precision;
    if (property.step <= 0)
      throw new RangeError('Slider precision produces an invalid step.');
  }
  return property;
}

/** Define a boolean checkbox property */
export function boolProperty(
  opts: Without<WallpaperBoolProperty, 'type'>,
): WallpaperBoolProperty {
  return { ...opts, type: 'bool' };
}

/** Define a dropdown (combo) property */
export function comboProperty(
  opts: Without<WallpaperComboProperty, 'type'>,
): WallpaperComboProperty {
  return { ...opts, type: 'combo' };
}

/** Define a text input property */
export function textInputProperty(
  opts: Without<WallpaperTextInputProperty, 'type'>,
): WallpaperTextInputProperty {
  return { ...opts, type: 'textinput' };
}

/** Define a file picker property */
export function fileProperty(
  opts: Without<WallpaperFileProperty, 'type'>,
): WallpaperFileProperty {
  return { ...opts, type: 'file' };
}

/** Define a directory picker property */
export function directoryProperty(
  opts: Without<WallpaperDirectoryProperty, 'type'>,
): WallpaperDirectoryProperty {
  return { ...opts, type: 'directory' };
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

/**
 * Define a horizontal property separator with optional label and visibility
 * condition. Native callbacks include divider descriptors without a runtime
 * value; divider keys remain excluded from inferred editable value records.
 *
 * @example
 * const properties = {
 *   enabled: boolProperty({ text: 'Enabled', value: true }),
 *   separator: dividerProperty({ order: 1 }),
 *   accent: colorProperty({ text: 'Accent', value: '#5b86ed' }),
 * };
 */
export function dividerProperty(
  opts: Without<WallpaperDividerProperty, 'type'> = {},
): WallpaperDividerProperty {
  return { ...opts, type: 'divider' };
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
  = InferredPropertyDefinitionToValue<T>;

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
 * @deprecated Use `WallpaperPropertyListenerOf<typeof properties>` from
 * `wallpaper-engine` with `satisfies` for a contextually typed listener.
 *
 * @example
 * import type { WallpaperPropertyListenerOf } from 'wallpaper-engine';
 *
 * window.wallpaperPropertyListener = {
 *   applyUserProperties(values) {
 *     if (values.bgcolor)
 *       el.style.background = wallpaperColorToRgb(values.bgcolor.value);
 *   },
 * } satisfies WallpaperPropertyListenerOf<typeof myProperties>;
 */
export type WallpaperUserPropertiesOf<
  T extends Record<string, WallpaperPropertyDefinition>,
> = InferredWallpaperUserPropertiesOf<T>;

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
   * JSON file containing a flat top-level metadata/state object. The file is
   * created when missing and synchronized with Wallpaper Engine-managed state
   * from the previous output before Vite cleans it. Referenced preview bytes
   * are synchronized under the sibling `<metadata basename>.assets/<preview>`
   * directory so clean clones can reproduce editor previews. Relative paths
   * are resolved from Vite's final project root; the metadata file and
   * resolved preview backup must remain outside the final `build.outDir`.
   * Generated `file`, `title`, `type`, and `general` fields always take
   * precedence.
   *
   * @example
   * metadataFile: 'metadata.json'
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
  const FRONTEND_ID = 'virtual:wallpaper-engine/devtools-frontend';
  const RESOLVED_FRONTEND_ID = `\0${FRONTEND_ID}`;
  const FRONTEND_ROUTE = '__wallpaper-engine-devtools__/';
  let isServe = false;
  let devtoolsBase = '/';
  let cachedClientCode: Promise<string> | undefined;
  let preservationState: PreservationState | undefined;
  let resolvedConfig: ResolvedConfig | undefined;
  let watchCapture = Promise.resolve();
  let cleanupClientWatch: (() => void) | undefined;
  let configuredProjectEntryAvailable = false;
  let emittedProjectEntry = false;
  let projectGenerated = false;
  const loadClientCode = (): Promise<string> => {
    cachedClientCode ??= (async () => {
      // Reads the bundled Vue UI asynchronously. Dynamic imports keep this
      // entry browser-safe when consumers import only its property builders.
      const [{ readFile }, { fileURLToPath }] = await Promise.all([
        import(/* @vite-ignore */ 'node:fs/promises'),
        import(/* @vite-ignore */ 'node:url'),
      ]);
      // This is a Node-side file read, not a consumer browser asset. Builders
      // may share this entry point with a wallpaper's runtime property schema.
      const url = new URL(/* @vite-ignore */ './devtools/client.js', import.meta.url);
      return readFile(fileURLToPath(url), 'utf8');
    })();
    return cachedClientCode;
  };

  return {
    name: 'wallpaper-engine',

    configResolved(config) {
      isServe = config.command === 'serve';
      if (isServe) {
        devtoolsBase = normalizeDevtoolsBase(config.base);
        return;
      }
      resolvedConfig = config;
      return (async () => {
        const projectFile = normalizeProjectEntryFile(options.file ?? 'index.html');
        configuredProjectEntryAvailable = await hasConfiguredProjectEntry(
          config,
          projectFile,
        );
        const state = await capturePreservationState(
          config,
          options.metadata,
          options.metadataFile,
        );
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
      })();
    },

    async watchChange() {
      // Vite clears build.outDir from its renderStart hook. Refresh state here
      // so editor changes made between watch builds are captured first.
      const config = resolvedConfig;
      if (config?.build.watch) {
        const capture = watchCapture
          .catch(() => undefined)
          .then(async () => {
            preservationState = await capturePreservationState(
              config,
              options.metadata,
              options.metadataFile,
            );
          });
        watchCapture = capture;
        await capture;
      }
    },

    async configureServer(server) {
      if (!isServe || !devtoolsEnabled)
        return;
      const frontendPath = `${devtoolsBase}${FRONTEND_ROUTE}`;
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        if (
          pathname !== frontendPath
          || (request.method !== 'GET' && request.method !== 'HEAD')
        ) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(
          request.method === 'HEAD'
            ? undefined
            : devtoolsFrontendHtml(`${devtoolsBase}@id/${FRONTEND_ID}`),
        );
      });
      const [fs, { fileURLToPath }] = await Promise.all([
        import(/* @vite-ignore */ 'node:fs'),
        import(/* @vite-ignore */ 'node:url'),
      ]);
      const clientPath = fileURLToPath(
        new URL(/* @vite-ignore */ './devtools/client.js', import.meta.url),
      );
      // Use stat-polling watchFile instead of chokidar: avoids Windows
      // path-normalisation mismatches (forward vs back slashes) and works
      // correctly across Bun workspace symlinks.
      cleanupClientWatch?.();
      const onClientChange = (): void => {
        cachedClientCode = undefined;
        for (const id of [RESOLVED_ID, RESOLVED_FRONTEND_ID]) {
          const mod = server.moduleGraph.getModuleById(id);
          if (mod)
            server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: 'full-reload' });
      };
      fs.watchFile(clientPath, { interval: 500 }, onClientChange);
      let watching = true;
      const cleanup = (): void => {
        if (!watching)
          return;
        watching = false;
        fs.unwatchFile(clientPath, onClientChange);
        if (cleanupClientWatch === cleanup)
          cleanupClientWatch = undefined;
      };
      cleanupClientWatch = cleanup;
      server.httpServer?.once('close', cleanup);
    },

    async closeBundle() {
      cleanupClientWatch?.();
      const config = resolvedConfig;
      if (config === undefined || config.build.write || !projectGenerated)
        return;
      const projectFile = normalizeProjectEntryFile(options.file ?? 'index.html');
      if (!configuredProjectEntryAvailable && !emittedProjectEntry)
        throw missingProjectEntryError(projectFile);
    },

    async writeBundle() {
      const config = resolvedConfig;
      if (config === undefined || !config.build.write || !projectGenerated)
        return;
      await assertWrittenProjectEntry(
        config,
        normalizeProjectEntryFile(options.file ?? 'index.html'),
      );
    },

    resolveId(id) {
      if (!isServe || !devtoolsEnabled)
        return null;
      if (id === VIRTUAL_ID)
        return RESOLVED_ID;
      if (id === FRONTEND_ID)
        return RESOLVED_FRONTEND_ID;
      return null;
    },

    async load(id) {
      if (!isServe || !devtoolsEnabled)
        return null;
      let role: 'runtime' | 'frontend';
      if (id === RESOLVED_ID)
        role = 'runtime';
      else if (id === RESOLVED_FRONTEND_ID)
        role = 'frontend';
      else
        return null;
      const properties = options.properties
        ? assignIndices(options.properties)
        : {};
      if (options.schemeColor !== undefined) {
        if (options.properties?.schemecolor !== undefined)
          throw new Error('schemeColor cannot be used with an explicit schemecolor property.');
        properties.schemecolor = createSchemeColorProperty(options.schemeColor);
      }
      const cfg = {
        title: options.title,
        properties,
        supportsAudioProcessing: options.supportsAudioProcessing ?? true,
        localization: options.localization ?? {},
      };
      const config = safeJsonForScript(cfg);
      const frontendUrl = `${devtoolsBase}${FRONTEND_ROUTE}`;
      return `window.__WE_DEVTOOLS_ROLE__ = '${role}';\nwindow.__WE_DEVTOOLS_FRONTEND_URL__ = ${safeJsonForScript(frontendUrl)};\nwindow.__WE_DEVTOOLS_CONFIG__ = JSON.parse(${safeJsonForScript(config)});\n${await loadClientCode()}`;
    },

    transformIndexHtml() {
      if (!isServe || !devtoolsEnabled)
        return;
      return [
        {
          tag: 'script',
          attrs: { type: 'module', src: `${devtoolsBase}@id/${VIRTUAL_ID}` },
          injectTo: 'head-prepend',
        },
      ];
    },

    generateBundle(_outputOptions, bundle) {
      const projectFile = normalizeProjectEntryFile(options.file ?? 'index.html');
      emittedProjectEntry = Object.values(bundle).some(
        output => output.fileName === projectFile,
      );
      let properties = options.properties
        ? assignIndices(options.properties)
        : {};
      if (options.schemeColor !== undefined) {
        if (options.properties?.schemecolor !== undefined)
          throw new Error('schemeColor cannot be used with an explicit schemecolor property.');
        properties = {
          ...properties,
          schemecolor: createSchemeColorProperty(options.schemeColor),
        };
      }
      else {
        const preserved = preservationState?.schemeColor;
        if (preserved !== undefined && properties.schemecolor === undefined)
          properties = { schemecolor: preserved, ...properties };
      }

      const general: WallpaperProjectGeneral = { properties };
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
        file: projectFile,
        title: options.title,
        type: 'web',
      };
      project.general = general;

      const projectSource = stringifyProject(
        project,
        (options.minify ?? !isServe) ? undefined : '\t',
      );

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
        source: projectSource,
      });
      projectGenerated = true;
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
type JsonObject = Record<string, unknown>;

function normalizeDevtoolsBase(base: string | undefined): string {
  if (base === undefined || base === '' || base === './')
    return '/';
  const normalized = base.startsWith('/') ? base : `/${base}`;
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

function safeJsonForScript(value: unknown): string {
  return stringifyFiniteJson(value)
    .replaceAll('<', String.raw`\u003C`)
    .replaceAll('\u2028', String.raw`\u2028`)
    .replaceAll('\u2029', String.raw`\u2029`);
}

function stringifyProject(project: JsonObject, space?: string): string {
  const source = stringifyFiniteJson(project, space);
  return source;
}

function stringifyFiniteJson(value: unknown, space?: string): string {
  const source = JSON.stringify(
    value,
    (field, value): unknown => {
      if (typeof value === 'number' && !Number.isFinite(value))
        throw new TypeError(`project.json field "${field}" must be a finite number.`);
      return value;
    },
    space,
  );
  if (source === undefined)
    throw new TypeError('project.json could not be serialized.');
  return source;
}

function devtoolsFrontendHtml(moduleUrl: string): string {
  const safeModuleUrl = moduleUrl
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Wallpaper Engine Devtools</title><script type="module" src="${safeModuleUrl}"></script></head><body></body></html>`;
}

interface CapturedPreview {
  fileName: string;
  source: Uint8Array;
}

interface PreservationState {
  finalPreviewFileName?: string;
  outDir: string;
  preview?: CapturedPreview;
  previewBackupPath?: string;
  publicPreview?: CapturedPreview;
  schemeColor?: WallpaperColorProperty;
  project: JsonObject;
  publicPreviewFileName?: string;
  write: boolean;
}

interface PreservedProjectState {
  metadataFile: JsonObject | undefined;
  metadataPath: string | undefined;
  previousProject: JsonObject | undefined;
  project: JsonObject;
  projectPath: string;
  synchronizedMetadata: JsonObject;
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

  const capturedPublicPreview = state.publicPreview;
  if (capturedPublicPreview?.fileName === finalPreviewFileName)
    return capturedPublicPreview;

  const capturedPreview = state.preview;
  if (capturedPreview?.fileName === finalPreviewFileName) {
    return capturedPreview;
  }
  if (state.write) {
    const backupHint = state.previewBackupPath === undefined
      ? ''
      : `, or the metadata preview backup at "${state.previewBackupPath}"`;
    throw new Error(
      `Wallpaper Engine preview "${finalPreview}" is not available in the Vite bundle, publicDir, the previous output${backupHint}. Place it under publicDir at "${finalPreviewFileName}" before building.`,
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
  const preservedProject = await capturePreservedProjectState(
    fs,
    path,
    config.root,
    outDir,
    metadata,
    metadataFileOption,
  );
  const {
    metadataFile,
    metadataPath,
    previousProject,
    project,
    projectPath,
    synchronizedMetadata,
  } = preservedProject;
  const previousPreview = await capturePreviousPreview(
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
  const previewBackup = metadataPath === undefined
    || finalPreviewFileName === undefined
    ? undefined
    : resolveMetadataPreviewBackup(
        path,
        metadataPath,
        finalPreviewFileName,
      );
  if (previewBackup !== undefined) {
    await assertPreservationPathOutsideOutput(
      fs,
      path,
      outDir,
      previewBackup.rootPath,
      'metadata preview backup root',
    );
    await assertPreservationPathOutsideOutput(
      fs,
      path,
      outDir,
      previewBackup.absolutePath,
      'metadata preview backup',
    );
    await assertMetadataPreviewBackupContained(fs, path, previewBackup);
  }
  const previousPreviewMatches = previousPreview !== undefined
    && previousPreview.fileName === finalPreviewFileName;
  const preview = previousPreviewMatches
    ? previousPreview
    : await captureMetadataPreviewBackup(fs, previewBackup);

  if (metadataPath !== undefined && config.build.write) {
    if (previousPreviewMatches && previewBackup !== undefined) {
      await writeMetadataPreviewBackup(
        fs,
        path,
        previewBackup,
        previousPreview.source,
      );
    }
    await writeMetadataFile(
      fs,
      path,
      metadataPath,
      synchronizedMetadata,
      metadataFile,
    );
  }
  const publicDir = config.publicDir === ''
    ? undefined
    : path.resolve(config.root, config.publicDir);
  const publicPreview = await findPublicPreview(
    fs,
    path,
    publicDir,
    finalPreview,
    projectPath,
    !config.build.write || config.build.copyPublicDir === false,
  );

  return {
    finalPreviewFileName,
    outDir,
    preview,
    previewBackupPath: previewBackup?.absolutePath,
    publicPreview: publicPreview?.captured,
    project,
    publicPreviewFileName: publicPreview?.captured === undefined
      ? publicPreview?.fileName
      : undefined,
    schemeColor: preservedSchemeColor(previousProject),
    write: config.build.write,
  };
}

async function capturePreservedProjectState(
  fs: typeof NodeFsPromises,
  path: typeof NodePath,
  root: string,
  outDir: string,
  metadata: WallpaperProjectMetadata | undefined,
  metadataFileOption: string | undefined,
): Promise<PreservedProjectState> {
  const projectPath = path.join(outDir, 'project.json');
  const metadataPath = metadataFileOption === undefined
    ? undefined
    : path.resolve(root, metadataFileOption);
  if (metadataPath !== undefined) {
    await assertPreservationPathOutsideOutput(
      fs,
      path,
      outDir,
      metadataPath,
      'metadata file',
    );
  }
  const [previousProject, metadataFile] = await Promise.all([
    readJsonObject(fs.readFile, projectPath),
    metadataPath === undefined
      ? undefined
      : readJsonObject(fs.readFile, metadataPath),
  ]);
  const synchronizedMetadata = synchronizeMetadataFile(
    previousProject,
    metadataFile,
  );
  return {
    metadataFile,
    metadataPath,
    previousProject,
    project: mergePreservationSources(
      previousProject,
      synchronizedMetadata,
      metadata,
    ),
    projectPath,
    synchronizedMetadata,
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

interface ResolvedPreviewBackup {
  absolutePath: string;
  fileName: string;
  rootPath: string;
}

async function assertMetadataPreviewBackupContained(
  fs: typeof NodeFsPromises,
  path: typeof NodePath,
  backup: ResolvedPreviewBackup,
): Promise<void> {
  const [canonicalRoot, canonicalDestination] = await Promise.all([
    canonicalizePath(fs, path, backup.rootPath),
    canonicalizePath(fs, path, backup.absolutePath),
  ]);
  if (!isPathInside(path, canonicalRoot, canonicalDestination)) {
    throw new RangeError(
      `Wallpaper Engine metadata preview backup "${backup.absolutePath}" must remain inside metadata preview backup root "${backup.rootPath}".`,
    );
  }
}

async function assertPreservationPathOutsideOutput(
  fs: typeof NodeFsPromises,
  path: typeof NodePath,
  outDir: string,
  preservationPath: string,
  description: string,
): Promise<void> {
  const [canonicalOutDir, canonicalPreservationPath] = await Promise.all([
    canonicalizePath(fs, path, outDir),
    canonicalizePath(fs, path, preservationPath),
  ]);
  if (isPathInside(path, canonicalOutDir, canonicalPreservationPath)) {
    throw new RangeError(
      `Wallpaper Engine ${description} "${preservationPath}" must be outside Vite build.outDir "${outDir}" so output cleanup cannot delete preserved state.`,
    );
  }
}

function isPathInside(path: typeof NodePath, root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === ''
    || (
      relative !== '..'
      && !relative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relative)
    );
}

async function canonicalizePath(
  fs: typeof NodeFsPromises,
  path: typeof NodePath,
  absolutePath: string,
): Promise<string> {
  const missingSegments: string[] = [];
  let current = absolutePath;
  while (true) {
    try {
      const existingPath = await fs.realpath(current);
      missingSegments.reverse();
      return path.join(existingPath, ...missingSegments);
    }
    catch (error) {
      if (!isFileNotFound(error)) {
        throw new Error(
          `Unable to resolve Wallpaper Engine preservation path "${absolutePath}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const parent = path.dirname(current);
      if (parent === current) {
        throw new Error(
          `Unable to resolve Wallpaper Engine preservation path "${absolutePath}": no existing ancestor was found.`,
        );
      }
      missingSegments.push(path.basename(current));
      current = parent;
    }
  }
}

function resolveMetadataPreviewBackup(
  path: typeof NodePath,
  metadataPath: string,
  previewFileName: string,
): ResolvedPreviewBackup {
  const parsed = path.parse(metadataPath);
  const root = path.join(parsed.dir, `${parsed.name}.assets`);
  return { ...resolveProjectFile(path, root, previewFileName, metadataPath), rootPath: root };
}

async function captureMetadataPreviewBackup(
  fs: typeof NodeFsPromises,
  backup: ResolvedPreviewBackup | undefined,
): Promise<CapturedPreview | undefined> {
  if (backup === undefined)
    return;
  try {
    return {
      fileName: backup.fileName,
      source: await fs.readFile(backup.absolutePath),
    };
  }
  catch (error) {
    if (isFileNotFound(error))
      return;
    throw new Error(
      `Unable to read Wallpaper Engine preview backup "${backup.absolutePath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function writeMetadataPreviewBackup(
  fs: typeof NodeFsPromises,
  path: typeof NodePath,
  backup: ResolvedPreviewBackup,
  source: Uint8Array,
): Promise<void> {
  try {
    if (await fileHasBytes(fs, backup.absolutePath, source))
      return;
    await fs.mkdir(path.dirname(backup.absolutePath), { recursive: true });
    await fs.writeFile(backup.absolutePath, source);
  }
  catch (error) {
    throw new Error(
      `Unable to write Wallpaper Engine preview backup "${backup.absolutePath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function findPublicPreview(
  fs: typeof NodeFsPromises,
  path: typeof NodePath,
  publicDir: string | undefined,
  previewPath: unknown,
  projectPath: string,
  capture: boolean,
): Promise<{ captured?: CapturedPreview; fileName: string } | undefined> {
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
    if (!(await fs.stat(publicPreview.absolutePath)).isFile())
      return;
    if (!capture)
      return { fileName: publicPreview.fileName };
    try {
      return {
        captured: {
          fileName: publicPreview.fileName,
          source: await fs.readFile(publicPreview.absolutePath),
        },
        fileName: publicPreview.fileName,
      };
    }
    catch (error) {
      throw new Error(
        `Unable to read Wallpaper Engine preview "${publicPreview.absolutePath}" for output: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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

const AUTHOR_METADATA_KEYS = new Set<keyof WallpaperProjectMetadata>([
  'contentrating',
  'description',
  'preview',
  'ratingsex',
  'ratingviolence',
  'tags',
  'visibility',
]);

function synchronizeMetadataFile(
  previousProject: JsonObject | undefined,
  metadataFile: JsonObject | undefined,
): JsonObject {
  const synchronized = { ...metadataFile };
  const previousMetadata = mergePreservationSources(
    previousProject,
    undefined,
    undefined,
  );
  for (const [key, value] of Object.entries(previousMetadata)) {
    if (AUTHOR_METADATA_KEYS.has(key as keyof WallpaperProjectMetadata)
      && Object.hasOwn(synchronized, key)) {
      continue;
    }
    synchronized[key] = value;
  }
  return synchronized;
}

async function writeMetadataFile(
  fs: typeof NodeFsPromises,
  path: typeof NodePath,
  filePath: string,
  metadata: JsonObject,
  existingMetadata: JsonObject | undefined,
): Promise<void> {
  if (existingMetadata !== undefined && jsonValuesEqual(existingMetadata, metadata))
    return;
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(metadata, null, '\t')}\n`);
  }
  catch (error) {
    throw new Error(
      `Unable to write Wallpaper Engine metadata "${filePath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function fileHasBytes(
  fs: typeof NodeFsPromises,
  filePath: string,
  source: Uint8Array,
): Promise<boolean> {
  try {
    const existing = await fs.readFile(filePath);
    return existing.length === source.length
      && existing.every((value, index) => value === source[index]);
  }
  catch (error) {
    if (isFileNotFound(error))
      return false;
    throw new Error(
      `Unable to read Wallpaper Engine preview backup "${filePath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function jsonValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right))
    return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((value, index) => jsonValuesEqual(value, right[index]));
  }
  if (!isJsonObject(left) || !isJsonObject(right))
    return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every(key => Object.hasOwn(right, key)
      && jsonValuesEqual(left[key], right[key]));
}

async function readJsonObject(
  readFile: typeof NodeFsPromises.readFile,
  filePath: string,
): Promise<JsonObject | undefined> {
  let source: string;
  try {
    source = await readFile(filePath, 'utf8');
  }
  catch (error) {
    if (isFileNotFound(error))
      return;
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

function normalizeProjectEntryFile(projectPath: string): string {
  const fileName = projectPath.replaceAll('\\', '/');
  if (
    fileName.startsWith('/')
    || /^[A-Z]:/i.test(fileName)
    || fileName.startsWith('//')
  ) {
    throw new RangeError(
      `Unsafe project file "${projectPath}": expected a project-relative file.`,
    );
  }
  const segments: string[] = [];
  for (const segment of fileName.split('/')) {
    if (segment === '' || segment === '.')
      continue;
    if (segment === '..') {
      if (segments.length === 0) {
        throw new RangeError(
          `Unsafe project file "${projectPath}": expected a project-relative file.`,
        );
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  if (segments.length === 0) {
    throw new RangeError(
      `Unsafe project file "${projectPath}": expected a project-relative file.`,
    );
  }
  return segments.join('/');
}

async function hasConfiguredProjectEntry(
  config: ResolvedConfig,
  projectFile: string,
): Promise<boolean> {
  const [fs, path] = await Promise.all([
    import(/* @vite-ignore */ 'node:fs/promises'),
    import(/* @vite-ignore */ 'node:path'),
  ]);
  if (
    config.publicDir !== ''
    && (!config.build.write || config.build.copyPublicDir !== false)
  ) {
    const publicRoot = path.resolve(config.root, config.publicDir);
    const publicCandidate = path.resolve(publicRoot, ...projectFile.split('/'));
    const canonicalPublicRoot = await canonicalizePath(fs, path, publicRoot);
    const canonicalPublicCandidate = await canonicalizePath(fs, path, publicCandidate);
    if (
      isPathInside(path, canonicalPublicRoot, canonicalPublicCandidate)
      && await isRegularFile(fs, publicCandidate)
    ) {
      return true;
    }
  }

  // Vite 8's Rolldown hook does not surface normal HTML inputs in this
  // plugin's write:false bundle. The source entry remains loadable to callers
  // that deliberately inspect an in-memory normal-app build. Library builds
  // have no equivalent HTML entry and must still provide an emitted or public
  // file.
  if (config.build.write === false && !config.build.lib) {
    const root = path.resolve(config.root);
    const candidate = path.resolve(root, projectFile);
    const canonicalRoot = await canonicalizePath(fs, path, root);
    const canonicalCandidate = await canonicalizePath(fs, path, candidate);
    if (
      !isPathInside(path, canonicalRoot, canonicalCandidate)
      || !await isRegularFile(fs, candidate)
    ) {
      return false;
    }
    return (projectFile === 'index.html' && config.build.rollupOptions.input === undefined)
      || await configuredInputMatches(
        fs,
        path,
        config.root,
        config.build.rollupOptions.input,
        canonicalCandidate,
      );
  }

  return false;
}

async function configuredInputMatches(
  fs: typeof NodeFsPromises,
  path: typeof NodePath,
  root: string,
  input: unknown,
  candidate: string,
): Promise<boolean> {
  const inputs = typeof input === 'string'
    ? [input]
    : Array.isArray(input)
      ? input.filter((item): item is string => typeof item === 'string')
      : input !== null && typeof input === 'object'
        ? Object.values(input).filter((item): item is string => typeof item === 'string')
        : [];
  for (const item of inputs) {
    const configured = await canonicalizePath(fs, path, path.resolve(root, item));
    if (configured === candidate)
      return true;
  }
  return false;
}

async function assertWrittenProjectEntry(
  config: ResolvedConfig,
  projectFile: string,
): Promise<void> {
  const [fs, path] = await Promise.all([
    import(/* @vite-ignore */ 'node:fs/promises'),
    import(/* @vite-ignore */ 'node:path'),
  ]);
  const outputFile = path.resolve(
    config.root,
    config.build.outDir,
    ...projectFile.split('/'),
  );
  if (await isRegularFile(fs, outputFile))
    return;
  throw missingProjectEntryError(projectFile);
}

function missingProjectEntryError(projectFile: string): Error {
  return new Error(
    `Wallpaper Engine project file "${projectFile}" was not emitted by Vite. Add it as an HTML build entry or publicDir asset.`,
  );
}

async function isRegularFile(
  fs: typeof NodeFsPromises,
  filePath: string,
): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isFile();
  }
  catch (error) {
    if (isFileNotFound(error))
      return false;
    throw error;
  }
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
  const result: Record<string, WallpaperPropertyDefinition> = Object.create(null) as Record<string, WallpaperPropertyDefinition>;
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
