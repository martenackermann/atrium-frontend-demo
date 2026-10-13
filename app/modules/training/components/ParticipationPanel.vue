<script setup lang="ts">
import { BadgeEuro, Hotel, Quote } from '@lucide/vue'
import { whySeeingText } from '~/lib/why'
import type { FactItem } from '~/types/ui'
import { useParticipation, useParticipationTimeline } from '../api'
import type { TrainingParticipationListItem } from '../api/types'
import { FORMAT_LABEL, THRESHOLD_CENTS } from '../constants'
import { participationRoute } from '../route'

/**
 * Detail body of a participation inside a split view (SCREENS §4.5 approvals, §4.7 office):
 * "Why you're seeing this", training facts, cost with the threshold callout, route so far,
 * goals and the requester's comment (approvals) or registration, hotel and documents (office).
 */
const props = defineProps<{
  item: TrainingParticipationListItem
  mode: 'approval' | 'office'
}>()

const auth = useAuthStore()
const enums = useEnums()
const detail = useParticipation(() => props.item.id)
const timeline = useParticipationTimeline(() => props.item.id)
const d = computed(() => detail.data.value)

const why = computed(() => {
  if (props.mode !== 'approval') return null
  const principal =
    props.item.actingAs === 'deputy'
      ? props.item.status === 'pending_executive_approval'
        ? props.item.executiveApprover
        : props.item.approver
      : null
  const window = auth.me?.activeDeputyFor.find((w) => w.principal.id === principal?.id)
  return whySeeingText({
    actingAs: props.item.actingAs,
    subject: props.item.user,
    approverReason: props.item.approverReason,
    escalatedFrom: props.item.escalatedFrom,
    principal,
    deputyUntil: window?.validTo ?? null,
  })
})

const facts = computed<FactItem[]>(() => {
  const r = props.item.request
  const list: FactItem[] = [
    { label: 'Training', value: r.topic, detail: r.provider },
    {
      label: 'Dates',
      value: formatDateRange(r.startsOn, r.endsOn, { weekday: true }),
      detail: `Starts ${formatRelativeDay(r.startsOn)}`,
    },
    { label: 'Format', value: FORMAT_LABEL[r.format], detail: d.value?.request.location ?? null },
    { label: 'Cost per attendee', value: formatMoney(r.cost), mono: true },
    { label: 'Requested by', value: r.requester.displayName },
    {
      label: 'Cost centre',
      value: d.value ? `${d.value.costCenter.code}` : null,
      mono: true,
      detail: d.value?.costCenter.name,
    },
  ]
  return list
})

const route = computed(() =>
  d.value
    ? participationRoute({
        ...d.value,
        requester: d.value.request.requester,
        availableActions: d.value.availableActions,
      })
    : participationRoute({ ...props.item, requester: props.item.request.requester }),
)
const documents = computed(() => [
  ...(d.value?.request.attachments ?? []),
  ...(d.value?.attachments ?? []),
])
</script>

<template>
  <div class="grid gap-6">
    <WhySeeing v-if="why" :text="why" />

    <div
      v-if="item.request.executiveStepRequired"
      class="flex items-start gap-2.5 rounded-md border border-rule bg-st-waiting-bg px-4 py-3 text-sm text-st-waiting"
    >
      <BadgeEuro class="mt-0.5 size-4 flex-none" aria-hidden="true" />
      <p>
        {{ formatMoney(item.request.cost) }} is at or above {{ formatMoney(THRESHOLD_CENTS) }}, so
        <strong>{{ item.executiveApprover?.displayName ?? 'an executive' }}</strong> also approves
        it{{
          item.status === 'pending_executive_approval'
            ? ' — that step is now.'
            : ' after the manager.'
        }}
      </p>
    </div>

    <FactGrid :items="facts" />

    <blockquote
      v-if="mode === 'approval' && d?.request.requesterComment"
      class="flex gap-3 font-display text-[17px] leading-[25px]"
    >
      <Quote class="mt-1 size-4 flex-none text-ink-subtle" aria-hidden="true" />
      <span>“{{ d.request.requesterComment }}”</span>
    </blockquote>

    <section
      v-if="mode === 'approval' && (d?.goals.goal1 || d?.goals.goal2)"
      aria-labelledby="goals-heading"
    >
      <h3 id="goals-heading" class="text-sm font-semibold">Learning goals</h3>
      <ol class="mt-1.5 grid list-decimal gap-1 pl-5 text-sm">
        <li v-if="d.goals.goal1">{{ d.goals.goal1 }}</li>
        <li v-if="d.goals.goal2">{{ d.goals.goal2 }}</li>
      </ol>
    </section>

    <section v-if="mode === 'office'" class="grid gap-3" aria-label="Booking details">
      <FactGrid
        :columns="2"
        :items="[
          {
            label: 'Registration',
            value: d?.request.registrationUrl ?? 'No link given',
            detail: d?.request.registrationDetails,
          },
          {
            label: 'Booking reference',
            value: d?.bookingReference ?? '—',
            mono: Boolean(d?.bookingReference),
          },
          {
            label: 'Billing',
            value: d ? enums.label('billingStatus', d.request.billingStatus) : null,
            detail: d?.request.actualCost ? `Actual ${formatMoney(d.request.actualCost)}` : null,
          },
          {
            label: 'Status note',
            value: d?.cancellationReason ?? d?.bookingImpossibleReason ?? d?.declineReason ?? '—',
          },
        ]"
      />
      <p v-if="d" class="text-sm">
        <NuxtLink :to="`/training/requests/${d.request.id}`" class="link font-medium">
          Open request {{ d.request.reference }}
        </NuxtLink>
        <span class="text-ink-muted"> · billing, all attendees and documents</span>
      </p>
    </section>

    <div v-if="item.hotelNeeded && d?.hotel" class="flex items-center gap-2.5 text-sm">
      <Hotel class="size-4 text-ink-muted" aria-hidden="true" />
      Hotel {{ formatDateRange(d.hotel.checkInOn, d.hotel.checkOutOn) }}
      <span v-if="d.hotel.cost" class="num text-ink-muted">· {{ formatMoney(d.hotel.cost) }}</span>
    </div>

    <section aria-labelledby="route-heading">
      <h3 id="route-heading" class="mb-3 text-sm font-semibold">Route</h3>
      <RoutingSlip :stops="route" variant="full" />
    </section>

    <section v-if="documents.length" aria-labelledby="docs-heading">
      <h3 id="docs-heading" class="mb-2 text-sm font-semibold">Documents</h3>
      <FileList :files="documents" />
    </section>

    <LifecycleTimeline
      :entries="timeline.data.value"
      :loading="timeline.isPending.value"
      :limit="3"
    />
  </div>
</template>
