import type {
  CueDeviceInfo,
  CueLedColor,
  CueLedPosition,
  WallpaperCuePlugin,
  WallpaperLedPlugin,
} from '../../wallpaper-engine/src/types/listeners';

export interface VirtualRgbColor {
  r: number;
  g: number;
  b: number;
}

export interface VirtualRgbFrame {
  encodedImageData: string;
  height: number;
  width: number;
}

/** Observable state for the simulator's one deterministic virtual keyboard. */
export const virtualRgbState: {
  colors: Record<number, VirtualRgbColor>;
  frame: VirtualRgbFrame | undefined;
} = {
  colors: {},
  frame: undefined,
};

const keyboardWidth = 80;
const keyboardHeight = 60;
const device: CueDeviceInfo = {
  type: 1,
  model: 'Wallpaper Engine Dev Keyboard',
  physicalLayout: 1,
  logicalLayout: 1,
  ledCount: 12,
  capsMask: 1,
};
const positions: CueLedPosition[] = [
  'Escape',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
].map((ledIdName, index) => ({
  ledId: index + 1,
  ledIdName,
  top: Math.floor(index / 4) * 20,
  left: index % 4 * 20,
  width: 18,
  height: 18,
}));

function copyColor(color: VirtualRgbColor): VirtualRgbColor {
  return { ...color };
}

function logCallbackError(operation: string, error: unknown): void {
  console.error(`[WE Dev] ${operation} callback threw`, error);
}

function invokeCallback<T>(operation: string, callback: (value: T) => void, value: T): void {
  try {
    callback(value);
  }
  catch (error) {
    logCallbackError(operation, error);
  }
}

function validDeviceIndex(index: number): void {
  if (!Number.isInteger(index) || index !== 0)
    throw new RangeError('The virtual RGB simulator has only device index 0.');
}

function selectedDevices(deviceIndexOrArray: number | number[]): number[] {
  const requested = typeof deviceIndexOrArray === 'number'
    ? [deviceIndexOrArray]
    : deviceIndexOrArray;
  if (!Array.isArray(requested))
    throw new TypeError('RGB device indices must be a number or array of numbers.');
  for (const index of requested)
    validDeviceIndex(index);
  return [...new Set(requested)];
}

function channel(value: number, name: string): number {
  if (!Number.isFinite(value))
    throw new TypeError(`RGB ${name} must be a finite number.`);
  return Math.round(Math.min(255, Math.max(0, value)));
}

function color(input: CueLedColor): VirtualRgbColor {
  if (!input || typeof input !== 'object')
    throw new TypeError('RGB color must be an object.');
  return {
    r: channel(input.r, 'red'),
    g: channel(input.g, 'green'),
    b: channel(input.b, 'blue'),
  };
}

function led(ledId: number): CueLedPosition {
  if (!Number.isInteger(ledId))
    throw new TypeError('RGB LED IDs must be integers.');
  const position = positions.find(candidate => candidate.ledId === ledId);
  if (!position)
    throw new RangeError(`Unknown virtual RGB LED ID: ${ledId}.`);
  return position;
}

function imageBytes(encodedImageData: string, width: number, height: number): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    throw new RangeError('RGB image dimensions must be positive integers.');
  if (typeof encodedImageData !== 'string')
    throw new TypeError('RGB image data must be a string of RGB bytes.');
  const expected = width * height * 3;
  if (!Number.isSafeInteger(expected) || encodedImageData.length !== expected)
    throw new RangeError(`RGB image data must contain exactly ${expected} bytes.`);
  const bytes = new Uint8Array(expected);
  for (let index = 0; index < expected; index += 1) {
    const value = encodedImageData.codePointAt(index) ?? Number.POSITIVE_INFINITY;
    if (value > 255)
      throw new RangeError('RGB image data must contain byte-sized characters.');
    bytes[index] = value;
  }
  return bytes;
}

function colorAt(bytes: Uint8Array, width: number, height: number, position: CueLedPosition): VirtualRgbColor {
  const x = Math.min(width - 1, Math.floor(((position.left + position.width / 2) / keyboardWidth) * width));
  const y = Math.min(height - 1, Math.floor(((position.top + position.height / 2) / keyboardHeight) * height));
  const offset = (y * width + x) * 3;
  return { r: bytes[offset]!, g: bytes[offset + 1]!, b: bytes[offset + 2]! };
}

/** Reset the virtual keyboard state when the host shim installs or tears down. */
export function resetVirtualRgbState(): void {
  virtualRgbState.frame = undefined;
  for (const key of Object.keys(virtualRgbState.colors))
    delete virtualRgbState.colors[Number(key)];
  for (const position of positions)
    virtualRgbState.colors[position.ledId] = { r: 0, g: 0, b: 0 };
}

function setAll(colorValue: VirtualRgbColor): void {
  for (const position of positions)
    virtualRgbState.colors[position.ledId] = copyColor(colorValue);
}

function setImage(encodedImageData: string, width: number, height: number): void {
  const bytes = imageBytes(encodedImageData, width, height);
  virtualRgbState.frame = { encodedImageData, width, height };
  for (const position of positions)
    virtualRgbState.colors[position.ledId] = colorAt(bytes, width, height, position);
}

/** Build the documented LED and iCUE APIs over the simulator's virtual keyboard. */
export function createVirtualRgbPlugins(): {
  cue: WallpaperCuePlugin;
  led: WallpaperLedPlugin;
} {
  resetVirtualRgbState();
  return {
    led: {
      setAllDevicesByImageData(encodedImageData, width, height) {
        setImage(encodedImageData, width, height);
      },
    },
    cue: {
      getProtocolDetails(callback) {
        invokeCallback('iCUE protocol details', callback, {
          sdkVersion: '0.0.0-dev',
          serverVersion: '0.0.0-dev',
          sdkProtocolVersion: 0,
          serverProtocolVersion: 0,
          breakingChanges: false,
        });
      },
      getDeviceCount(callback) {
        invokeCallback('iCUE device count', callback, 1);
      },
      getDeviceInfo(deviceIndex, callback) {
        validDeviceIndex(deviceIndex);
        invokeCallback('iCUE device info', callback, { ...device });
      },
      getLedPositionsByDeviceIndex(callback) {
        invokeCallback('iCUE LED positions', callback, positions.map(position => ({ ...position })));
      },
      setLedsColorsAsync(colors) {
        if (!Array.isArray(colors))
          throw new TypeError('RGB LED colors must be an array.');
        for (const entry of colors) {
          const position = led(entry.ledId);
          virtualRgbState.colors[position.ledId] = color(entry);
        }
      },
      setAllLedsColorsAsync(deviceIndexOrArray, colorValue) {
        if (selectedDevices(deviceIndexOrArray).length > 0)
          setAll(color(colorValue));
      },
      setLedColorsByImageData(deviceIndexOrArray, encodedImageData, width, height) {
        if (selectedDevices(deviceIndexOrArray).length > 0)
          setImage(encodedImageData, width, height);
      },
    },
  };
}
