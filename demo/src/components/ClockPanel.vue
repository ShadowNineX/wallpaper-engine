<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  show: boolean;
  now: Date;
  format: "twelve" | "twentyfour";
  showSeconds: boolean;
}>();

const timeParts = computed(() =>
  new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: props.showSeconds ? "2-digit" : undefined,
    hour12: props.format === "twelve",
  }).formatToParts(props.now),
);
const hourMinuteText = computed(() => {
  const hour = timeParts.value.find((part) => part.type === "hour")?.value ?? "00";
  const minute = timeParts.value.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
});
const secondsText = computed(
  () => timeParts.value.find((part) => part.type === "second")?.value ?? "00",
);
const dayPeriodText = computed(
  () => timeParts.value.find((part) => part.type === "dayPeriod")?.value ?? "",
);
const accessibleTimeText = computed(() =>
  props.now.toLocaleTimeString([], {
    hour: "numeric",
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
    year: "numeric",
  }),
);
const timezoneText = Intl.DateTimeFormat()
  .resolvedOptions()
  .timeZone.replaceAll("_", " ");
</script>

<template>
  <Transition name="clock-shift">
    <section v-if="show" class="clock-block">
      <div class="clock-kicker">
        <span>LOCAL TIME</span>
        <span class="hairline" />
        <span>{{ timezoneText }}</span>
      </div>
      <time
        class="clock-face"
        :datetime="now.toISOString()"
        :aria-label="accessibleTimeText"
      >
        <span class="clock-time">{{ hourMinuteText }}</span>
        <span v-if="showSeconds" class="clock-seconds">{{ secondsText }}</span>
        <span v-if="dayPeriodText" class="clock-period">{{ dayPeriodText }}</span>
      </time>
      <p class="date-line">{{ dateText }}</p>
    </section>
  </Transition>
</template>

