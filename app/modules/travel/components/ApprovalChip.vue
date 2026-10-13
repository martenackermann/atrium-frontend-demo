<script setup lang="ts">
import { CircleCheck, Crown, Stamp } from '@lucide/vue'
import type { TravelRequestSummary } from '../api/types'
import { approvalChip } from '../lib/present'

/**
 * Approval chip in travel lists (SCREENS §5.1): "Needs approval · 2 reasons" (or "Approved · 2
 * reasons" once decided) / "No approval needed" / "Executive exemption". The reason names are in the tooltip (title) and the detail.
 */
const props = defineProps<{
  request: Pick<TravelRequestSummary, 'needsApproval' | 'approvalReasons' | 'approvalExemption'> &
    Partial<Pick<TravelRequestSummary, 'status'>>
}>()
const chip = computed(() => approvalChip(props.request))
const icon = computed(() =>
  chip.value.tone === 'waiting' ? Stamp : chip.value.tone === 'positive' ? CircleCheck : Crown,
)
const title = computed(() =>
  props.request.approvalReasons.length
    ? props.request.approvalReasons.map((reason) => reason.label).join(', ')
    : (props.request.approvalExemption?.label ?? undefined),
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 text-sm whitespace-nowrap"
    :class="{
      'text-ink-muted': chip.tone === 'waiting' || chip.tone === 'neutral',
      'text-st-positive': chip.tone === 'positive',
    }"
    :title="title"
  >
    <component
      :is="icon"
      class="size-3.5"
      :class="chip.tone === 'waiting' && 'text-st-waiting'"
      aria-hidden="true"
    />
    {{ chip.label }}
  </span>
</template>
