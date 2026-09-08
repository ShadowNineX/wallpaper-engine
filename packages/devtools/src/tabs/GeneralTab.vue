<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { toast } from 'vue-sonner';
import Pause from '~icons/ph/pause-duotone';
import Play from '~icons/ph/play-duotone';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/ui/number-field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { invokeHostCallback } from '../callbacks';
import CallbackStatus from '../components/CallbackStatus.vue';
import { listenerFns, useDevtoolsStore } from '../store';

const store = useDevtoolsStore();
const general = store.general;
const { listenerCounts } = storeToRefs(store);

function applyFps(): void {
  if (!Number.isFinite(general.fps)) {
    toast('Enter a valid FPS limit before sending.');
    return;
  }
  const listener = listenerFns.property;
  if (!listener?.applyGeneralProperties) {
    toast('No applyGeneralProperties listener registered.');
    return;
  }
  if (invokeHostCallback(() => listener.applyGeneralProperties?.({ fps: general.fps })))
    toast(`FPS limit sent: ${general.fps === 0 ? 'unlimited' : general.fps}`);
}

function applyPaused(paused: boolean): void {
  general.paused = paused;
  const listener = listenerFns.property;
  if (!listener?.setPaused) {
    toast('No setPaused listener registered.');
    return;
  }
  if (invokeHostCallback(() => listener.setPaused?.(paused)))
    toast(paused ? 'Wallpaper paused.' : 'Wallpaper resumed.');
}

function firePluginLoaded(name: 'led' | 'cue'): void {
  const listener = listenerFns.plugin;
  if (!listener?.onPluginLoaded) {
    toast('No onPluginLoaded listener registered.');
    return;
  }
  if (invokeHostCallback(() => listener.onPluginLoaded?.(name, '0.0.0-dev')))
    toast(`${name === 'led' ? 'LED' : 'iCUE'} plugin loaded.`);
}
</script>

<template>
  <div class="space-y-4">
    <section class="we-card">
      <div class="we-card-header">
        <div>
          <h2 class="we-card-title">
            Wallpaper runtime
          </h2>
          <p class="we-card-description">
            Send app settings and pause events to the wallpaper.
          </p>
        </div>
        <CallbackStatus
          :ready="listenerCounts.property"
          ready-label="Property listener registered"
          missing-label="Waiting for property listener"
        />
      </div>

      <div class="divide-y divide-we-border/70 border-y border-we-border/70">
        <div class="we-field py-3.5">
          <div>
            <Label for="general-fps" class="we-field-label">FPS limit</Label>
            <div class="mt-0.5 text-[11px] text-we-faint">
              0 is unlimited
            </div>
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
                  if (value !== undefined && Number.isFinite(value)) general.fps = value;
                }
              "
            >
              <NumberFieldContent>
                <NumberFieldDecrement />
                <NumberFieldInput />
                <NumberFieldIncrement />
              </NumberFieldContent>
            </NumberField>
            <Button size="sm" class="h-9 px-3 text-[12px]" @click="applyFps">
              Send
            </Button>
          </div>
        </div>

        <div class="we-field py-3.5">
          <div>
            <div class="we-field-label">
              Run state
            </div>
            <div class="mt-0.5 text-[11px] text-we-faint">
              Sends immediately
            </div>
          </div>
          <ToggleGroup
            type="single"
            aria-label="Wallpaper run state"
            :model-value="general.paused ? 'paused' : 'running'"
            class="grid grid-cols-2 gap-1"
            @update:model-value="
              (value) => {
                if (value) applyPaused(value === 'paused');
              }
            "
          >
            <ToggleGroupItem value="running" class="h-9 gap-1.5 text-[12px]">
              <Play class="size-3" />
              Running
            </ToggleGroupItem>
            <ToggleGroupItem value="paused" class="h-9 gap-1.5 text-[12px]">
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
          <h2 class="we-card-title">
            RGB plugins
          </h2>
          <p class="we-card-description">
            Announce a simulated plugin connection.
          </p>
        </div>
        <CallbackStatus
          :ready="listenerCounts.plugin"
          ready-label="Plugin callback ready"
          missing-label="Waiting for plugin listener"
        />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          class="h-10 justify-start gap-2 px-3 text-[12px]"
          @click="firePluginLoaded('led')"
        >
          <span class="size-2 rounded-full bg-sky-400" />
          Load LED plugin
        </Button>
        <Button
          size="sm"
          variant="outline"
          class="h-10 justify-start gap-2 px-3 text-[12px]"
          @click="firePluginLoaded('cue')"
        >
          <span class="size-2 rounded-full bg-amber-400" />
          Load iCUE plugin
        </Button>
      </div>
    </section>
  </div>
</template>
