<script setup lang="ts">
import { computed } from "vue";
import { CalendarDays } from "lucide-vue-next";

const props = defineProps<{
  show: boolean;
  now: Date;
  format: "twelve" | "twentyfour";
  showSeconds: boolean;
}>();

const timeText = computed(() =>
  props.now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: props.showSeconds ? "2-digit" : undefined,
    hour12: props.format === "twelve",
  }),
);
const dateText = computed(() =>
  props.now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  }),
);
const yearText = computed(() => props.now.getFullYear());
const timezoneText = Intl.DateTimeFormat()
  .resolvedOptions()
  .timeZone.replaceAll("_", " ");
</script>

<template>
  <Transition name="clock-shift">
    <section v-if="show" class="clock-block">
      <div class="clock-kicker">
        <span>{{ timezoneText }}</span>
        <span class="hairline" />
        <span>{{ yearText }}</span>
      </div>
      <time class="clock-time">{{ timeText }}</time>
      <div class="date-line">
        <CalendarDays :size="17" />
        <span>{{ dateText }}</span>
      </div>
    </section>
  </Transition>
</template>
