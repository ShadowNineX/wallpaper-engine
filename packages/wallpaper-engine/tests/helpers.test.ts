import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clampAudio,
  createFpsLimiter,
  encodeCanvasForLed,
  leftChannel,
  parseWallpaperColor,
  rightChannel,
  toFileUrl,
  wallpaperColorToHex,
  wallpaperColorToRgb,
} from "../src/helpers";

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

describe("parseWallpaperColor", () => {
  it("parses black", () => {
    expect(parseWallpaperColor("0 0 0")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("parses white", () => {
    expect(parseWallpaperColor("1 1 1")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("parses a mixed color", () => {
    const { r, g, b } = parseWallpaperColor("1 0.5 0");
    expect(r).toBe(255);
    expect(g).toBe(Math.ceil(0.5 * 255)); // 128
    expect(b).toBe(0);
  });

  it("defaults missing channels to 0", () => {
    expect(parseWallpaperColor("")).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("wallpaperColorToRgb", () => {
  it.each([
    ["1 0 0", "rgb(255,0,0)"],
    ["0 1 0", "rgb(0,255,0)"],
    ["0 0 1", "rgb(0,0,255)"],
    ["0 0 0", "rgb(0,0,0)"],
    ["1 1 1", "rgb(255,255,255)"],
  ])('converts "%s" → "%s"', (input, expected) => {
    expect(wallpaperColorToRgb(input)).toBe(expected);
  });
});

describe("wallpaperColorToHex", () => {
  it.each([
    ["1 0 0", "#ff0000"],
    ["0 1 0", "#00ff00"],
    ["0 0 1", "#0000ff"],
    ["0 0 0", "#000000"],
    ["1 1 1", "#ffffff"],
  ])('converts "%s" → "%s"', (input, expected) => {
    expect(wallpaperColorToHex(input)).toBe(expected);
  });

  it("pads single-digit hex values", () => {
    // 0.0392 * 255 ≈ 9.996 → ceil → 10 = '0a'
    expect(wallpaperColorToHex("0 0 0.0392")).toBe("#00000a");
  });
});

// ---------------------------------------------------------------------------
// File URL helper
// ---------------------------------------------------------------------------

describe("toFileUrl", () => {
  it("prepends file:///", () => {
    expect(toFileUrl("C:/images/photo.jpg")).toBe(
      "file:///C:/images/photo.jpg",
    );
  });

  it("preserves URLs that are already browser-loadable", () => {
    const urls = [
      "/assets/image.png",
      "https://example.com/image.png",
      "data:image/png;base64,AA==",
      "blob:https://example.com/id",
      "file:///C:/images/photo.jpg",
    ];
    for (const url of urls) expect(toFileUrl(url)).toBe(url);
  });

  it("keeps an empty path empty", () => {
    expect(toFileUrl("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Audio helpers
// ---------------------------------------------------------------------------

describe("clampAudio", () => {
  it("clamps values above 1 to 1", () => {
    expect(clampAudio([0, 0.5, 1, 1.2, 2])).toEqual([0, 0.5, 1, 1, 1]);
  });

  it("leaves values within range unchanged", () => {
    const audio = [0, 0.25, 0.5, 0.75, 1];
    expect(clampAudio(audio)).toEqual(audio);
  });

  it("returns a new array", () => {
    const original = [1.5];
    expect(clampAudio(original)).not.toBe(original);
  });
});

describe("leftChannel", () => {
  it("returns the first 64 elements", () => {
    const audio = Array.from({ length: 128 }, (_, i) => i);
    const result = leftChannel(audio);
    expect(result).toHaveLength(64);
    expect(result[0]).toBe(0);
    expect(result[63]).toBe(63);
  });
});

describe("rightChannel", () => {
  it("returns elements 64–127", () => {
    const audio = Array.from({ length: 128 }, (_, i) => i);
    const result = rightChannel(audio);
    expect(result).toHaveLength(64);
    expect(result[0]).toBe(64);
    expect(result[63]).toBe(127);
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
      type === "2d"
        ? { getImageData: () => ({ data: new Uint8ClampedArray(pixels) }) }
        : null,
  } as unknown as HTMLCanvasElement;
}

describe("encodeCanvasForLed", () => {
  it("encodes a single pixel as a 3-char RGB string", () => {
    const canvas = makeCanvas([255, 0, 128, 255]);
    expect(encodeCanvasForLed(canvas)).toBe(String.fromCodePoint(255, 0, 128));
  });

  it("strips the alpha channel", () => {
    const canvas = makeCanvas([100, 150, 200, 0]);
    expect(encodeCanvasForLed(canvas)).toBe(
      String.fromCodePoint(100, 150, 200),
    );
  });

  it("encodes multiple pixels in order", () => {
    const canvas = makeCanvas([255, 0, 0, 255, 0, 255, 0, 255]);
    expect(encodeCanvasForLed(canvas)).toBe(
      String.fromCodePoint(255, 0, 0, 0, 255, 0),
    );
  });

  it("throws when the 2D context is unavailable", () => {
    const canvas = {
      width: 1,
      height: 1,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    expect(() => encodeCanvasForLed(canvas)).toThrow(
      "Could not get 2D context from canvas",
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
  vi.stubGlobal("requestAnimationFrame", raf);
  vi.stubGlobal("cancelAnimationFrame", caf);
  vi.stubGlobal("performance", { now: () => 0 });
  return { raf, caf };
}

function createRafHarness(startTime = 0) {
  const callbacks: FrameRequestCallback[] = [];
  let now = startTime;
  let id = 0;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return ++id;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("performance", { now: () => now });

  return {
    step(timestamp: number): void {
      const callback = callbacks.shift();
      if (!callback) throw new Error("No animation frame was queued");
      now = timestamp;
      callback(timestamp);
    },
  };
}

const issue2Scenarios = [
  30, 60, 75, 90, 120, 144, 165, 240,
].flatMap((refreshRate) =>
  [1, 5, 10, 15, 24, 30, 45, 60, 90, 120].map((limit) => ({
    refreshRate,
    limit,
    seconds: 2,
  })),
);

describe("createFpsLimiter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns start / stop / setLimit methods", () => {
    stubRaf();
    const loop = createFpsLimiter(() => {});
    expect(typeof loop.start).toBe("function");
    expect(typeof loop.stop).toBe("function");
    expect(typeof loop.setLimit).toBe("function");
  });

  it("start() queues an animation frame", () => {
    const { raf } = stubRaf();
    const loop = createFpsLimiter(() => {});
    loop.start();
    expect(raf).toHaveBeenCalledTimes(1);
  });

  it("stop() cancels the pending frame", () => {
    const { raf, caf } = stubRaf();
    const loop = createFpsLimiter(() => {});
    loop.start();
    const pendingId = raf.mock.results[0]?.value;
    loop.stop();
    expect(caf).toHaveBeenCalledWith(pendingId);
  });

  it("stop() before start() does not call cancelAnimationFrame", () => {
    const { caf } = stubRaf();
    const loop = createFpsLimiter(() => {});
    loop.stop();
    expect(caf).not.toHaveBeenCalled();
  });

  it("calling start() twice cancels the first frame", () => {
    const { raf, caf } = stubRaf();
    const loop = createFpsLimiter(() => {});
    loop.start();
    const firstId = raf.mock.results[0]?.value;
    loop.start();
    expect(caf).toHaveBeenCalledWith(firstId);
  });

  it("setLimit() does not throw", () => {
    stubRaf();
    const loop = createFpsLimiter(() => {});
    expect(() => loop.setLimit(60)).not.toThrow();
    expect(() => loop.setLimit(0)).not.toThrow();
  });

  it("draws each requested frame when unlimited and caps long frame deltas", () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("performance", { now: () => 0 });
    const draw = vi.fn();
    const limiter = createFpsLimiter(draw);
    limiter.start();

    callbacks.shift()?.(16);
    callbacks.shift()?.(5_000);

    expect(draw).toHaveBeenNthCalledWith(1, 0.016);
    expect(draw).toHaveBeenNthCalledWith(2, 1);
  });

  it.each(issue2Scenarios)(
    "reports correct deltas at $limit FPS on a $refreshRate Hz display",
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
      } else {
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
    "reports actual draw intervals at $limit FPS with jittering RAF timestamps",
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
        if (increment === undefined) throw new Error("Missing jitter increment");
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

  it("caps dt after a long stall without producing catch-up draws", () => {
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

  it("preserves elapsed draw time when the limit changes at runtime", () => {
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

  it("does not reset accumulated time when the same limit is repeated", () => {
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

  it("skips frames below the configured threshold and reports all elapsed time", () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("performance", { now: () => 0 });
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
