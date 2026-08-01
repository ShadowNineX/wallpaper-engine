import type { WallpaperFileType } from "../../wallpaper-engine/src/types/project";
import {
  WALLPAPER_IMAGE_EXTENSIONS,
  WALLPAPER_VIDEO_EXTENSIONS,
  type DevDirectorySelection,
  type DevFileEntry,
} from "../../wallpaper-engine/src/types/dev-files";

const IMAGE_EXTENSION_SET = new Set<string>(WALLPAPER_IMAGE_EXTENSIONS);
const VIDEO_EXTENSION_SET = new Set<string>(WALLPAPER_VIDEO_EXTENSIONS);
const SUPPORTED_EXTENSION_SET = new Set<string>([
  ...WALLPAPER_IMAGE_EXTENSIONS,
  ...WALLPAPER_VIDEO_EXTENSIONS,
]);

interface PickedFile {
  file: File;
  relativePath: string;
}

interface BrowserSelection {
  name: string;
  files: PickedFile[];
}

const localUrls = new Set<string>();
const directoriesById = new Map<string, DevDirectorySelection>();

export const devFilePickerAvailable =
  typeof URL.createObjectURL === "function" &&
  typeof URL.revokeObjectURL === "function";

function extensionsFor(fileType?: WallpaperFileType): readonly string[] {
  if (fileType === "image") return WALLPAPER_IMAGE_EXTENSIONS;
  if (fileType === "video") return WALLPAPER_VIDEO_EXTENSIONS;
  return [...WALLPAPER_IMAGE_EXTENSIONS, ...WALLPAPER_VIDEO_EXTENSIONS];
}

function supportsFile(name: string, fileType?: WallpaperFileType): boolean {
  const dot = name.lastIndexOf(".");
  const extension = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  if (fileType === "image") return IMAGE_EXTENSION_SET.has(extension);
  if (fileType === "video") return VIDEO_EXTENSION_SET.has(extension);
  return SUPPORTED_EXTENSION_SET.has(extension);
}

function chooseInBrowser(
  kind: "file" | "directory",
  fileType?: WallpaperFileType,
): Promise<BrowserSelection | null> {
  return new Promise((resolveSelection) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "file" ? extensionsFor(fileType).join(",") : "";
    input.multiple = kind === "directory";
    input.style.display = "none";
    if (kind === "directory") input.webkitdirectory = true;
    document.body.append(input);

    let settled = false;
    const finish = (selection: BrowserSelection | null): void => {
      if (settled) return;
      settled = true;
      input.remove();
      resolveSelection(selection);
    };
    input.addEventListener("cancel", () => finish(null), { once: true });
    input.addEventListener(
      "change",
      () => {
        const chosen = [...(input.files ?? [])];
        const selected = chosen.filter((file) =>
          supportsFile(file.name, fileType),
        );
        if (chosen.length === 0) {
          finish(null);
          return;
        }
        if (kind === "file") {
          const file = selected[0];
          finish(
            file
              ? {
                  name: file.name,
                  files: [{ file, relativePath: file.name }],
                }
              : null,
          );
          return;
        }

        const firstPath = chosen[0]?.webkitRelativePath.replaceAll("\\", "/");
        const rootName = firstPath?.split("/")[0] || "Selected directory";
        const files = selected.map((file) => {
          const fullPath = file.webkitRelativePath.replaceAll("\\", "/");
          const prefix = `${rootName}/`;
          return {
            file,
            relativePath: fullPath.startsWith(prefix)
              ? fullPath.slice(prefix.length)
              : file.name,
          };
        });
        finish({ name: rootName, files });
      },
      { once: true },
    );
    input.click();
  });
}

function createLocalUrl(file: File): string {
  if (!devFilePickerAvailable) {
    throw new Error("This browser cannot expose selected local media.");
  }
  const url = URL.createObjectURL(file);
  localUrls.add(url);
  return url;
}

export function releaseDevFile(url: string): void {
  if (!localUrls.delete(url)) return;
  URL.revokeObjectURL(url);
}

function releaseAfterDelivery(url: string): void {
  if (!localUrls.has(url)) return;
  setTimeout(() => releaseDevFile(url), 0);
}

function createEntry(
  picked: PickedFile,
  rootName?: string,
  previous?: DevFileEntry,
): DevFileEntry {
  const unchanged =
    previous?.size === picked.file.size &&
    previous.mtimeMs === picked.file.lastModified;
  const path = rootName
    ? `${rootName}/${picked.relativePath}`
    : picked.file.name;
  if (unchanged) {
    return {
      ...previous,
      name: picked.file.name,
      path,
      relativePath: picked.relativePath,
    };
  }
  if (previous) releaseAfterDelivery(previous.url);
  return {
    id: previous?.id ?? crypto.randomUUID(),
    name: picked.file.name,
    path,
    relativePath: picked.relativePath,
    url: createLocalUrl(picked.file),
    size: picked.file.size,
    mtimeMs: picked.file.lastModified,
  };
}

export async function pickDevFile(
  fileType?: WallpaperFileType,
): Promise<DevFileEntry | null> {
  const selection = await chooseInBrowser("file", fileType);
  const picked = selection?.files[0];
  return picked ? createEntry(picked) : null;
}

export async function pickDevDirectory(
  fileType?: WallpaperFileType,
  directoryId?: string,
): Promise<DevDirectorySelection | null> {
  const picked = await chooseInBrowser("directory", fileType);
  if (!picked) return null;

  const id = directoryId ?? crypto.randomUUID();
  const previous = directoriesById.get(id);
  const previousByPath = new Map(
    previous?.files.map((file) => [file.relativePath, file]) ?? [],
  );
  const files = picked.files
    .map((file) =>
      createEntry(
        file,
        picked.name,
        previousByPath.get(file.relativePath),
      ),
    )
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const nextPaths = new Set(files.map((file) => file.relativePath));
  for (const file of previous?.files ?? []) {
    if (!nextPaths.has(file.relativePath)) releaseAfterDelivery(file.url);
  }

  const selection: DevDirectorySelection = {
    id,
    path: picked.name,
    files,
  };
  directoriesById.set(id, selection);
  return selection;
}

export function refreshDevDirectory(
  directoryId: string,
  fileType?: WallpaperFileType,
): Promise<DevDirectorySelection | null> {
  return pickDevDirectory(fileType, directoryId);
}

export function releaseDevDirectory(directoryId: string): void {
  const selection = directoriesById.get(directoryId);
  if (!selection) return;
  directoriesById.delete(directoryId);
  for (const file of selection.files) releaseDevFile(file.url);
}

window.addEventListener(
  "beforeunload",
  () => {
    for (const url of localUrls) URL.revokeObjectURL(url);
    localUrls.clear();
    directoriesById.clear();
  },
  { once: true },
);
