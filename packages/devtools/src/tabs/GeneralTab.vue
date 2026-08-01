<script setup lang="ts">
import { storeToRefs } from "pinia";
import Pause from "~icons/ph/pause-duotone";
import Play from "~icons/ph/play-duotone";
import PlugZap from "~icons/ph/plug-duotone";
import { toast } from "vue-sonner";
import { listenerFns, useDevtoolsStore } from "../store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";

const store = useDevtoolsStore();
const general = store.general;
const { listenerCounts } = storeToRefs(store);

function applyFps(): void {
  const listener = listenerFns.property;
  if (!listener?.applyGeneralProperties) {
    toast("No applyGeneralProperties listener registered.");
    return;
  }
  listener.applyGeneralProperties({ fps: general.fps });
  toast(`FPS limit sent: ${general.fps === 0 ? "unlimited" : general.fps}`);
}

function applyPaused(paused: boolean): void {
  general.paused = paused;
  const listener = listenerFns.property;
  if (!listener?.setPaused) {
    toast("No setPaused listener registered.");
    return;
  }
  listener.setPaused(paused);
  toast(paused ? "Wallpaper paused." : "Wallpaper resumed.");
}

function firePluginLoaded(name: "led" | "cue"): void {
  const listener = listenerFns.plugin;
  if (!listener?.onPluginLoaded) {
    toast("No onPluginLoaded listener registered.");
    return;
  }
  listener.onPluginLoaded(name, "0.0.0-dev");
  toast(`${name === "led" ? "LED" : "iCUE"} plugin loaded.`);
}
</script>

<template>
  <div class="space-y-3">
    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">Wallpaper runtime</h2>
          <p class="we-card-description">
            Simulate app-level settings and Wallpaper Engine pause events.
          </p>
        </div>
        <span
          class="flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px]"
          :class="
            listenerCounts.property
              ? 'border-we-on-border bg-we-on-bg text-we-on-fg'
              : 'border-we-border bg-we-panel text-we-faint'
          "
        >
          <span
            class="size-1.5 rounded-full"
            :class="listenerCounts.property ? 'bg-emerald-400' : 'bg-we-border-strong'"
          />
          {{ listenerCounts.property ? "listener ready" : "waiting for listener" }}
        </span>
      </div>

      <div class="space-y-3">
        <div class="we-field">
          <div>
            <Label for="general-fps" class="we-field-label">FPS limit</Label>
            <div class="mt-0.5 text-[10px] text-we-faint">0 is unlimited</div>
          </div>
          <div class="flex items-center gap-2">
            <NumberField
              id="general-fps"
              :model-value="general.fps"
              :min="0"
              :max="240"
              class="min-w-0 flex-1"
              @update:model-value="
                (value) => {
                  if (value !== undefined) general.fps = value;
                }
              "
            >
              <NumberFieldContent>
                <NumberFieldDecrement />
                <NumberFieldInput />
                <NumberFieldIncrement />
              </NumberFieldContent>
            </NumberField>
            <Button size="sm" class="h-8 px-3 text-[11px]" @click="applyFps">
              Send
            </Button>
          </div>
        </div>

        <div class="we-field">
          <div>
            <div class="we-field-label">Run state</div>
            <div class="mt-0.5 text-[10px] text-we-faint">setPaused(boolean)</div>
          </div>
          <ToggleGroup
            type="single"
            :model-value="general.paused ? 'paused' : 'running'"
            class="grid grid-cols-2 gap-1"
            @update:model-value="
              (value) => {
                if (value) applyPaused(value === 'paused');
              }
            "
          >
            <ToggleGroupItem value="running" class="h-8 gap-1.5 text-[11px]">
              <Play class="size-3" />
              Running
            </ToggleGroupItem>
            <ToggleGroupItem value="paused" class="h-8 gap-1.5 text-[11px]">
              <Pause class="size-3" />
              Paused
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    </section>

    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">RGB plugins</h2>
          <p class="we-card-description">
            Fire the plugin-ready events exposed by Wallpaper Engine.
          </p>
        </div>
        <PlugZap class="size-4 text-we-faint" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          class="h-9 justify-start gap-2 px-3 text-[11px]"
          @click="firePluginLoaded('led')"
        >
          <span class="size-2 rounded-full bg-sky-400" />
          Load LED plugin
        </Button>
        <Button
          size="sm"
          variant="outline"
          class="h-9 justify-start gap-2 px-3 text-[11px]"
          @click="firePluginLoaded('cue')"
        >
          <span class="size-2 rounded-full bg-amber-400" />
          Load iCUE plugin
        </Button>
      </div>
    </section>
  </div>
</template>
