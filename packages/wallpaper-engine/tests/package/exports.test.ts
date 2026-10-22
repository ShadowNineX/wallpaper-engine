import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function packArchive(packager: 'Bun' | 'npm', directory: string): string {
  const cwd = fileURLToPath(new URL('../../', import.meta.url));
  if (packager === 'Bun') {
    const archive = join(directory, 'bun.tgz');
    execFileSync('bun', ['pm', 'pack', '--ignore-scripts', '--quiet', '--filename', archive], { cwd });
    return archive;
  }
  // Invoke npm's JS CLI directly so Windows needs no shell or .cmd escaping.
  // This is a release-packer check, not a dependency install or script runner.
  const npm = execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', ['npm'], { encoding: 'utf8' }).split(/\r?\n/)[0]?.trim();
  if (!npm)
    throw new Error('The npm release packer is required for package verification.');
  const cli = process.platform === 'win32'
    ? join(dirname(npm), 'node_modules/npm/bin/npm-cli.js')
    : realpathSync(npm);
  const result = execFileSync(process.execPath, [cli, 'pack', '--json', '--ignore-scripts', '--offline', '--workspaces=false', '--no-update-notifier', '--pack-destination', directory, '--cache', join(directory, 'npm-cache')], { cwd, encoding: 'utf8' });
  const output = JSON.parse(result) as Array<{ filename: string }> | Record<string, { filename: string }>;
  const packed = Array.isArray(output) ? output[0] : Object.values(output)[0];
  if (!packed || typeof packed.filename !== 'string')
    throw new Error('npm did not produce a package archive.');
  return join(directory, packed.filename);
}

async function consumer(entry: 'wallpaper-engine/helpers' | 'wallpaper-engine/plugin', imported: string, expression: string) {
  const id = '\0package-consumer';
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [{
      name: 'package-consumer',
      resolveId(source) {
        if (source === id)
          return id;
        if (source === entry)
          return fileURLToPath(import.meta.resolve(entry));
      },
      load(source) {
        if (source === id)
          return `import { ${imported} } from '${entry}'; globalThis.result = ${expression};`;
      },
    }],
    build: {
      write: false,
      minify: false,
      rollupOptions: { input: id, output: { format: 'iife' } },
    },
  });
  const output = Array.isArray(result) ? result[0] : result;
  if (!output || !('output' in output))
    throw new Error('Expected an in-memory consumer build.');
  return output.output.filter(chunk => chunk.type === 'chunk').map(chunk => chunk.code).join('\n');
}

