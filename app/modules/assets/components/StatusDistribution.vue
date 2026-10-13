<script setup lang="ts">
import type { AssetStatus } from '../api/types'
import { ASSET_STATUS_ORDER } from '../constants'

/**
 * Status distribution (DESIGN §2.5): one 8px stacked bar in status tone colours, ordered by
 * lifecycle, with a labelled key below it. Each key entry links to the filtered inventory.
 */
const props = defineProps<{ counts: Record<AssetStatus, number> }>()
const enums = useEnums()

const FILL: Record<AssetStatus, string> = {
  in_stock: 'bg-st-neutral',
  pending_acceptance: 'bg-st-waiting',
  in_use: 'bg-st-positive',
  in_repair: 'bg-st-blocked',
  scrapped: 'bg-rule-strong',
}
const total = computed(() => ASSET_STATUS_ORDER.reduce((sum, s) => sum + (props.counts[s] ?? 0), 0))
const parts = computed(() =>
  ASSET_STATUS_ORDER.map((status) => ({
    status,
    label: enums.label('assetStatus', status) ?? status,
    value: props.counts[status] ?? 0,
    share: total.value ? ((props.counts[status] ?? 0) / total.value) * 100 : 0,
  })),
)
</script>

<template>
  <div class="grid gap-3">
    <div
      class="flex h-2 w-full gap-0.5 overflow-hidden rounded-pill bg-viz-grid"
      role="img"
      :aria-label="parts.map((p) => `${p.label} ${p.value}`).join(', ')"
    >
      <span
        v-for="part in parts.filter((p) => p.value > 0)"
        :key="part.status"
        class="h-full first:rounded-l-pill last:rounded-r-pill"
        :class="FILL[part.status]"
        :style="{ width: `${part.share}%` }"
      />
    </div>
    <ul class="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0 text-sm">
      <li v-for="part in parts" :key="part.status">
        <NuxtLink
          :to="{ path: '/back-office/assets/inventory', query: { status: part.status } }"
          class="inline-flex items-center gap-1.5 text-ink-muted no-underline hover:text-ink"
        >
          <span class="size-2.5 rounded-xs" :class="FILL[part.status]" aria-hidden="true" />
          {{ part.label }}
          <span class="num font-semibold text-ink">{{ part.value }}</span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
