<script setup lang="ts">
import { computed, ref } from "vue";
import { propDefs } from "../config";
import { directoryFiles, listenerFns, toast } from "../state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const directories = computed(() =>
  Object.entries(propDefs).filter(([, d]) => d.type === "directory"),
);

const selected = ref<string>(directories.value[0]?.[0] ?? "");
const newFile = ref<string>("");

function getList(key: string): string[] {
  return directoryFiles[key] ?? [];
}

function addFile(): void {
  if (!selected.value || !newFile.value) return;
  const list = directoryFiles[selected.value] ?? [];
  list.push(newFile.value);
  directoryFiles[selected.value] = list;
  newFile.value = "";
}

function fireAdded(key: string, file: string): void {
  const l = listenerFns.property;
  if (!l?.userDirectoryFilesAddedOrChanged) {
    toast("No userDirectoryFilesAddedOrChanged listener");
    return;
  }
  l.userDirectoryFilesAddedOrChanged(key, [file]);
  toast(`Added → ${file}`);
}

function fireRemoved(key: string, file: string): void {
  const l = listenerFns.property;
  if (!l?.userDirectoryFilesRemoved) {
    toast("No userDirectoryFilesRemoved listener");
    return;
  }
  l.userDirectoryFilesRemoved(key, [file]);
  const list = directoryFiles[key] ?? [];
  const i = list.indexOf(file);
  if (i >= 0) list.splice(i, 1);
  toast(`Removed → ${file}`);
}
</script>

<template>
  <div v-if="directories.length === 0" class="text-[11px] italic text-we-faint">
    No directory-type properties.
  </div>

  <div v-else class="space-y-3">
    <div class="grid grid-cols-[110px_1fr] items-center gap-2">
      <span class="text-[11px] text-we-muted">Property</span>
      <Select v-model="selected">
        <SelectTrigger class="h-7 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="[k] in directories" :key="k" :value="k">{{
            k
          }}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="flex items-center gap-1.5">
      <Input
        v-model="newFile"
        type="text"
        placeholder="path/to/file.jpg"
        class="h-7 flex-1 text-xs"
        @keydown.enter="addFile"
      />
      <Button size="sm" variant="outline" @click="addFile">Add</Button>
    </div>

    <div
      v-for="[key] in directories"
      :key="key"
      class="space-y-1.5 rounded-md border border-we-border bg-we-section p-2.5"
    >
      <h3
        class="text-[11px] font-semibold uppercase tracking-wide text-we-heading"
      >
        {{ key }}
      </h3>
      <p
        v-if="getList(key).length === 0"
        class="text-[11px] italic text-we-faint"
      >
        No files.
      </p>
      <div
        v-for="(f, i) in getList(key)"
        :key="i"
        class="flex items-center gap-1"
      >
        <span class="flex-1 truncate font-mono text-[11px]">{{ f }}</span>
        <Button
          size="sm"
          variant="outline"
          class="h-6 px-1.5 text-[10px]"
          @click="fireAdded(key, f)"
          >added</Button
        >
        <Button
          size="sm"
          variant="destructive"
          class="h-6 px-1.5 text-[10px]"
          @click="fireRemoved(key, f)"
          >removed</Button
        >
      </div>
    </div>
  </div>
</template>