describe('published package consumers', () => {
  let archiveDirectory: string | undefined;
  const archives = { Bun: '', npm: '' };

  beforeAll(async () => {
    archiveDirectory = await mkdtemp(join(tmpdir(), 'wallpaper-engine-archives-'));
    archives.Bun = packArchive('Bun', archiveDirectory);
  });

  beforeAll(() => {
    if (!archiveDirectory)
      throw new Error('The archive fixture directory is unavailable.');
    archives.npm = packArchive('npm', archiveDirectory);
  });

  afterAll(async () => {
    if (archiveDirectory)
      await rm(archiveDirectory, { recursive: true, force: true });
  });

  it.each([
    ['DefaultWEProps', 'DefaultWEProps.wec_brs.value', 50],
    ['parseWallpaperColor', 'parseWallpaperColor("1 0.5 0")', { r: 255, g: 128, b: 0 }],
  ] as const)('tree shakes unused color and image libraries from %s', async (name, expression, expected) => {
    const code = await consumer('wallpaper-engine/helpers', name, expression);
    expect(code.match(/ColorSpace|FastAverageColor|getColorAsync/g) ?? []).toEqual([]);
    expect(code.length).toBeLessThan(4000);
    const context = { result: undefined };
    runInNewContext(code, context);
    expect(context.result).toEqual(expected);
  });

  it('keeps a boolean builder browser-safe without color initialization', async () => {
    const code = await consumer('wallpaper-engine/plugin', 'boolProperty', 'boolProperty({ text: "Enabled", value: true })');
    expect(code.match(/ColorSpace|FastAverageColor|node:|wallpaperEnginePlugin/g) ?? []).toEqual([]);
    expect(code.length).toBeLessThan(1000);
    const context = { result: undefined };
    runInNewContext(code, context);
    expect(context.result).toEqual({ type: 'bool', text: 'Enabled', value: true });
  });

  it('retains working color conversion when the color builder is used', async () => {
    const code = await consumer('wallpaper-engine/plugin', 'colorProperty', 'colorProperty({ text: "Accent", value: "hsl(120 100% 50%)" })');
    const context = { result: undefined };
    runInNewContext(code, context);
    expect(context.result).toEqual({ type: 'color', text: 'Accent', value: '0 1 0' });
  });

  it('retains image extraction only when requested', async () => {
    const code = await consumer('wallpaper-engine/helpers', 'createAverageColorExtractor', 'createAverageColorExtractor()');
    expect(code).toContain('getColorAsync');
    const context = { result: undefined as { getColorAsync: () => unknown; destroy: () => void } | undefined };
    runInNewContext(code, context);
    expect(context.result?.getColorAsync).toBeTypeOf('function');
    context.result?.destroy();
  });

  it('loads both public CommonJS entries without Vite or browser globals', () => {
    const require = createRequire(import.meta.url);
    expect(require('wallpaper-engine')).toEqual({});
    const helpers = require('wallpaper-engine/helpers');
    expect(helpers.parseWallpaperColor('0 1 0')).toEqual({ r: 0, g: 255, b: 0 });
    expect(helpers.colorToWallpaperColor('red')).toBe('1 0 0');
  });

  it('packs the same published files with Bun and npm', () => {
    const files = (archive: string) => execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(name => name && !name.endsWith('/'))
      .sort();
    expect(files(archives.npm)).toEqual(files(archives.Bun));
  });

  it.each(['Bun', 'npm'] as const)('runs ESM, CommonJS, and project generation from the %s archive without installed dependencies', async (packager) => {
    const directory = await mkdtemp(join(tmpdir(), 'wallpaper-engine-package-'));
    try {
      execFileSync('tar', ['-xzf', archives[packager], '-C', directory]);
      const packageRoot = join(directory, 'package');
      const require = createRequire(import.meta.url);
      for (const extension of ['mts', 'cts']) {
        await writeFile(join(packageRoot, `consumer.${extension}`), `
          import type { DefaultWEProps as Definitions, WallpaperPropertyListener, WallpaperPropertyListenerOf } from 'wallpaper-engine';
          import { DefaultWEProps, createAverageColorExtractor, parseWallpaperColor } from 'wallpaper-engine/helpers';
          const defaults: Required<Definitions> = DefaultWEProps;
          const props = { speed: { type: 'slider' as const, text: 'Speed', value: 1, min: 0, max: 2 } };
          const listener = {
            applyUserProperties(update) {
              if (update.speed) update.speed.value.toFixed();
              if (update.audioprocessing) update.audioprocessing.value.valueOf();
            },
          } satisfies WallpaperPropertyListenerOf<typeof props>;
          const extractor = createAverageColorExtractor();
          extractor.destroy();
          parseWallpaperColor(defaults.schemecolor.value);
          const raw: WallpaperPropertyListener = { applyUserProperties(values) {
            const property = values.separator;
            if (property) {
              // @ts-expect-error Native layout descriptors may lack a value.
              void property.value;
              if ('value' in property) String(property.value);
            }
          } };
          raw.applyUserProperties?.({ separator: { type: 'divider', order: 102 } });
          function hardware(host: Window) {
            host.wpPlugins?.led?.setAllDevicesByImageData('', 0, 0);
            host.cue?.getDeviceCount(count => count.toFixed());
            // @ts-expect-error Hardware APIs require a presence guard.
            host.cue.getDeviceCount(() => {});
          }
        `);
      }
      execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--strict', '--noEmit', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--target', 'es2022', '--lib', 'es2022,dom', 'consumer.mts', 'consumer.cts'], { cwd: packageRoot });
      const result = execFileSync(process.execPath, ['--input-type=module', '--eval', `
        import { createRequire } from 'node:module';
        import { DefaultWEProps, colorToWallpaperColor, createAverageColorExtractor, toFileUrl } from 'wallpaper-engine/helpers';
        import { boolProperty, wallpaperEnginePlugin } from 'wallpaper-engine/plugin';
        const require = createRequire(import.meta.url);
        const helpers = require('wallpaper-engine/helpers');
        const extractor = createAverageColorExtractor();
        extractor.destroy();
        const plugin = wallpaperEnginePlugin({ title: 'Packed wallpaper', properties: { enabled: boolProperty({ text: 'Enabled', value: true }) } });
        const assets = [];
        await plugin.generateBundle.call({ emitFile: asset => assets.push(asset) }, {}, {
          'index.html': { type: 'asset', fileName: 'index.html', source: '<html></html>' },
        }, false);
        const project = JSON.parse(assets.find(asset => asset.fileName === 'project.json').source);
        console.log(JSON.stringify({ color: colorToWallpaperColor('red'), cjsColor: helpers.colorToWallpaperColor('lime'), fileUrl: toFileUrl('C%3A/Images/native%20%23%20cover.jpg'), cjsFileUrl: helpers.toFileUrl('C:/Images/literal%20.jpg'), audioLabel: DefaultWEProps.audioprocessing.text, enabled: project.general.properties.enabled, title: project.title, root: require('wallpaper-engine') }));
      `], { cwd: join(directory, 'package'), encoding: 'utf8' });
      expect(JSON.parse(result)).toEqual({
        color: '1 0 0',
        cjsColor: '0 1 0',
        fileUrl: 'file:///C:/Images/native%20%23%20cover.jpg',
        cjsFileUrl: 'file:///C:/Images/literal%2520.jpg',
        audioLabel: 'ui_browse_properties_audio_recording',
        enabled: { type: 'bool', text: 'Enabled', value: true, order: 0, index: 0 },
        title: 'Packed wallpaper',
        root: {},
      });
    }
    finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
