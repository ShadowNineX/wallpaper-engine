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
    cue.getLedPositionsByDeviceIndex(positions);
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
    expect(() => led.setAllDevicesByImageData('bad', 2, 2)).toThrow(RangeError);
    expect(() => cue.setLedColorsByImageData([1], encoded, 4, 3)).toThrow(RangeError);
    expect(() => led.setAllDevicesByImageData(String.fromCharCode(256, 0, 0), 1, 1)).toThrow(RangeError);
  });

  it('contains callback failures and resets simulator state', async () => {
    const { createVirtualRgbPlugins, resetVirtualRgbState, virtualRgbState } = await rgb();
    const { cue } = createVirtualRgbPlugins();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const throwingCallback = () => {
      throw new Error('wallpaper callback');
    };
    expect(() => cue.getDeviceCount(throwingCallback)).not.toThrow();
    cue.setLedsColorsAsync([{ ledId: 1, r: 1, g: 2, b: 3 }]);
    resetVirtualRgbState();

    expect(error).toHaveBeenCalledWith(
      '[WE Dev] iCUE device count callback threw',
      expect.any(Error),
    );
    expect(virtualRgbState.frame).toBeUndefined();
    expect(virtualRgbState.colors[1]).toEqual({ r: 0, g: 0, b: 0 });
  });
});
