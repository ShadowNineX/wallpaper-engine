<script setup lang="ts">
import { computed, ref } from "vue";
import FolderOpen from "~icons/ph/folder-open";
import RefreshCw from "~icons/ph/arrows-clockwise";
import X from "~icons/ph/x";
import type {
  WallpaperBoolValue,
  WallpaperColorValue,
  WallpaperComboValue,
  WallpaperSliderValue,
  WallpaperTextValue,
} from "../../../wallpaper-engine/src/types/listeners";
import type { WallpaperPropertyDefinition } from "../../../wallpaper-engine/src/types/project";
import { tr } from "../config";
import { hexToWeColor, weColorToHex } from "../color";
import { useDevtoolsStore } from "../store";
import { toast } from "vue-sonner";
import {
  devFilePickerAvailable,
  pickDevDirectory,
  pickDevFile,
  releaseDevDirectory,
  releaseDevFile,
} from "../dev-files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

const props = defineProps<{
  propKey: string;
  def: WallpaperPropertyDefinition;
}>();

const store = useDevtoolsStore();
const currentValues = store.currentValues;
const browsing = ref(false);
const label = computed(() => tr(props.def.text || props.propKey));

function onColor(event: Event): void {
  const value = currentValues[props.propKey] as WallpaperColorValue | undefined;
  if (!value) return;
  value.value = hexToWeColor((event.target as HTMLInputElement).value);
  store.deliverProperty(props.propKey);
}

function onSlider(values: number[] | undefined): void {
  const next = values?.[0];
  const value = currentValues[props.propKey] as WallpaperSliderValue | undefined;
  if (next === undefined || !value) return;
  value.value = next;
  store.deliverProperty(props.propKey);
}

function onBool(checked: unknown): void {
  const value = currentValues[props.propKey] as WallpaperBoolValue | undefined;
  if (!value) return;
  value.value = checked === true;
  store.deliverProperty(props.propKey);
}

function onCombo(event: Event): void {
  const selected = (event.target as HTMLSelectElement).value;
  if (props.def.type !== "combo") return;
  const value = currentValues[props.propKey] as WallpaperComboValue | undefined;
  if (!value) return;
  const option = props.def.options.find((item) => item.value === selected);
  value.value = selected;
  value.text = option ? tr(option.label) : selected;
  store.deliverProperty(props.propKey);
}

function onText(event: Event): void {
  const value = currentValues[props.propKey] as WallpaperTextValue | undefined;
  if (!value) return;
  value.value = (event.target as HTMLInputElement).value;
  store.deliverProperty(props.propKey);
}

async function browsePath(): Promise<void> {
  if (props.def.type !== "file" && props.def.type !== "directory") return;
  browsing.value = true;
  try {
    if (props.def.type === "file") {
      const previousUrl = currentValues[props.propKey]?.value;
      const selection = await pickDevFile(props.def.fileType);
      if (selection) {
        store.setFileSelection(props.propKey, selection);
        if (typeof previousUrl === "string") releaseDevFile(previousUrl);
      }
    } else {
      const selection = await pickDevDirectory(
        props.def.fileType,
        store.directorySelections[props.propKey]?.id,
      );
      if (selection) store.setDirectorySelection(props.propKey, selection);
    }
  } catch (error) {
    toast(error instanceof Error ? error.message : "Unable to browse local files.");
  } finally {
    browsing.value = false;
  }
}

function clearPath(): void {
  if (props.def.type === "file") {
    const previousUrl = currentValues[props.propKey]?.value;
    store.clearFileSelection(props.propKey);
    if (typeof previousUrl === "string") releaseDevFile(previousUrl);
  } else if (props.def.type === "directory") {
    const directoryId = store.directorySelections[props.propKey]?.id;
    store.clearDirectorySelection(props.propKey);
    if (directoryId) releaseDevDirectory(directoryId);
  }
}
</script>

<template>
  <article class="rounded-lg border border-we-border/70 bg-[linear-gradient(135deg,rgba(32,35,43,0.94),rgba(24,26,32,0.94))] px-3 py-2.5 shadow-[inset_2px_0_0_rgba(91,134,237,0.18)] transition-colors hover:border-we-primary/35">
    <div class="mb-2 flex items-start justify-between gap-3">
      <Label
        :for="propKey"
        class="min-w-0 truncate text-[11px] font-medium text-we-text"
      >
        {{ label }}
      </Label>
      <span class="shrink-0 font-mono text-[11px] text-we-faint" :title="propKey">
        {{ propKey }} · {{ def.type }}
      </span>
    </div>

    <div v-if="def.type === 'color'" class="flex items-center gap-2">
      <input
        :id="propKey"
        type="color"
        :value="
          weColorToHex(
            (currentValues[propKey] as WallpaperColorValue | undefined)?.value ??
              '0 0 0',
          )
        "
        class="h-8 w-12 shrink-0 cursor-pointer rounded-md border border-we-border bg-we-btn p-1"
        @input="onColor"
      />
      <code class="min-w-0 truncate text-[10px] text-we-muted">
        {{
          (currentValues[propKey] as WallpaperColorValue | undefined)?.value ??
          "0 0 0"
        }}
      </code>
    </div>

    <div v-else-if="def.type === 'slider'" class="flex items-center gap-3">
      <Slider
        :id="propKey"
        :model-value="[
          (currentValues[propKey] as WallpaperSliderValue | undefined)?.value ??
            (def.value as number | undefined) ??
            0,
        ]"
        :min="def.min"
        :max="def.max"
        :step="def.fraction ? 1 / Math.pow(10, def.precision ?? 2) : 1"
        class="flex-1"
        @update:model-value="onSlider"
      />
      <span
        class="min-w-12 rounded-md border border-we-border bg-we-panel px-2 py-1 text-right text-[10px] tabular-nums text-we-muted"
      >
        {{ (currentValues[propKey] as WallpaperSliderValue | undefined)?.value }}
      </span>
    </div>

    <label
      v-else-if="def.type === 'bool'"
      :for="propKey"
      class="flex cursor-pointer items-center gap-2 text-[11px] text-we-muted"
    >
      <Checkbox
        :id="propKey"
        :model-value="
          (currentValues[propKey] as WallpaperBoolValue | undefined)?.value ??
          false
        "
        class="size-4.5"
        @update:model-value="onBool"
      />
      <span>
        {{
          (currentValues[propKey] as WallpaperBoolValue | undefined)?.value
            ? "Enabled"
            : "Disabled"
        }}
      </span>
    </label>

    <div
      v-else-if="def.type === 'combo'"
      class="[&>[data-slot=native-select-wrapper]]:w-full"
    >
      <NativeSelect
        :model-value="
          (currentValues[propKey] as WallpaperComboValue | undefined)?.value ?? ''
        "
        :id="propKey"
        class="h-8 w-full bg-we-btn text-xs text-we-text hover:bg-we-btn-hover"
        @change="onCombo"
      >
        <NativeSelectOption
          v-for="option in def.options"
          :key="option.value"
          :value="option.value"
        >
          {{ tr(option.label) }}
        </NativeSelectOption>
      </NativeSelect>
    </div>

    <Input
      v-else-if="def.type === 'textinput'"
      :id="propKey"
      type="text"
      :model-value="
        (currentValues[propKey] as WallpaperTextValue | undefined)?.value ?? ''
      "
      class="h-8 text-xs"
      @change="onText"
    />

    <div
      v-else-if="def.type === 'file' || def.type === 'directory'"
      class="space-y-1.5"
    >
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
  </article>
</template>
