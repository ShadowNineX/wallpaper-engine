<script setup lang="ts">
import { computed, ref } from "vue";
import Plus from "~icons/ph/plus";
import RefreshCw from "~icons/ph/arrows-clockwise";
import Shuffle from "~icons/ph/shuffle";
import Trash2 from "~icons/ph/trash";
import type { WallpaperDirectoryProperty } from "../../../wallpaper-engine/src/types/project";
import { toast } from "vue-sonner";
import { propDefs, tr } from "../config";
import { listenerFns, useDevtoolsStore } from "../store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const store = useDevtoolsStore();
const directories = computed<Array<[string, WallpaperDirectoryProperty]>>(() =>
  Object.entries(propDefs).filter(
    (entry): entry is [string, WallpaperDirectoryProperty] =>
      entry[1].type === "directory",
  ),
);
const selected = ref(directories.value[0]?.[0] ?? "");
const newFile = ref("");
const selectedDefinition = computed(
  () => directories.value.find(([key]) => key === selected.value)?.[1],
);
const files = computed(() => store.directoryFiles[selected.value] ?? []);

function notifyChanged(key: string, paths: string[]): boolean {
  const listener = listenerFns.property?.userDirectoryFilesAddedOrChanged;
  if (!listener) return false;
  listener(key, paths);
  return true;
}

function notifyRemoved(key: string, paths: string[]): boolean {
  const listener = listenerFns.property?.userDirectoryFilesRemoved;
  if (!listener) return false;
  listener(key, paths);
  return true;
}

function addFile(): void {
  const key = selected.value;
  const path = newFile.value.trim();
  const definition = selectedDefinition.value;
  if (!key || !path || !definition) return;

  const list = store.directoryFiles[key] ?? [];
  if (list.includes(path)) {
    toast("That file is already in the simulated directory.");
    return;
  }
  list.push(path);
  store.directoryFiles[key] = list;
  newFile.value = "";

  if (definition.mode === "fetchall") {
    const delivered = notifyChanged(key, [path]);
    toast(
      delivered
        ? "File added and change callback sent."
        : "File added; no directory change listener is registered.",
    );
  } else {
    toast("File added to the on-demand random pool.");
  }
}

function removeFile(path: string): void {
  const key = selected.value;
  const definition = selectedDefinition.value;
  if (!key || !definition) return;
  const list = store.directoryFiles[key] ?? [];
  const index = list.indexOf(path);
  if (index >= 0) list.splice(index, 1);

  if (definition.mode === "fetchall") {
    const delivered = notifyRemoved(key, [path]);
    toast(
      delivered
        ? "File removed and removal callback sent."
        : "File removed; no directory removal listener is registered.",
    );
  } else {
    toast("File removed from the on-demand random pool.");
  }
}

function resendChanged(path: string): void {
  if (!notifyChanged(selected.value, [path])) {
    toast("No userDirectoryFilesAddedOrChanged listener registered.");
    return;
  }
  toast("File change callback sent.");
}

function requestRandom(): void {
  if (files.value.length === 0) {
    toast("Add at least one file to the random pool first.");
    return;
  }
  window.wallpaperRequestRandomFileForProperty(selected.value, (_key, path) => {
    toast(`Random file: ${path}`);
  });
}
</script>

<template>
  <div
    v-if="directories.length === 0"
    class="rounded-lg border border-dashed border-we-border p-5 text-center text-[11px] text-we-faint"
  >
    No directory properties are configured for this wallpaper.
  </div>

  <div v-else class="space-y-3">
    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">Directory property</h2>
          <p class="we-card-description">Choose which configured directory to simulate.</p>
        </div>
        <span
          v-if="selectedDefinition"
          class="rounded-full border border-we-border bg-we-panel px-2 py-1 font-mono text-[10px] text-we-muted"
        >
          {{ selectedDefinition.mode }}
        </span>
      </div>
      <NativeSelect id="directory-property" v-model="selected" class="h-8 w-full text-xs">
        <NativeSelectOption
          v-for="[key, definition] in directories"
          :key="key"
          :value="key"
        >
          {{ tr(definition.text || key) }} · {{ definition.mode }}
        </NativeSelectOption>
      </NativeSelect>

      <div
        v-if="selectedDefinition"
        class="mt-3 rounded-md border border-we-border bg-we-panel/60 px-3 py-2 text-[10px] leading-relaxed text-we-faint"
      >
        <template v-if="selectedDefinition.mode === 'ondemand'">
          Wallpaper Engine returns one random path when the wallpaper calls
          <code class="text-we-muted">wallpaperRequestRandomFileForProperty</code>.
        </template>
        <template v-else>
          Wallpaper Engine pushes add/change and removal callbacks as directory contents change.
        </template>
      </div>
    </section>

    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">Simulated files</h2>
          <p class="we-card-description">Use host-style absolute file paths.</p>
        </div>
        <Button
          v-if="selectedDefinition?.mode === 'ondemand'"
          size="sm"
          variant="outline"
          class="h-8 gap-1.5 px-2.5 text-[10px]"
          @click="requestRandom"
        >
          <Shuffle class="size-3" />
          Request random
        </Button>
      </div>

      <div class="flex items-center gap-2">
        <Input
          v-model="newFile"
          type="text"
          placeholder="C:/Wallpapers/image.jpg"
          class="h-8 min-w-0 flex-1 font-mono text-[11px]"
          @keydown.enter="addFile"
        />
        <Button size="sm" class="h-8 gap-1.5 px-3 text-[11px]" @click="addFile">
          <Plus class="size-3" />
          Add
        </Button>
      </div>

      <div
        v-if="files.length === 0"
        class="mt-3 rounded-md border border-dashed border-we-border py-5 text-center text-[11px] text-we-faint"
      >
        No files in this simulated directory.
      </div>

      <div v-else class="mt-3 space-y-1.5">
        <div
          v-for="path in files"
          :key="path"
          class="flex items-center gap-2 rounded-md border border-we-border bg-we-panel/60 px-2.5 py-2"
        >
          <span class="min-w-0 flex-1 truncate font-mono text-[10px] text-we-muted" :title="path">
            {{ path }}
          </span>
          <button
            v-if="selectedDefinition?.mode === 'fetchall'"
            type="button"
            class="we-icon-button size-6"
            title="Send added or changed callback"
            aria-label="Send file changed callback"
            @click="resendChanged(path)"
          >
            <RefreshCw class="size-3" />
          </button>
          <button
            type="button"
            class="we-icon-button size-6 hover:border-destructive hover:text-destructive"
            title="Remove file"
            aria-label="Remove file"
            @click="removeFile(path)"
          >
            <Trash2 class="size-3" />
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
