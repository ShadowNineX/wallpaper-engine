import type { AverageColorOptions, AverageColorResult, AverageColorSource } from '../src/helpers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {

  clampAudio,
  colorToWallpaperColor,
  createAverageColorExtractor,
  createFpsLimiter,
  encodeCanvasForLed,
  getAverageColor,
  getMediaPlaybackStatus,
  leftChannel,
  parseWallpaperColor,
  rightChannel,
  toFileUrl,
  wallpaperColorToHex,
  wallpaperColorToRgb,
} from '../src/helpers';

const fastAverageColorMocks = vi.hoisted(() => ({
  getColor: vi.fn(),
  getColorAsync: vi.fn(),
  getColorFromArray4: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('fast-average-color', () => ({
  FastAverageColor: class {
    getColor(source: unknown, options?: unknown) {
      return fastAverageColorMocks.getColor(source, options);
    }

    getColorAsync(source: unknown, options?: unknown) {
      return fastAverageColorMocks.getColorAsync(source, options);
    }

    getColorFromArray4(pixels: unknown, options?: unknown) {
      return fastAverageColorMocks.getColorFromArray4(pixels, options);
    }

    destroy() {
      fastAverageColorMocks.destroy();
    }
  },
}));

const averageColorResult: AverageColorResult = {
  rgb: 'rgb(10,20,30)',
  rgba: 'rgba(10,20,30,1)',
  hex: '#0a141e',
  hexa: '#0a141eff',
  value: [10, 20, 30, 255],
  isDark: true,
  isLight: false,
};

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

describe('colorToWallpaperColor', () => {
  it.each([
    ['#ff8000', '1 0.501961 0'],
    ['rgb(0 0 255 / 25%)', '0 0 1'],
    ['hsl(120 100% 50%)', '0 1 0'],
    ['hwb(180 0% 0%)', '0 1 1'],
    ['rebeccapurple', '0.4 0.2 0.6'],
    ['transparent', '0 0 0'],
  ])('converts "%s" to "%s"', (input, expected) => {
    expect(colorToWallpaperColor(input)).toBe(expected);
  });

  it.each(['#000000', '#808080', '#ff8000', '#ffffff'])(
    'round-trips the 8-bit color %s',
    (input) => {
      expect(wallpaperColorToHex(colorToWallpaperColor(input))).toBe(input);
    },
  );

  it('preserves and normalizes Wallpaper Engine color strings', () => {
    expect(colorToWallpaperColor(' 1.0   5e-1 +0 ')).toBe('1 0.5 0');
  });

  it.each([
    'color(display-p3 0 1 0)',
    'oklch(70% 0.2 40)',
    'lab(60% 40 30)',
  ])('maps %s into the sRGB gamut', (input) => {
    const channels = colorToWallpaperColor(input).split(' ').map(Number);
    expect(channels).toHaveLength(3);
    expect(channels.every(channel => channel >= 0 && channel <= 1)).toBe(
      true,
    );
  });

  it('rejects invalid and out-of-range native colors', () => {
    expect(() => colorToWallpaperColor('not a color')).toThrow();
    expect(() => colorToWallpaperColor('2 0 0')).toThrow(RangeError);
  });
});

describe('parseWallpaperColor', () => {
  it('parses black', () => {
    expect(parseWallpaperColor('0 0 0')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('parses white', () => {
    expect(parseWallpaperColor('1 1 1')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('parses a mixed color', () => {
    const { r, g, b } = parseWallpaperColor('1 0.5 0');
    expect(r).toBe(255);
    expect(g).toBe(Math.round(0.5 * 255)); // 128
    expect(b).toBe(0);
  });

  it('normalizes whitespace, rounds channels, and clamps their range', () => {
    expect(parseWallpaperColor(' 0.501961\t2  -1 ')).toEqual({
      r: 128,
      g: 255,
      b: 0,
    });
  });

  it.each(['', '0 1', '0 1 2 3', '0 nope 1', '0 Infinity 1'])(
    'rejects malformed color "%s"',
    (value) => {
      expect(() => parseWallpaperColor(value)).toThrow(TypeError);
    },
  );
});

describe('wallpaperColorToRgb', () => {
  it.each([
    ['1 0 0', 'rgb(255,0,0)'],
    ['0 1 0', 'rgb(0,255,0)'],
    ['0 0 1', 'rgb(0,0,255)'],
    ['0 0 0', 'rgb(0,0,0)'],
    ['1 1 1', 'rgb(255,255,255)'],
  ])('converts "%s" → "%s"', (input, expected) => {
    expect(wallpaperColorToRgb(input)).toBe(expected);
  });
});

describe('wallpaperColorToHex', () => {
  it.each([
    ['1 0 0', '#ff0000'],
    ['0 1 0', '#00ff00'],
    ['0 0 1', '#0000ff'],
    ['0 0 0', '#000000'],
    ['1 1 1', '#ffffff'],
  ])('converts "%s" → "%s"', (input, expected) => {
    expect(wallpaperColorToHex(input)).toBe(expected);
  });

  it('pads single-digit hex values', () => {
    // 0.0392 * 255 ≈ 9.996 → ceil → 10 = '0a'
    expect(wallpaperColorToHex('0 0 0.0392')).toBe('#00000a');
  });
});

describe('average color extraction', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the complete FastAverageColor option set unchanged', async () => {
    const options = {
      defaultColor: [1, 2, 3, 255],
      ignoredColor: [
        [255, 255, 255],
        [0, 0, 0, 0],
        [128, 128, 128, 255, 12],
      ],
      mode: 'precision',
      algorithm: 'dominant',
      step: 2,
      left: 3,
      top: 4,
      width: 50,
      height: 60,
      silent: true,
      crossOrigin: 'anonymous',
      dominantDivider: 16,
    } satisfies AverageColorOptions;
    fastAverageColorMocks.getColorAsync.mockResolvedValueOnce(
      averageColorResult,
    );

    await expect(getAverageColor('https://example.com/art.jpg', options)).resolves.toBe(
      averageColorResult,
    );

    expect(fastAverageColorMocks.getColorAsync).toHaveBeenCalledWith(
      'https://example.com/art.jpg',
      options,
    );
    expect(fastAverageColorMocks.destroy).toHaveBeenCalledOnce();
  });

  it('accepts every image and media source supported by FastAverageColor', async () => {
    const sources = [
      'data:image/png;base64,AA==',
      {} as HTMLImageElement,
      {} as HTMLVideoElement,
      {} as HTMLCanvasElement,
      {} as OffscreenCanvas,
      {} as ImageBitmap,
      {} as VideoFrame,
    ] satisfies AverageColorSource[];
    fastAverageColorMocks.getColorAsync.mockResolvedValue(averageColorResult);

    for (const source of sources) {
      await getAverageColor(source);
    }

    expect(
      fastAverageColorMocks.getColorAsync.mock.calls.map(([source]) => source),
    ).toEqual(sources);
    expect(fastAverageColorMocks.destroy).toHaveBeenCalledTimes(sources.length);
  });

  it('exposes reusable sync, async, and raw-pixel extraction', async () => {
    const extractor = createAverageColorExtractor();
    const canvas = {} as HTMLCanvasElement;
    const pixels = new Uint8ClampedArray([10, 20, 30, 255]);
    fastAverageColorMocks.getColor.mockReturnValueOnce(averageColorResult);
    fastAverageColorMocks.getColorAsync.mockResolvedValueOnce(
      averageColorResult,
    );
    fastAverageColorMocks.getColorFromArray4.mockReturnValueOnce(
      averageColorResult.value,
    );

    expect(extractor.getColor(canvas, { algorithm: 'simple' })).toBe(
      averageColorResult,
    );
    await expect(
      extractor.getColorAsync(canvas, { mode: 'speed' }),
    ).resolves.toBe(averageColorResult);
    expect(
      extractor.getColorFromArray4(pixels, { algorithm: 'sqrt' }),
    ).toBe(averageColorResult.value);
    extractor.destroy();

    expect(fastAverageColorMocks.getColor).toHaveBeenCalledWith(canvas, {
      algorithm: 'simple',
    });
    expect(fastAverageColorMocks.getColorAsync).toHaveBeenCalledWith(canvas, {
      mode: 'speed',
    });
    expect(fastAverageColorMocks.getColorFromArray4).toHaveBeenCalledWith(
      pixels,
      { algorithm: 'sqrt' },
    );
    expect(fastAverageColorMocks.destroy).toHaveBeenCalledOnce();
  });

  it('destroys its one-shot extractor when extraction rejects', async () => {
    const failure = new Error('image failed');
    fastAverageColorMocks.getColorAsync.mockRejectedValueOnce(failure);

    await expect(getAverageColor('broken.jpg')).rejects.toBe(failure);
    expect(fastAverageColorMocks.destroy).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// File URL helper
// ---------------------------------------------------------------------------

describe('toFileUrl', () => {
  it('prepends file:///', () => {
    expect(toFileUrl('C:/images/photo.jpg')).toBe(
      'file:///C:/images/photo.jpg',
    );
  });

  it('preserves URLs that are already browser-loadable', () => {
    const urls = [
      '/assets/image.png',
      'https://example.com/image.png',
      'data:image/png;base64,AA==',
      'blob:https://example.com/id',
      'file:///C:/images/photo.jpg',
    ];
    for (const url of urls) expect(toFileUrl(url)).toBe(url);
  });

  it('keeps an empty path empty', () => {
    expect(toFileUrl('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Audio helpers
// ---------------------------------------------------------------------------

describe('clampAudio', () => {
  it('clamps values above 1 to 1', () => {
    expect(clampAudio([0, 0.5, 1, 1.2, 2])).toEqual([0, 0.5, 1, 1, 1]);
  });

  it('clamps negatives and replaces non-finite samples with zero', () => {
    expect(clampAudio([-1, -0.1, Number.NaN, Number.POSITIVE_INFINITY])).toEqual(
      [0, 0, 0, 0],
    );
  });

  it('leaves values within range unchanged', () => {
    const audio = [0, 0.25, 0.5, 0.75, 1];
    expect(clampAudio(audio)).toEqual(audio);
  });

  it('returns a new array', () => {
    const original = [1.5];
    expect(clampAudio(original)).not.toBe(original);
  });
});

describe('leftChannel', () => {
  it('returns the first 64 elements', () => {
    const audio = Array.from({ length: 128 }, (_, i) => i);
    const result = leftChannel(audio);
    expect(result).toHaveLength(64);
    expect(result[0]).toBe(0);
    expect(result[63]).toBe(63);
  });
});

describe('rightChannel', () => {
  it('returns elements 64–127', () => {
    const audio = Array.from({ length: 128 }, (_, i) => i);
    const result = rightChannel(audio);
    expect(result).toHaveLength(64);
    expect(result[0]).toBe(64);
    expect(result[63]).toBe(127);
  });
});

// ---------------------------------------------------------------------------
// Media helpers
// ---------------------------------------------------------------------------

describe('getMediaPlaybackStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the playback values supplied by the Wallpaper Engine host', () => {
    vi.stubGlobal('wallpaperMediaIntegration', {
      PLAYBACK_STOPPED: 0,
      PLAYBACK_PLAYING: 1,
      PLAYBACK_PAUSED: 2,
    });

    expect(getMediaPlaybackStatus(1)).toBe('playing');
    expect(getMediaPlaybackStatus(2)).toBe('paused');
    expect(getMediaPlaybackStatus(0)).toBe('stopped');
  });
});

// ---------------------------------------------------------------------------
// Canvas / LED encoding
// ---------------------------------------------------------------------------

function makeCanvas(pixels: number[]): HTMLCanvasElement {
  return {
    width: pixels.length / 4,
    height: 1,
    getContext: (type: string) =>
      type === '2d'
        ? { getImageData: () => ({ data: new Uint8ClampedArray(pixels) }) }
        : null,
  } as unknown as HTMLCanvasElement;
}

describe('encodeCanvasForLed', () => {
  it('encodes a single pixel as a 3-char RGB string', () => {
    const canvas = makeCanvas([255, 0, 128, 255]);
    expect(encodeCanvasForLed(canvas)).toBe(String.fromCharCode(255, 0, 128));
  });

  it('strips the alpha channel', () => {
    const canvas = makeCanvas([100, 150, 200, 0]);
    expect(encodeCanvasForLed(canvas)).toBe(
      String.fromCharCode(100, 150, 200),
    );
  });

  it('encodes multiple pixels in order', () => {
    const canvas = makeCanvas([255, 0, 0, 255, 0, 255, 0, 255]);
    expect(encodeCanvasForLed(canvas)).toBe(
      String.fromCharCode(255, 0, 0, 0, 255, 0),
    );
  });

  it('throws when the 2D context is unavailable', () => {
    const canvas = {
      width: 1,
      height: 1,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    expect(() => encodeCanvasForLed(canvas)).toThrow(
      'Could not get 2D context from canvas',
    );
  });
});

// ---------------------------------------------------------------------------
// FPS limiter
// ---------------------------------------------------------------------------

function stubRaf() {
  let id = 0;
  const raf = vi.fn(() => ++id);
  const caf = vi.fn();
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', caf);
  vi.stubGlobal('performance', { now: () => 0 });
  return { raf, caf };
}

function createRafHarness(startTime = 0) {
  const callbacks: FrameRequestCallback[] = [];
  let now = startTime;
  let id = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return ++id;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('performance', { now: () => now });

  return {
    step(timestamp: number): void {
      const callback = callbacks.shift();
      if (!callback)
        throw new Error('No animation frame was queued');
      now = timestamp;
      callback(timestamp);
    },
  };
}

const issue2Scenarios = [
  30,
  60,
  75,
  90,
  120,
  144,
  165,
  240,
].flatMap(refreshRate =>
  [1, 5, 10, 15, 24, 30, 45, 60, 90, 120].map(limit => ({
    refreshRate,
    limit,
    seconds: 2,
  })),
);

describe('createFpsLimiter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns start / stop / setLimit methods', () => {
    stubRaf();
    const loop = createFpsLimiter(() => {});
    expect(typeof loop.start).toBe('function');
    expect(typeof loop.stop).toBe('function');
    expect(typeof loop.setLimit).toBe('function');
  });

  it('start() queues an animation frame', () => {
    const { raf } = stubRaf();
    const loop = createFpsLimiter(() => {});
    loop.start();
    expect(raf).toHaveBeenCalledTimes(1);
  });

  it('stop() cancels the pending frame', () => {
    const { raf, caf } = stubRaf();
    const loop = createFpsLimiter(() => {});
    loop.start();
    const pendingId = raf.mock.results[0]?.value;
    loop.stop();
    expect(caf).toHaveBeenCalledWith(pendingId);
  });

  it('stop() before start() does not call cancelAnimationFrame', () => {
    const { caf } = stubRaf();
    const loop = createFpsLimiter(() => {});
    loop.stop();
    expect(caf).not.toHaveBeenCalled();
  });

  it('calling start() twice cancels the first frame', () => {
    const { raf, caf } = stubRaf();
    const loop = createFpsLimiter(() => {});
    loop.start();
    const firstId = raf.mock.results[0]?.value;
    loop.start();
    expect(caf).toHaveBeenCalledWith(firstId);
  });

  it('setLimit() does not throw', () => {
    stubRaf();
    const loop = createFpsLimiter(() => {});
    expect(() => loop.setLimit(60)).not.toThrow();
    expect(() => loop.setLimit(0)).not.toThrow();
  });

  it('draws each requested frame when unlimited and caps long frame deltas', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('performance', { now: () => 0 });
    const draw = vi.fn();
    const limiter = createFpsLimiter(draw);
    limiter.start();

    callbacks.shift()?.(16);
    callbacks.shift()?.(5_000);

    expect(draw).toHaveBeenNthCalledWith(1, 0.016);
    expect(draw).toHaveBeenNthCalledWith(2, 1);
  });

  it.each(issue2Scenarios)(
    'reports correct deltas at $limit FPS on a $refreshRate Hz display',
    ({ refreshRate, limit, seconds }) => {
      const harness = createRafHarness();
      const draw = vi.fn();
      const limiter = createFpsLimiter(draw);
      limiter.setLimit(limit);
      limiter.start();

      for (let frame = 1; frame <= refreshRate * seconds; frame++) {
        harness.step((frame * 1_000) / refreshRate);
      }

      const deltas = draw.mock.calls.map(([dt]) => dt as number);
      const effectiveRate = Math.min(refreshRate, limit);
      expect(deltas).toHaveLength(effectiveRate * seconds);
      expect(deltas.reduce((sum, dt) => sum + dt, 0)).toBeCloseTo(
        seconds,
        10,
      );

      if (limit >= refreshRate || refreshRate % limit === 0) {
        for (const dt of deltas) {
          expect(dt).toBeCloseTo(1 / effectiveRate, 10);
        }
      }
      else {
        const framesPerDraw = refreshRate / limit;
        const minimumDt = Math.floor(framesPerDraw) / refreshRate;
        const maximumDt = Math.ceil(framesPerDraw) / refreshRate;
        for (const dt of deltas) {
          expect(dt).toBeGreaterThanOrEqual(minimumDt - 1e-10);
          expect(dt).toBeLessThanOrEqual(maximumDt + 1e-10);
        }
      }
    },
  );

  it.each([{ limit: 5 }, { limit: 30 }])(
    'reports actual draw intervals at $limit FPS with jittering RAF timestamps',
    ({ limit }) => {
      const startTime = 5_000;
      const harness = createRafHarness(startTime);
      const records: Array<{ timestamp: number; dt: number }> = [];
      let timestamp = startTime;
      const limiter = createFpsLimiter((dt) => {
        records.push({ timestamp, dt });
      });
      limiter.setLimit(limit);
      limiter.start();

      const jitterPattern = [15.4, 17.9, 16.1, 16.8, 17.2, 15.9];
      for (let frame = 0; frame < 300; frame++) {
        const increment = jitterPattern[frame % jitterPattern.length];
        if (increment === undefined)
          throw new Error('Missing jitter increment');
        timestamp += increment;
        harness.step(timestamp);
      }

      const elapsed = (timestamp - startTime) / 1_000;
      expect(records).toHaveLength(Math.floor(elapsed * limit));

      let previousTimestamp = startTime;
      for (const record of records) {
        expect(record.dt).toBeCloseTo(
          (record.timestamp - previousTimestamp) / 1_000,
          10,
        );
        previousTimestamp = record.timestamp;
      }
    },
  );

  it('caps dt after a long stall without producing catch-up draws', () => {
    const harness = createRafHarness();
    const draw = vi.fn();
    const limiter = createFpsLimiter(draw);
    limiter.setLimit(5);
    limiter.start();

    harness.step(100);
    expect(draw).not.toHaveBeenCalled();
    harness.step(200);
    expect(draw.mock.calls[0]?.[0]).toBeCloseTo(0.2, 10);

    harness.step(5_000);
    expect(draw).toHaveBeenNthCalledWith(2, 1);
    harness.step(5_016);
    expect(draw).toHaveBeenCalledTimes(2);
    harness.step(5_200);
    expect(draw.mock.calls[2]?.[0]).toBeCloseTo(0.2, 10);
  });

  it('preserves elapsed draw time when the limit changes at runtime', () => {
    const harness = createRafHarness();
    const draw = vi.fn();
    const limiter = createFpsLimiter(draw);
    limiter.setLimit(30);
    limiter.start();

    harness.step(1_000 / 60);
    harness.step(2_000 / 60);
    expect(draw.mock.calls[0]?.[0]).toBeCloseTo(1 / 30, 10);

    limiter.setLimit(5);
    for (let frame = 3; frame <= 14; frame++) {
      harness.step((frame * 1_000) / 60);
    }
    expect(draw.mock.calls[1]?.[0]).toBeCloseTo(1 / 5, 10);

    limiter.setLimit(0);
    harness.step(15_000 / 60);
    expect(draw.mock.calls[2]?.[0]).toBeCloseTo(1 / 60, 10);
  });

  it('does not reset accumulated time when the same limit is repeated', () => {
    const harness = createRafHarness();
    const draw = vi.fn();
    const limiter = createFpsLimiter(draw);
    limiter.setLimit(5);
    limiter.start();

    for (let frame = 1; frame <= 6; frame++) {
      harness.step((frame * 1_000) / 60);
    }
    limiter.setLimit(5);
    for (let frame = 7; frame <= 12; frame++) {
      harness.step((frame * 1_000) / 60);
    }

    expect(draw).toHaveBeenCalledOnce();
    expect(draw.mock.calls[0]?.[0]).toBeCloseTo(1 / 5, 10);
  });

  it('skips frames below the configured threshold and reports all elapsed time', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('performance', { now: () => 0 });
    const draw = vi.fn();
    const limiter = createFpsLimiter(draw);
    limiter.setLimit(10);
    limiter.start();

    callbacks.shift()?.(50);
    expect(draw).not.toHaveBeenCalled();
    callbacks.shift()?.(110);

    expect(draw).toHaveBeenCalledOnce();
    expect(draw).toHaveBeenCalledWith(0.11);
  });
});
