<script setup lang="ts">
/**
 * DateRangeFilter (SCREENS §1.6): a compact from–to filter for list pages, bound to `from` / `to`
 * IsoDates (API.md §1: inclusive). Emits both at once.
 */
const props = defineProps<{ from?: string | null; to?: string | null; label?: string }>()
const emit = defineEmits<{ change: [range: { from: string | null; to: string | null }] }>()

const range = computed({
  get: () => ({ start: props.from ?? null, end: props.to ?? null }),
  set: (value) => emit('change', { from: value.start, to: value.end }),
})
</script>

<template>
  <div class="grid gap-1">
    <span v-if="label" class="text-meta font-semibold text-ink-subtle">{{ label }}</span>
    <UiDateRangePicker v-model="range" class="min-w-[250px]" />
  </div>
</template>
