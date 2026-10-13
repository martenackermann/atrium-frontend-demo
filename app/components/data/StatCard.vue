<script setup lang="ts">
import { NuxtLink } from '#components'
import type { RouteLocationRaw } from 'vue-router'

/**
 * StatCard (DESIGN §2.5/§9): number (28/600 tabular) · label below (no eyebrow) · optional text
 * delta ("+4 since Monday") · optional mini bar list. The whole card links to the filtered table.
 */
const props = defineProps<{
  value: number | null | undefined
  label: string
  to?: RouteLocationRaw
  delta?: string
  /** Mini horizontal bar list with direct labels. */
  bars?: Array<{ label: string; value: number }>
  loading?: boolean
}>()

const max = computed(() => Math.max(1, ...(props.bars ?? []).map((bar) => bar.value)))
</script>

<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to"
    class="grid content-start gap-1 rounded-lg border border-rule bg-sheet px-4 py-3.5 text-ink no-underline transition-colors duration-(--dur-1)"
    :class="to && 'hover:border-rule-strong hover:bg-raised'"
  >
    <UiSkeleton v-if="loading" class="h-8 w-14" />
    <span v-else class="num text-[28px] leading-8 font-semibold">{{ value ?? '—' }}</span>
    <span class="text-sm text-ink-muted">{{ label }}</span>
    <span v-if="delta" class="text-meta text-ink-subtle">{{ delta }}</span>
    <ul v-if="bars?.length" class="mt-2 grid list-none gap-1.5 p-0">
      <li
        v-for="bar in bars"
        :key="bar.label"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 text-meta"
      >
        <span class="truncate text-ink-muted">{{ bar.label }}</span>
        <span class="num text-ink">{{ bar.value }}</span>
        <span class="col-span-2 h-1.5 rounded-pill bg-viz-grid">
          <span
            class="block h-full rounded-pill bg-viz-1"
            :style="{ width: `${(bar.value / max) * 100}%` }"
          />
        </span>
      </li>
    </ul>
  </component>
</template>
