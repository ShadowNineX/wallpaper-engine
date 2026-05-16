<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { WallpaperUserPropertiesOf } from "wallpaper-engine/plugin";
import { wallpaperColorToHex } from "wallpaper-engine/helpers";
import { properties } from "./wallpaper";

type UserProps = WallpaperUserPropertiesOf<typeof properties>;

const bgColor = ref(wallpaperColorToHex(properties.bgColor.value));
const accentColor = ref(wallpaperColorToHex(properties.accentColor.value));
const label = ref(properties.label.value);
const showLabel = ref(properties.showLabel.value);

const bgStyle = computed(() => ({
  background: `radial-gradient(ellipse at 50% 55%, ${accentColor.value}28 0%, ${bgColor.value} 65%)`,
}));

onMounted(() => {
  globalThis.wallpaperPropertyListener = {
    applyUserProperties(raw) {
      const props = raw as Partial<UserProps>;
      if (props.bgColor)
        bgColor.value = wallpaperColorToHex(props.bgColor.value);
      if (props.accentColor)
        accentColor.value = wallpaperColorToHex(props.accentColor.value);
      if (props.label != null) label.value = props.label.value;
      if (props.showLabel != null) showLabel.value = props.showLabel.value;
    },
  };
});
</script>

<template>
  <div class="wallpaper" :style="bgStyle">
    <div class="orb" :style="{ background: accentColor }" />
    <Transition name="fade">
      <p
        v-if="showLabel"
        class="label"
        :style="{ color: accentColor, textShadow: `0 0 30px ${accentColor}88` }"
      >
        {{ label }}
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.wallpaper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 1s ease;
}

.orb {
  position: absolute;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  filter: blur(140px);
  opacity: 0.35;
  animation: pulse 8s ease-in-out infinite;
  transition: background 1s ease;
}

.label {
  position: relative;
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  font-family: system-ui, sans-serif;
  z-index: 1;
  transition:
    color 1s ease,
    text-shadow 1s ease;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.35;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.52;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
