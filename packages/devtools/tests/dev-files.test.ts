import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createObjectURLMock =
  vi.fn<(object: Blob | MediaSource) => string>();
const revokeObjectURLMock = vi.fn<(url: string) => void>();

beforeEach(() => {
  vi.resetModules();
  let nextUrl = 0;
  createObjectURLMock
    .mockReset()
    .mockImplementation(() => `blob:local/${++nextUrl}`);
  revokeObjectURLMock.mockReset();
  vi.spyOn(URL, "createObjectURL").mockImplementation((object) =>
    createObjectURLMock(object),
  );
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) =>
    revokeObjectURLMock(url),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function installPicker(...selections: File[][]): void {
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (
    this: HTMLInputElement,
  ) {
    Object.defineProperty(this, "files", {
      configurable: true,
      value: selections.shift() ?? [],
    });
    this.dispatchEvent(new Event("change"));
  });
}

function directoryFile(
  contents: Uint8Array<ArrayBuffer>,
  name: string,
  relativePath: string,
  lastModified: number,
): File {
  const file = new File([contents], name, { lastModified });
  Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
  return file;
}

describe("browser development file picker", () => {
  it("keeps a selected file local and exposes it through an object URL", async () => {
    const selected = new File([new Uint8Array([1, 2, 3])], "cover.png", {
      type: "image/png",
      lastModified: 123,
    });
    installPicker([selected]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { pickDevFile } = await import("../src/dev-files");

    const result = await pickDevFile("image");

    expect(result).toMatchObject({
      name: "cover.png",
      path: "cover.png",
      relativePath: "cover.png",
      url: "blob:local/1",
      size: 3,
      mtimeMs: 123,
    });
    expect(createObjectURLMock).toHaveBeenCalledWith(selected);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("releases a selected file URL when it is no longer needed", async () => {
    installPicker([new File(["image"], "cover.png")]);
    const { pickDevFile, releaseDevFile } = await import("../src/dev-files");
    const result = await pickDevFile("image");

    releaseDevFile(result?.url ?? "");
    releaseDevFile(result?.url ?? "");

    expect(revokeObjectURLMock).toHaveBeenCalledOnce();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:local/1");
  });

  it("keeps nested image paths and excludes video files from image directories", async () => {
    const image = directoryFile(
      new Uint8Array([1]),
      "cover.png",
      "Gallery/nested/cover.png",
      10,
    );
    const video = directoryFile(
      new Uint8Array([2]),
      "clip.webm",
      "Gallery/clip.webm",
      20,
    );
    installPicker([image, video]);
    const { pickDevDirectory } = await import("../src/dev-files");

    const result = await pickDevDirectory("image");

    expect(result).toMatchObject({
      path: "Gallery",
      files: [
        {
          path: "Gallery/nested/cover.png",
          relativePath: "nested/cover.png",
          url: "blob:local/1",
        },
      ],
    });
    expect(createObjectURLMock).toHaveBeenCalledOnce();
    expect(createObjectURLMock).toHaveBeenCalledWith(image);
  });

  it("preserves unchanged URLs and replaces changed URLs on refresh", async () => {
    vi.useFakeTimers();
    const initial = directoryFile(
      new Uint8Array([1]),
      "cover.png",
      "Gallery/cover.png",
      10,
    );
    const unchanged = directoryFile(
      new Uint8Array([1]),
      "cover.png",
      "Gallery/cover.png",
      10,
    );
    const changed = directoryFile(
      new Uint8Array([1, 2]),
      "cover.png",
      "Gallery/cover.png",
      20,
    );
    installPicker([initial], [unchanged], [changed]);
    const { pickDevDirectory, refreshDevDirectory } = await import(
      "../src/dev-files"
    );
    const first = await pickDevDirectory("image");
    if (!first) throw new Error("Expected the directory picker to resolve.");

    const second = await refreshDevDirectory(first.id, "image");
    const third = await refreshDevDirectory(first.id, "image");
    vi.runAllTimers();

    expect(second?.files[0]?.url).toBe("blob:local/1");
    expect(third?.files[0]?.url).toBe("blob:local/2");
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:local/1");
  });

  it("returns an empty image directory when the folder has no matching media", async () => {
    const video = directoryFile(
      new Uint8Array([2]),
      "clip.webm",
      "Gallery/clip.webm",
      20,
    );
    installPicker([video]);
    const { pickDevDirectory } = await import("../src/dev-files");

    const result = await pickDevDirectory("image");

    expect(result).toMatchObject({ path: "Gallery", files: [] });
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });
});
