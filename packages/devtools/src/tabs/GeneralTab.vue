<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UInputNumber from '@nuxt/ui/components/InputNumber.vue';
import { storeToRefs } from 'pinia';
import Pause from '~icons/ph/pause-duotone';
import Play from '~icons/ph/play-duotone';
import CallbackStatus from '../components/CallbackStatus.vue';
import { useDevtoolsStore } from '../store';

const store = useDevtoolsStore();
const { general, listenerCounts } = storeToRefs(store);
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
            <label for="general-fps" class="we-field-label">FPS limit</label>
            <div class="mt-0.5 text-[11px] text-we-faint">
              0 is unlimited
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UInputNumber
              id="general-fps"
              :model-value="general.fps"
              :min="0"
              :max="240"
              size="sm"
              class="min-w-0 flex-1"
              @update:model-value="
                (value) => {
                  if (value !== undefined && Number.isFinite(value)) general.fps = value;
                }
              "
            />
            <UButton size="sm" color="primary" @click="store.applyFps()">
              Send
            </UButton>
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
          <div
            aria-label="Wallpaper run state"
            class="grid grid-cols-2 gap-1"
          >
            <UButton
              size="sm"
              color="neutral"
              :variant="general.paused ? 'outline' : 'soft'"
              :aria-pressed="!general.paused"
              @click="store.applyPaused(false)"
            >
              <Play class="size-3" />
              Running
            </UButton>
            <UButton
              size="sm"
              color="neutral"
              :variant="general.paused ? 'soft' : 'outline'"
              :aria-pressed="general.paused"
              @click="store.applyPaused(true)"
            >
              <Pause class="size-3" />
              Paused
            </UButton>
          </div>
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
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          @click="store.firePluginLoaded('led')"
        >
          <span class="size-2 rounded-full bg-sky-400" />
          Load LED plugin
        </UButton>
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          @click="store.firePluginLoaded('cue')"
        >
          <span class="size-2 rounded-full bg-amber-400" />
          Load iCUE plugin
        </UButton>
      </div>
    </section>
  </div>
</template>
