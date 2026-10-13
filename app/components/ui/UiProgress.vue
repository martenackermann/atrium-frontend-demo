<script setup lang="ts">
import { ProgressIndicator, ProgressRoot } from 'reka-ui'

/** Thin progress bar: ink on rule (uploads). `value` is 0–1. */
const props = defineProps<{ value: number; label?: string }>()
const percent = computed(() => Math.round(Math.min(Math.max(props.value, 0), 1) * 100))
</script>

<template>
  <ProgressRoot
    :model-value="percent"
    :aria-label="label"
    class="relative h-1 w-full overflow-hidden rounded-pill bg-rule"
  >
    <ProgressIndicator
      class="h-full bg-ink transition-transform duration-(--dur-2) ease-standard"
      :style="{ transform: `translateX(-${100 - percent}%)` }"
    />
  </ProgressRoot>
</template>
