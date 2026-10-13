<script setup lang="ts">
import { useTravelRequest, useTravelTimeline } from '../api'
import type { TravelRequestDetail, TravelRequestSummary } from '../api/types'
import { routeStops } from '../lib/present'

/**
 * Detail body of the travel split views (approvals, travel desk — DESIGN §8.3): status + flags +
 * "Requested by", the "Why you're seeing this" line, the reasons box (marker region when the viewer
 * decides) with the requester's words, the facts, the booking card, the route and the activity.
 */
const props = defineProps<{
  item: TravelRequestSummary
  /** "Why you're seeing this" (string, or built from the loaded detail). */
  why?: string | ((request: TravelRequestDetail) => string) | null
}>()
const detail = useTravelRequest(() => props.item.id)
const timeline = useTravelTimeline(() => props.item.id)
const request = computed(() => detail.data.value ?? null)
const whyText = computed(() =>
  typeof props.why === 'function' ? (request.value ? props.why(request.value) : null) : props.why,
)
const decides = computed(() => props.item.availableActions.includes('approve'))
const words = computed(
  () => request.value?.car?.specialEquipmentReason ?? request.value?.comment ?? null,
)
</script>

<template>
  <div class="grid gap-6">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <StatusBadge
        enum="travelStatus"
        :value="item.status"
        :available-actions="item.availableActions"
      />
      <PriorityFlag v-if="item.isHighPriority" :starts-at="item.startsAt" high />
      <UiMiniChip v-if="item.approverReason === 'site_manager_escalation'" label="Escalated" />
      <span class="ml-auto inline-flex items-center gap-2 text-[13.5px] text-ink-muted">
        Requested by
        <UiAvatar
          :name="item.requester.displayName"
          :initials="item.requester.initials"
          size="sm"
        />
        <b class="font-medium text-ink">{{ item.requester.displayName }}</b>
      </span>
    </div>
    <WhySeeing v-if="whyText" :text="whyText" />

    <section
      v-if="item.needsApproval"
      class="grid gap-3 rounded-xl border p-5"
      :class="
        decides
          ? 'border-[color-mix(in_srgb,var(--marker-strong)_30%,transparent)] bg-marker-wash'
          : 'border-rule bg-well'
      "
    >
      <h3 class="text-[14.5px] font-[650]">
        {{ item.status === 'pending_approval' ? 'Needs' : 'Needed' }} approval because…
      </h3>
      <ReasonChips :reasons="item.approvalReasons" :in-marker="decides" />
      <p v-if="words" class="font-display text-[17px] leading-[25px]">“{{ words }}”</p>
    </section>
    <p v-else-if="item.approvalExemption" class="text-sm text-ink-muted">
      {{ item.approvalExemption.label }}.
    </p>

    <div v-if="detail.isPending.value" class="grid gap-3">
      <UiSkeleton class="h-5 w-1/2" /><UiSkeleton class="h-24 w-full" />
    </div>
    <ProblemAlert
      v-else-if="detail.error.value"
      :error="detail.error.value"
      :retry="() => detail.refetch()"
    />
    <template v-else-if="request">
      <section
        v-if="request.bookingImpossibleReason || request.cancellationReason"
        class="rounded-xl border border-rule bg-well p-4 text-sm"
      >
        <p class="font-semibold">
          {{ request.bookingImpossibleReason ? 'Booking not possible' : 'Cancellation reason' }}
        </p>
        <p class="mt-1 font-display text-[17px] leading-[25px]">
          “{{ request.bookingImpossibleReason ?? request.cancellationReason }}”
        </p>
      </section>
      <TravelBookingCard v-if="request.booking" :request="request" />
      <TravelRequestFacts :request="request" :hide-quote="item.needsApproval" />
      <section aria-labelledby="split-route">
        <h3 id="split-route" class="mb-3 text-lg font-[650]">Route</h3>
        <div class="overflow-x-auto pb-1">
          <RoutingSlip :stops="routeStops(request)" variant="full" />
        </div>
      </section>
      <LifecycleTimeline
        :entries="timeline.data.value"
        :loading="timeline.isPending.value"
        title="Activity"
      />
      <WorkflowDiagram
        name="travel_request"
        :current="request.status"
        title="How travel requests move"
      />
    </template>
  </div>
</template>
