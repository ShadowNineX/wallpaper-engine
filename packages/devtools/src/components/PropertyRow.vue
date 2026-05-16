<script setup lang="ts">
import { computed } from "vue";
import type {
  WallpaperBoolValue,
  WallpaperColorValue,
  WallpaperComboValue,
  WallpaperDirectoryValue,
  WallpaperFileValue,
  WallpaperSliderValue,
  WallpaperTextValue,
} from "../../../wallpaper-engine/src/types/listeners";
import type { WallpaperPropertyDefinition } from "../../../wallpaper-engine/src/types/project";
import { tr } from "../config";
import { hexToWeColor, weColorToHex } from "../color";
import { useDevtoolsStore } from "../store";

const store = useDevtoolsStore();
const currentValues = store.currentValues;
const { deliverProperty } = store;
import type { AcceptableValue } from "reka-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const props = defineProps<{
  propKey: string;
  def: WallpaperPropertyDefinition;
}>();

const label = computed(() => tr(props.def.text || props.propKey));

function onColor(e: Event): void {
  const hex = (e.target as HTMLInputElement).value;
  const v = currentValues[props.propKey] as WallpaperColorValue | undefined;
  if (!v) return;
  v.value = hexToWeColor(hex);
  deliverProperty(props.propKey);
}

function onSlider(val: number[] | undefined): void {
  const num = val?.[0];
  if (num === undefined) return;
  const v = currentValues[props.propKey] as WallpaperSliderValue | undefined;
  if (!v) return;
  v.value = num;
  deliverProperty(props.propKey);
}

function onBool(value: unknown): void {
  const v = currentValues[props.propKey] as WallpaperBoolValue | undefined;
  if (!v) return;
  v.value = value === true;
  deliverProperty(props.propKey);
}

function onCombo(value: AcceptableValue): void {
  if (typeof value !== "string" || props.def.type !== "combo") return;
  const v = currentValues[props.propKey] as WallpaperComboValue | undefined;
  if (!v) return;
  const opt = props.def.options.find((o) => o.value === value);
  v.value = value;
  v.text = opt ? tr(opt.label) : value;
  deliverProperty(props.propKey);
}

function onText(e: Event): void {
  const v = currentValues[props.propKey] as WallpaperTextValue | undefined;
  if (!v) return;
  v.value = (e.target as HTMLInputElement).value;
  deliverProperty(props.propKey);
}

function onFile(e: Event): void {
  const v = currentValues[props.propKey] as WallpaperFileValue | undefined;
  if (!v) return;
  v.value = (e.target as HTMLInputElement).value;
  deliverProperty(props.propKey);
}

function onBoolLabel(): void {
  const v = currentValues[props.propKey] as WallpaperBoolValue | undefined;
  if (!v) return;
  v.value = !v.value;
  deliverProperty(props.propKey);
}

function onDir(e: Event): void {
  const v = currentValues[props.propKey] as WallpaperDirectoryValue | undefined;
  if (!v) return;
  v.value = (e.target as HTMLInputElement).value;
  deliverProperty(props.propKey);
}
</script>

<template>
  <div class="mb-2 grid grid-cols-[110px_1fr] items-center gap-2">
    <Label
      :for="def.type !== 'bool' ? propKey : undefined"
      :title="propKey"
      class="truncate text-[11px] text-we-muted cursor-pointer select-none"
      @click="def.type === 'bool' ? onBoolLabel() : undefined"
      >{{ label }}</Label
    >

    <input
      v-if="def.type === 'color'"
      :id="propKey"
      type="color"
      :value="
        weColorToHex(
          (currentValues[propKey] as WallpaperColorValue | undefined)?.value ??
            '0 0 0',
        )
      "
      class="h-6 w-9 cursor-pointer rounded border border-we-border bg-transparent p-0"
      @input="onColor"
    />

    <div v-else-if="def.type === 'slider'" class="flex items-center gap-1.5">
      <Slider
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
      <span class="min-w-9 text-right tabular-nums text-we-muted text-[11px]">
        {{
          (currentValues[propKey] as WallpaperSliderValue | undefined)?.value
        }}
      </span>
    </div>

    <Checkbox
      v-else-if="def.type === 'bool'"
      :model-value="
        (currentValues[propKey] as WallpaperBoolValue | undefined)?.value ??
        false
      "
      class="justify-self-start"
      @update:model-value="onBool"
    />

    <Select
      v-else-if="def.type === 'combo'"
      :model-value="
        (currentValues[propKey] as WallpaperComboValue | undefined)?.value ?? ''
      "
      @update:model-value="onCombo"
    >
      <SelectTrigger :id="propKey" class="h-7 w-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="o in def.options" :key="o.value" :value="o.value">
          {{ tr(o.label) }}
        </SelectItem>
      </SelectContent>
    </Select>

    <Input
      v-else-if="def.type === 'textinput'"
      :id="propKey"
      type="text"
      :model-value="
        (currentValues[propKey] as WallpaperTextValue | undefined)?.value ?? ''
      "
      class="h-7 text-xs"
      @input="onText"
    />

    <Input
      v-else-if="def.type === 'file'"
      :id="propKey"
      type="text"
      placeholder="path/to/file"
      :model-value="
        (currentValues[propKey] as WallpaperFileValue | undefined)?.value ?? ''
      "
      class="h-7 text-xs"
      @input="onFile"
    />

    <Input
      v-else-if="def.type === 'directory'"
      :id="propKey"
      type="text"
      placeholder="path/to/dir"
      :model-value="
        (currentValues[propKey] as WallpaperDirectoryValue | undefined)
          ?.value ?? ''
      "
      class="h-7 text-xs"
      @input="onDir"
    />
  </div>
</template>
