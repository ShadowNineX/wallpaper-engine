<script setup lang="ts">
import { ref } from "vue";
import { toast } from "vue-sonner";
import FolderOpen from "~icons/ph/folder-open";
import RefreshCw from "~icons/ph/arrows-clockwise";
import X from "~icons/ph/x";
import type {
  WallpaperDirectoryProperty,
  WallpaperFileProperty,
} from "../../../wallpaper-engine/src/types/project";
import {
  devFilePickerAvailable,
  pickDevDirectory,
  pickDevFile,
  releaseDevDirectory,
  releaseDevFile,
} from "../dev-files";
import { useDevtoolsStore } from "../store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PathPropertyDefinition =
  | WallpaperDirectoryProperty
  | WallpaperFileProperty;

const props = defineProps<{
  propKey: string;
  def: PathPropertyDefinition;
  label: string;
}>();

const store = useDevtoolsStore();
const browsing = ref(false);

async function browsePath(): Promise<void> {
  browsing.value = true;
  try {
    if (props.def.type === "file") {
      const previousUrl = store.currentValues[props.propKey]?.value;
      const selection = await pickDevFile(props.def.fileType);
      if (selection) {
        store.setFileSelection(props.propKey, selection);
        if (typeof previousUrl === "string") releaseDevFile(previousUrl);
      }
      return;
    }

    const selection = await pickDevDirectory(
      props.def.fileType,
      store.directorySelections[props.propKey]?.id,
    );
    if (selection) store.setDirectorySelection(props.propKey, selection);
  } catch (error) {
    toast(
      error instanceof Error ? error.message : "Unable to browse local files.",
    );
  } finally {
    browsing.value = false;
  }
}

function clearPath(): void {
  if (props.def.type === "file") {
    const previousUrl = store.currentValues[props.propKey]?.value;
    store.clearFileSelection(props.propKey);
    if (typeof previousUrl === "string") releaseDevFile(previousUrl);
    return;
  }

  const directoryId = store.directorySelections[props.propKey]?.id;
  store.clearDirectorySelection(props.propKey);
  if (directoryId) releaseDevDirectory(directoryId);
}
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-center gap-2">
      <Input
        :id="propKey"
        type="text"
        readonly
        :placeholder="
          def.type === 'file' ? 'No file selected' : 'No folder selected'
        "
        :model-value="store.propertyDisplayPaths[propKey] ?? ''"
        class="h-8 min-w-0 flex-1 font-mono text-[10px]"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        class="h-8 shrink-0 gap-1.5 px-2.5 text-[10px]"
        :disabled="browsing || !devFilePickerAvailable"
        :aria-busy="browsing"
        data-browse-path
        @click="browsePath"
      >
        <RefreshCw v-if="browsing" class="size-3 animate-spin" />
        <FolderOpen v-else class="size-3" />
        Browse
      </Button>
      <Button
        v-if="store.propertyDisplayPaths[propKey]"
        type="button"
        size="icon"
        variant="outline"
        class="size-8 shrink-0"
        :aria-label="`Clear ${label}`"
        data-clear-path
        @click="clearPath"
      >
        <X class="size-3" />
      </Button>
    </div>
    <p v-if="!devFilePickerAvailable" class="px-1 text-[10px] text-we-faint">
      This browser cannot expose selected local files.
    </p>
  </div>
</template>
