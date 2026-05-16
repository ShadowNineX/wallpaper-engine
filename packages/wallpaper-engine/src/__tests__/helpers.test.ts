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
} from "../helpers";

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

  it("handles an empty path", () => {
    expect(toFileUrl("")).toBe("file:///");
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
});
