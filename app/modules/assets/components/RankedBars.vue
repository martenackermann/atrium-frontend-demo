<script setup lang="ts">
import { NuxtLink } from '#components'
import type { RouteLocationRaw } from 'vue-router'

/**
 * Ranked horizontal bar list (DESIGN §2.5): direct labels left, bare tabular values at the bar
 * end, one categorical colour, rows link to the filtered table.
 */
const props = defineProps<{
  items: Array<{ id: string; label: string; value: number; to?: RouteLocationRaw }>
  ariaLabel: string
}>()
const max = computed(() => Math.max(1, ...props.items.map((item) => item.value)))
</script>

<template>
  <ol class="m-0 grid list-none gap-2.5 p-0" :aria-label="ariaLabel">
    <li v-for="item in items" :key="item.id">
      <component
        :is="item.to ? NuxtLink : 'div'"
        :to="item.to"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm text-ink no-underline"
        :class="item.to && 'hover:text-ink [&:hover_.bar]:bg-viz-1'"
      >
        <span class="truncate text-ink-muted">{{ item.label }}</span>
        <span class="num font-semibold">{{ item.value }}</span>
        <span class="col-span-2 h-1.5 rounded-pill bg-viz-grid">
          <span
            class="bar block h-full rounded-pill bg-viz-1/85"
            :style="{ width: `${(item.value / max) * 100}%` }"
          />
        </span>
      </component>
    </li>
  </ol>
</template>
