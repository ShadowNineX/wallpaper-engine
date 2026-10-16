<script setup lang="ts">
import USlider from '@nuxt/ui/components/Slider.vue';
import { computed, useAttrs } from 'vue';

defineOptions({ inheritAttrs: false });

withDefaults(defineProps<{
  modelValue?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}>(), {
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: number | undefined];
  'change': [event: Event];
}>();

const attrs = useAttrs();
const forwardedAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs;
  return rest;
});

function updateModel(value: number | number[] | undefined) {
  emit('update:modelValue', Array.isArray(value) ? value[0] : value);
}
</script>

<template>
  <div
    class="relative min-w-0"
    :class="$attrs.class"
    :style="$attrs.style"
  >
    <USlider
      v-bind="forwardedAttrs"
      :model-value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      class="relative z-10 min-w-0 py-1"
      :ui="{
        thumb: '!z-20 !h-8 !w-[14px] !rounded-full !border-2 !border-white !bg-we-surface !shadow-[0_1px_5px_rgb(0_0_0_/_0.4)] !ring-2 !ring-transparent focus-visible:!ring-we-primary',
        track: '!h-2 !rounded-full !bg-we-btn',
        range: '!rounded-full !bg-we-primary',
      }"
      @update:model-value="updateModel"
      @change="emit('change', $event)"
    />
  </div>
</template>
