<script setup lang="ts">
import { useDevtoolsStore } from "../store";
import { storeToRefs } from "pinia";

const { listenerCounts } = storeToRefs(useDevtoolsStore());
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function badgeClass(active: boolean): string {
  return cn(
    "text-[10px] px-1.5 py-0.5 rounded",
    active
      ? "border-[var(--color-we-on-border)] bg-[var(--color-we-on-bg)] text-[var(--color-we-on-fg)]"
      : "border-[var(--color-we-border)] bg-[var(--color-we-btn)] text-[var(--color-we-muted)]",
  );
}
</script>

<template>
  <div
    class="flex flex-wrap gap-1 border-b border-we-border bg-we-surface px-2.5 py-1.5"
  >
    <Badge variant="outline" :class="badgeClass(!!listenerCounts.property)"
      >prop</Badge
    >
    <Badge variant="outline" :class="badgeClass(!!listenerCounts.plugin)"
      >plugin</Badge
    >
    <Badge variant="outline" :class="badgeClass(listenerCounts.audio > 0)"
      >audio({{ listenerCounts.audio }})</Badge
    >
    <Badge variant="outline" :class="badgeClass(listenerCounts.mediaStatus > 0)"
      >mStatus({{ listenerCounts.mediaStatus }})</Badge
    >
    <Badge variant="outline" :class="badgeClass(listenerCounts.mediaProps > 0)"
      >mProps({{ listenerCounts.mediaProps }})</Badge
    >
    <Badge variant="outline" :class="badgeClass(listenerCounts.mediaThumb > 0)"
      >mThumb({{ listenerCounts.mediaThumb }})</Badge
    >
    <Badge
      variant="outline"
      :class="badgeClass(listenerCounts.mediaPlayback > 0)"
      >mPlay({{ listenerCounts.mediaPlayback }})</Badge
    >
    <Badge
      variant="outline"
      :class="badgeClass(listenerCounts.mediaTimeline > 0)"
      >mTime({{ listenerCounts.mediaTimeline }})</Badge
    >
  </div>
</template>
