import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

async function rgb() {
  return import('../src/rgb');
}

function rgbImage(width: number, height: number): string {
  return String.fromCharCode(...Array.from(
    { length: width * height * 3 },
    (_, index) => index,
  ));
}

describe('virtual RGB keyboard', () => {
  it('reports one deterministic keyboard and applies individual and whole-device colors', async () => {
    const { createVirtualRgbPlugins, virtualRgbState } = await rgb();
    const { cue } = createVirtualRgbPlugins();
    const count = vi.fn();
    const info = vi.fn();
    const positions = vi.fn();

    cue.getDeviceCount(count);
    cue.getDeviceInfo(0, info);
    cue.getLedPositionsByDeviceIndex(0, positions);
    cue.setLedsColorsAsync([{ ledId: 1, r: -5, g: 25.5, b: 999 }]);

    expect(count).toHaveBeenCalledWith(1);
    expect(info).toHaveBeenCalledWith(expect.objectContaining({
      model: 'Wallpaper Engine Dev Keyboard',
      ledCount: 12,
      capsMask: 1,
    }));
    expect(positions).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ ledId: 1, ledIdName: 'Escape', left: 0, top: 0 }),
      expect.objectContaining({ ledId: 12, ledIdName: 'F11', left: 60, top: 40 }),
    ]));
    expect(virtualRgbState.colors[1]).toEqual({ r: 0, g: 26, b: 255 });

    cue.setAllLedsColorsAsync([0], { ledId: 0, r: 3, g: 4, b: 5 });
    expect(Object.values(virtualRgbState.colors)).toEqual(
      Array.from({ length: 12 }, () => ({ r: 3, g: 4, b: 5 })),
    );
    expect(() => cue.getDeviceInfo(1, vi.fn())).toThrow(RangeError);
    expect(() => cue.getLedPositionsByDeviceIndex(1, vi.fn())).toThrow(RangeError);
    expect(() => cue.setLedsColorsAsync([{ ledId: 99, r: 0, g: 0, b: 0 }])).toThrow(RangeError);
  });

  it('maps validated RGB images across the virtual keyboard', async () => {
    const { createVirtualRgbPlugins, virtualRgbState } = await rgb();
    const { cue, led } = createVirtualRgbPlugins();
    const encoded = rgbImage(4, 3);

    led.setAllDevicesByImageData(encoded, 4, 3);
    expect(virtualRgbState.frame).toEqual({ encodedImageData: encoded, width: 4, height: 3 });
    expect(virtualRgbState.colors[1]).toEqual({ r: 0, g: 1, b: 2 });
    expect(virtualRgbState.colors[12]).toEqual({ r: 33, g: 34, b: 35 });

    cue.setLedColorsByImageData(0, encoded, 4, 3);
    expect(virtualRgbState.colors[6]).toEqual({ r: 15, g: 16, b: 17 });
    const smallest = rgbImage(2, 2);
    cue.setLedColorsByImageData(0, smallest, 2, 2);
    expect(virtualRgbState.frame).toEqual({ encodedImageData: smallest, width: 2, height: 2 });
    expect(virtualRgbState.colors[1]).toEqual({ r: 0, g: 1, b: 2 });
    expect(virtualRgbState.colors[12]).toEqual({ r: 9, g: 10, b: 11 });
    expect(() => led.setAllDevicesByImageData('bad', 2, 2)).toThrow(RangeError);
    expect(() => cue.setLedColorsByImageData([1], encoded, 4, 3)).toThrow(RangeError);
    expect(() => led.setAllDevicesByImageData(String.fromCharCode(256) + '\0'.repeat(11), 2, 2)).toThrow(RangeError);
  });

  it.each([[1, 1], [1, 2], [2, 1]])('rejects RGB frames smaller than the native minimum: %i by %i', async (width, height) => {
    const { createVirtualRgbPlugins, virtualRgbState } = await rgb();
    const { cue, led } = createVirtualRgbPlugins();
    const encoded = rgbImage(width, height);

    expect(() => led.setAllDevicesByImageData(encoded, width, height)).toThrow(RangeError);
    expect(() => cue.setLedColorsByImageData(0, encoded, width, height)).toThrow(RangeError);
    expect(virtualRgbState.frame).toBeUndefined();
    expect(Object.values(virtualRgbState.colors)).toEqual(
      Array.from({ length: 12 }, () => ({ r: 0, g: 0, b: 0 })),
    );
  });

  it('returns cloned LED positions for the requested virtual device', async () => {
    const { createVirtualRgbPlugins } = await rgb();
    const { cue } = createVirtualRgbPlugins();
    const first = vi.fn((leds) => {
      leds[0]!.left = 999;
    });
    const second = vi.fn();

    cue.getLedPositionsByDeviceIndex(0, first);
    cue.getLedPositionsByDeviceIndex(0, second);

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ ledId: 1, left: 0 }),
    ]));
  });

  it('contains callback failures and resets simulator state', async () => {
    const { createVirtualRgbPlugins, resetVirtualRgbState, virtualRgbState } = await rgb();
    const { cue } = createVirtualRgbPlugins();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const throwingCallback = () => {
      throw new Error('wallpaper callback');
    };
    expect(() => cue.getDeviceCount(throwingCallback)).not.toThrow();
    expect(() => cue.getLedPositionsByDeviceIndex(0, throwingCallback)).not.toThrow();
    cue.setLedsColorsAsync([{ ledId: 1, r: 1, g: 2, b: 3 }]);
    resetVirtualRgbState();

    expect(error).toHaveBeenCalledWith(
      '[WE Dev] iCUE device count callback threw',
      expect.any(Error),
    );
    expect(error).toHaveBeenCalledWith(
      '[WE Dev] iCUE LED positions callback threw',
      expect.any(Error),
    );
    expect(virtualRgbState.frame).toBeUndefined();
    expect(virtualRgbState.colors[1]).toEqual({ r: 0, g: 0, b: 0 });
  });
});
