<script setup lang="ts">
import { CircleCheck, Crown, Stamp } from '@lucide/vue'
import type { TravelRequestDetail } from '../api/types'

/**
 * Approval card (SCREENS §5.4): reasons as chips ("Needs approval because…") or the exemption
 * text; the approver (+ "escalated past {site manager}", "chosen manually"); the decision (who,
 * as what, comment, auto-approval label). `marker` renders the needs-you region (approver's view).
 */
const props = defineProps<{ request: TravelRequestDetail; marker?: boolean }>()
const enums = useEnums()

const decision = computed(() => props.request.approval)
const declined = computed(() => props.request.status === 'declined')
const actingLabel = computed(() => {
  const as = decision.value?.actingAs
  if (!as || as === 'approver' || as === 'system') return null
  return as === 'deputy' ? 'as deputy' : as === 'manager_chain' ? 'as manager in the chain' : null
})
</script>

<template>
  <section
    class="grid gap-3 rounded-xl border p-5"
    :class="
      marker
        ? 'border-[color-mix(in_srgb,var(--marker-strong)_30%,transparent)] bg-marker-wash'
        : 'border-rule bg-sheet'
    "
    aria-labelledby="approval-title"
  >
    <template v-if="request.approvalExemption">
      <h2 id="approval-title" class="flex items-center gap-2 text-[14.5px] font-[650]">
        <Crown class="size-4 text-ink-muted" aria-hidden="true" />No approval needed
      </h2>
      <p class="text-sm text-ink-muted">{{ request.approvalExemption.label }}.</p>
    </template>
    <template v-else-if="!request.needsApproval">
      <h2
        id="approval-title"
        class="flex items-center gap-2 text-[14.5px] font-[650] text-st-positive"
      >
        <CircleCheck class="size-4" aria-hidden="true" />No approval needed
      </h2>
      <p class="text-sm text-ink-muted">Standard choices go straight to the travel desk.</p>
    </template>
    <template v-else>
      <h2 id="approval-title" class="flex items-center gap-2 text-[14.5px] font-[650]">
        <Stamp class="size-4 text-st-waiting" aria-hidden="true" />{{
          request.status === 'pending_approval' ? 'Needs' : 'Needed'
        }}
        approval because…
      </h2>
      <ReasonChips :reasons="request.approvalReasons" :in-marker="marker" />
      <p v-if="request.approver" class="text-sm text-ink-muted">
        Approver:
        <b class="font-semibold text-ink">{{ request.approver.displayName }}</b>
        <template v-if="request.approverReason">
          · {{ enums.label('approverReason', request.approverReason) }}</template
        >
        <template v-if="request.escalatedFrom">
          · escalated past {{ request.escalatedFrom.displayName }} (site manager)</template
        >
        <template v-if="request.approverSelection === 'manual'"> · chosen manually</template>
      </p>
    </template>

    <div v-if="decision" class="border-t border-rule pt-3 text-sm">
      <p>
        <b class="font-semibold">{{
          decision.autoApproval
            ? enums.label('autoApproval', decision.autoApproval)
            : declined
              ? 'Declined'
              : 'Approved'
        }}</b>
        <template v-if="decision.by && !decision.autoApproval">
          by {{ decision.by.displayName
          }}<template v-if="actingLabel"> ({{ actingLabel }})</template></template
        >
        · <time :datetime="decision.at">{{ formatDateTime(decision.at) }}</time>
      </p>
      <p
        v-if="declined && request.declineReason"
        class="mt-1.5 font-display text-[17px] leading-[25px]"
      >
        “{{ request.declineReason }}”
      </p>
      <p v-else-if="decision.comment" class="mt-1.5 text-ink-muted">“{{ decision.comment }}”</p>
    </div>
  </section>
</template>
