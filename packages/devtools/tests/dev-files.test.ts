import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createObjectURLMock
  = vi.fn<(object: Blob | MediaSource) => string>();
const revokeObjectURLMock = vi.fn<(url: string) => void>();

beforeEach(() => {
  vi.resetModules();
  let nextUrl = 0;
  createObjectURLMock
    .mockReset()
    .mockImplementation(() => `blob:local/${++nextUrl}`);
  revokeObjectURLMock.mockReset();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(object =>
    createObjectURLMock(object),
  );
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(url =>
    revokeObjectURLMock(url),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function installPicker(...selections: File[][]): void {
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
    this: HTMLInputElement,
  ) {
    Object.defineProperty(this, 'files', {
      configurable: true,
      value: selections.shift() ?? [],
    });
    this.dispatchEvent(new Event('change'));
  });
}

function directoryFile(
  contents: Uint8Array<ArrayBuffer>,
  name: string,
  relativePath: string,
  lastModified: number,
): File {
  const file = new File([contents], name, { lastModified });
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
  return file;
}

describe('browser development file picker', () => {
  it('cleans up the picker when the browser refuses to open it', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {
      throw new Error('Picker unavailable');
    });
    const { pickDevFile } = await import('../src/dev-files');

    await expect(pickDevFile('image')).rejects.toThrow('Picker unavailable');
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it.each(['file', 'directory'] as const)('cancels an open %s picker on disposal', async (kind) => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const { pickDevFile, pickDevDirectory, releaseDevFiles } = await import('../src/dev-files');
    const pending = kind === 'file' ? pickDevFile('image') : pickDevDirectory('image');
    expect(document.querySelector('input[type="file"]')).not.toBeNull();

    releaseDevFiles();
    await expect(pending).resolves.toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });

  it.each(['file', 'directory'] as const)('discards a resolved %s selection if disposal precedes its continuation', async (kind) => {
    installPicker([directoryFile(new Uint8Array([1]), 'cover.png', 'Gallery/cover.png', 10)]);
    const { pickDevFile, pickDevDirectory, releaseDevFiles } = await import('../src/dev-files');
    const pending = kind === 'file' ? pickDevFile('image') : pickDevDirectory('image');
    releaseDevFiles();

    await expect(pending).resolves.toBeNull();
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });

  it('replaces same-sized files when selecting a different directory', async () => {
    vi.useFakeTimers();
    installPicker(
      [directoryFile(new Uint8Array([1]), 'cover.png', 'First/cover.png', 10)],
      [directoryFile(new Uint8Array([2]), 'cover.png', 'Second/cover.png', 10)],
    );
    const { pickDevDirectory } = await import('../src/dev-files');
    const first = await pickDevDirectory('image');
    const second = await pickDevDirectory('image', first?.id);

    expect(second?.files[0]?.url).not.toBe(first?.files[0]?.url);
    expect(second?.files[0]?.path).toBe('Second/cover.png');
    vi.runAllTimers();
    expect(revokeObjectURLMock).toHaveBeenCalledWith(first?.files[0]?.url);
  });

  it('keeps a selected file local and exposes it through an object URL', async () => {
    const selected = new File([new Uint8Array([1, 2, 3])], 'cover.png', {
      type: 'image/png',
      lastModified: 123,
    });
    installPicker([selected]);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { pickDevFile } = await import('../src/dev-files');

    const result = await pickDevFile('image');

    expect(result).toMatchObject({
      name: 'cover.png',
      path: 'cover.png',
      relativePath: 'cover.png',
      url: 'blob:local/1',
      size: 3,
      mtimeMs: 123,
    });
    expect(createObjectURLMock).toHaveBeenCalledWith(selected);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('releases a selected file URL when it is no longer needed', async () => {
    installPicker([new File(['image'], 'cover.png')]);
    const { pickDevFile, releaseDevFile } = await import('../src/dev-files');
    const result = await pickDevFile('image');

    releaseDevFile(result?.url ?? '');
    releaseDevFile(result?.url ?? '');

    expect(revokeObjectURLMock).toHaveBeenCalledOnce();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:local/1');
  });

  it('keeps nested image paths and excludes video files from image directories', async () => {
    const image = directoryFile(
      new Uint8Array([1]),
      'cover.png',
      'Gallery/nested/cover.png',
      10,
    );
    const video = directoryFile(
      new Uint8Array([2]),
      'clip.webm',
      'Gallery/clip.webm',
      20,
    );
    installPicker([image, video]);
    const { pickDevDirectory } = await import('../src/dev-files');

    const result = await pickDevDirectory('image');

    expect(result).toMatchObject({
      path: 'Gallery',
      files: [
        {
          path: 'Gallery/nested/cover.png',
          relativePath: 'nested/cover.png',
          url: 'blob:local/1',
        },
      ],
    });
    expect(createObjectURLMock).toHaveBeenCalledOnce();
    expect(createObjectURLMock).toHaveBeenCalledWith(image);
  });

  it('preserves unchanged URLs and replaces changed URLs on refresh', async () => {
    vi.useFakeTimers();
    const initial = directoryFile(
      new Uint8Array([1]),
      'cover.png',
      'Gallery/cover.png',
      10,
    );
    const unchanged = directoryFile(
      new Uint8Array([1]),
      'cover.png',
      'Gallery/cover.png',
      10,
    );
    const changed = directoryFile(
      new Uint8Array([1, 2]),
      'cover.png',
      'Gallery/cover.png',
      20,
    );
    installPicker([initial], [unchanged], [changed]);
    const { pickDevDirectory, refreshDevDirectory } = await import(
      '../src/dev-files',
    );
    const first = await pickDevDirectory('image');
    if (!first)
      throw new Error('Expected the directory picker to resolve.');

    const second = await refreshDevDirectory(first.id, 'image');
    const third = await refreshDevDirectory(first.id, 'image');
    vi.runAllTimers();

    expect(second?.files[0]?.url).toBe('blob:local/1');
    expect(third?.files[0]?.url).toBe('blob:local/2');
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:local/1');
  });

  it('keeps the previous directory usable and rolls back new URLs when refresh allocation fails', async () => {
    vi.useFakeTimers();
    const initialCover = directoryFile(
      new Uint8Array([1]),
      'cover.png',
      'Gallery/cover.png',
      10,
    );
    const initialBackdrop = directoryFile(
      new Uint8Array([2]),
      'backdrop.png',
      'Gallery/backdrop.png',
      20,
    );
    const changedCover = directoryFile(
      new Uint8Array([3]),
      'cover.png',
      'Gallery/cover.png',
      30,
    );
    const changedBackdrop = directoryFile(
      new Uint8Array([4]),
      'backdrop.png',
      'Gallery/backdrop.png',
      40,
    );
    const retryCover = directoryFile(
      new Uint8Array([1]),
      'cover.png',
      'Gallery/cover.png',
      10,
    );
    const retryBackdrop = directoryFile(
      new Uint8Array([2]),
      'backdrop.png',
      'Gallery/backdrop.png',
      20,
    );
    installPicker(
      [initialCover, initialBackdrop],
      [changedCover, changedBackdrop],
      [retryCover, retryBackdrop],
    );
    createObjectURLMock.mockImplementationOnce(() => 'blob:local/1')
      .mockImplementationOnce(() => 'blob:local/2')
      .mockImplementationOnce(() => 'blob:local/3')
      .mockImplementationOnce(() => {
        throw new Error('Allocation failed');
      });
    const { pickDevDirectory, refreshDevDirectory } = await import(
      '../src/dev-files',
    );
    const initial = await pickDevDirectory('image');
    if (!initial)
      throw new Error('Expected the directory picker to resolve.');

    await expect(refreshDevDirectory(initial.id, 'image')).rejects.toThrow('Allocation failed');
    vi.runAllTimers();

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:local/3');
    expect(revokeObjectURLMock).not.toHaveBeenCalledWith('blob:local/1');
    expect(revokeObjectURLMock).not.toHaveBeenCalledWith('blob:local/2');

    const retry = await refreshDevDirectory(initial.id, 'image');

    expect(retry?.files.map(file => file.url)).toEqual(
      initial.files.map(file => file.url),
    );
    expect(createObjectURLMock).toHaveBeenCalledTimes(4);
  });

  it('returns an empty image directory when the folder has no matching media', async () => {
    const video = directoryFile(
      new Uint8Array([2]),
      'clip.webm',
      'Gallery/clip.webm',
      20,
    );
    installPicker([video]);
    const { pickDevDirectory } = await import('../src/dev-files');

    const result = await pickDevDirectory('image');

    expect(result).toMatchObject({ path: 'Gallery', files: [] });
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });
});
