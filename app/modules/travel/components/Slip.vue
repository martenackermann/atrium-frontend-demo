<script setup lang="ts">
import { AlarmClock } from '@lucide/vue'
import type { UserRef } from '~/types/api'
import type { FactItem, ReasonChip } from '~/types/ui'
import type { TravelPreview } from '../api/types'
import { plannedStops } from '../lib/present'

/**
 * The live summary slip of a travel stepper (SCREENS §5.3, DESIGN §8.2): facts, then
 * "Needs approval because…" (reason labels from the preview, plain lines — DESIGN R2) or
 * "No approval needed" / the executive exemption, the High priority flag ("Starts within 3 days:
 * the travel desk is alerted"), then "What happens next" (you → approver → travel desk).
 */
const props = defineProps<{
  title: string
  facts: FactItem[]
  preview: TravelPreview | null | undefined
  requester: UserRef | null
}>()
defineEmits<{ 'select-reason': [code: string] }>()

const reasons = computed<ReasonChip[] | null>(() =>
  props.preview ? props.preview.reasons.map((r) => ({ code: r.code, label: r.label })) : null,
)
const approver = computed(() => {
  const preview = props.preview
  if (!preview?.needsApproval) return null
  const chosen = preview.approverCandidates.find((c) => c.user.id === preview.defaultApproverId)
  return chosen?.user ?? null
})
const route = computed(() =>
  props.requester
    ? plannedStops({
        requester: props.requester,
        approver: approver.value,
        needsApproval: props.preview?.needsApproval ?? false,
        autoApproved: props.preview?.autoApproval === 'requester_is_approver',
        exempt: Boolean(props.preview?.exemption),
      })
    : [],
)
</script>

<template>
  <StepperSlip
    :title="title"
    :facts="facts"
    :reasons="reasons"
    reasons-tip="Without these, it goes straight to the travel desk."
    :clear-title="preview?.exemption ? 'No approval needed' : 'No approval needed'"
    :clear-text="
      preview?.exemption
        ? `${preview.exemption.label}. It goes straight to the travel desk.`
        : 'Standard choices go straight to the travel desk.'
    "
    :route="route"
    @select-reason="(code) => $emit('select-reason', code)"
  >
    <p
      v-if="preview?.isHighPriority"
      class="flex items-start gap-2 text-[13px] leading-[18px] font-semibold text-st-negative"
    >
      <AlarmClock class="mt-px size-4 flex-none" aria-hidden="true" />
      High priority — starts within 3 days: the travel desk is alerted.
    </p>
  </StepperSlip>
</template>
