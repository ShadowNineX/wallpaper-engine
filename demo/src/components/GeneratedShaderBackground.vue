<script setup lang="ts">
import { TresCanvas } from "@tresjs/core";
import type { AudioAnalyzer } from "wallpaper-engine/helpers";
import GeneratedShaderScene from "./GeneratedShaderScene.vue";

const props = defineProps<{
  background: string;
  accent: string;
  glow: string;
  baseAccent: string;
  baseGlow: string;
  analyzer: AudioAnalyzer;
  sensitivity: number;
  animationSpeed: number;
  paused: boolean;
  fpsLimit: number;
}>();
</script>

<template>
  <div class="generated-shader" aria-hidden="true">
    <TresCanvas
      :alpha="false"
      :antialias="false"
      :depth="false"
      :stencil="false"
      :dpr="[1, 1.5]"
      :clear-color="props.background"
      :fps-limit="
        props.paused
          ? 1
          : props.fpsLimit === 0
            ? undefined
            : props.fpsLimit
      "
    >
      <GeneratedShaderScene
        :background="props.background"
        :accent="props.accent"
        :glow="props.glow"
        :base-accent="props.baseAccent"
        :base-glow="props.baseGlow"
        :analyzer="props.analyzer"
        :sensitivity="props.sensitivity"
        :animation-speed="props.animationSpeed"
        :paused="props.paused"
      />
    </TresCanvas>
  </div>
</template>
