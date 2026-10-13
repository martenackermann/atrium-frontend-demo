<script setup lang="ts">
import { ExternalLink, Hotel, TicketCheck } from '@lucide/vue'
import { isApiError } from '~/lib/api'
import type { Decision } from '~/types/api'
import type { FactItem } from '~/types/ui'
import { useParticipation, useParticipationTimeline } from '~/modules/training/api'
import { FORMAT_LABEL } from '~/modules/training/constants'
import { participationRoute } from '~/modules/training/route'

/**
 * Participation detail (SCREENS §4.3): header with ActionBar; training facts and documents;
 * approval path with decisions; hotel; learning goals (#goals); booking; feedback rounds;
 * side column with the lifecycle diagram and the timeline.
 */
definePageMeta({ title: 'Participation' })

const route = useRoute()
const enums = useEnums()
const id = computed(() => String(route.params.id))
const query = useParticipation(id)
const timeline = useParticipationTimeline(id)
const p = computed(() => query.data.value)

watchEffect(() => {
  const error = query.error.value
  if (isApiError(error) && error.status === 404)
    throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
})
useBreadcrumbTail(() => p.value?.request.reference)

// Scroll to #goals once loaded (links from the inbox and the goals reminder).
watch(
  () => Boolean(p.value),
  async (loaded) => {
    if (!loaded || route.hash !== '#goals') return
    await nextTick()
    document.getElementById('goals')?.scrollIntoView({ block: 'start' })
  },
)

const facts = computed<FactItem[]>(() => {
  const r = p.value?.request
  if (!r) return []
  return [
    { label: 'Provider', value: r.provider },
    {
      label: 'Dates',
      value: formatDateRange(r.startsOn, r.endsOn, { weekday: true }),
      detail: `${(daysFromToday(r.startsOn) ?? 0) < 0 ? 'Started' : 'Starts'} ${formatRelativeDay(r.startsOn)}`,
    },
    { label: 'Format', value: FORMAT_LABEL[r.format], detail: r.location },
    { label: 'Cost per attendee', value: formatMoney(r.cost), mono: true },
    {
      label: 'Cost centre',
      value: p.value!.costCenter.code,
      detail: p.value!.costCenter.name,
      mono: true,
    },
    { label: 'Requested by', value: r.requester.displayName, detail: formatDate(r.createdAt) },
    { label: 'Certificate', value: r.certificateExpected ? 'Expected' : 'Not expected' },
    {
      label: 'Reimbursement agreement',
      value: r.reimbursementAgreement ? 'Required' : 'Not required',
    },
  ]
})

const stops = computed(() =>
  p.value ? participationRoute({ ...p.value, requester: p.value.request.requester }) : [],
)
const visited = computed(() => {
  const states = new Set<string>()
  for (const entry of timeline.data.value ?? []) {
    if (entry.entityType !== 'training_attendee') continue
    if (entry.fromState) states.add(entry.fromState)
    if (entry.toState) states.add(entry.toState)
  }
  return [...states]
})

function decisionText(decision: Decision | null, step: string): string | null {
  if (!decision) return null
  if (decision.autoApproval) return `${step}: ${enums.label('autoApproval', decision.autoApproval)}`
  const as =
    decision.actingAs === 'deputy'
      ? ' as deputy'
      : decision.actingAs === 'manager_chain'
        ? ' from the management chain'
        : ''
  return `${step}: ${decision.by?.displayName ?? 'Someone'}${as} on ${formatDate(decision.at)}`
}
const decisions = computed(() =>
  p.value
    ? [
        {
          text: decisionText(p.value.managerDecision, 'Manager step'),
          comment: p.value.managerDecision?.comment,
        },
        {
          text: decisionText(p.value.executiveDecision, 'Executive step'),
          comment: p.value.executiveDecision?.comment,
        },
      ].filter((row) => row.text)
    : [],
)
const statusNote = computed(() => {
  const x = p.value
  if (!x) return null
  if (x.status === 'declined' && x.declineReason)
    return { label: 'Declined because', text: x.declineReason }
  if (x.status === 'booking_impossible' && x.bookingImpossibleReason)
    return { label: 'Booking not possible', text: x.bookingImpossibleReason }
  if (x.status === 'cancellation_requested' && x.cancellationReason)
    return { label: 'Cancellation requested', text: x.cancellationReason }
  if (x.status === 'cancelled' && x.cancellationReason)
    return { label: 'Cancelled', text: x.cancellationReason }
  return null
})
</script>

<template>
  <PageBody>
    <div v-if="query.isPending.value" class="grid gap-4" aria-busy="true">
      <UiSkeleton class="h-10 w-2/3" />
      <UiSkeleton class="h-5 w-1/2" />
      <UiSkeleton class="h-48 w-full" />
    </div>
    <ProblemAlert
      v-else-if="query.error.value"
      :error="query.error.value"
      :retry="() => query.refetch()"
    />

    <template v-else-if="p">
      <PageHeader :title="p.request.topic">
        <template #meta>
          <NuxtLink :to="`/training/requests/${p.request.id}`" class="mono link">{{
            p.request.reference
          }}</NuxtLink>
          <span aria-hidden="true">·</span>
          <span>{{ p.user.displayName }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ formatDateRange(p.request.startsOn, p.request.endsOn) }}</span>
        </template>
        <template #status>
          <StatusBadge
            enum="attendeeStatus"
            :value="p.status"
            :available-actions="p.availableActions"
          />
          <PriorityFlag v-if="p.isHighPriority" high :starts-at="p.request.startsOn" />
        </template>
        <template #actions>
          <TrainingParticipationActions
            :participation-id="p.id"
            :actions="p.availableActions"
            :subject="`${p.user.displayName} on ${p.request.topic}`"
            sticky-mobile
          />
        </template>
      </PageHeader>

      <div class="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div class="grid content-start gap-10">
          <div
            v-if="statusNote"
            class="rounded-md border border-rule bg-well px-4 py-3 text-sm"
            role="note"
          >
            <strong class="font-semibold">{{ statusNote.label }}:</strong> {{ statusNote.text }}
          </div>

          <section aria-labelledby="training-title">
            <h2 id="training-title" class="font-display text-[20px] leading-7">Training</h2>
            <FactGrid class="mt-3" :items="facts" />
            <p v-if="p.request.registrationUrl" class="mt-3 text-sm">
              <a
                :href="p.request.registrationUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="link inline-flex items-center gap-1 font-medium"
              >
                Registration page <ExternalLink class="size-3.5" aria-hidden="true" />
              </a>
            </p>
            <p v-if="p.request.registrationDetails" class="mt-2 text-sm text-ink-muted">
              {{ p.request.registrationDetails }}
            </p>
            <blockquote
              v-if="p.request.requesterComment"
              class="mt-4 font-display text-[17px] leading-[25px]"
            >
              “{{ p.request.requesterComment }}”
            </blockquote>
            <div v-if="p.request.attachments.length" class="mt-4">
              <h3 class="mb-2 text-sm font-semibold">Documents</h3>
              <FileList :files="p.request.attachments" />
            </div>
          </section>

          <section aria-labelledby="path-title">
            <h2 id="path-title" class="font-display text-[20px] leading-7">Approval path</h2>
            <RoutingSlip class="mt-4" :stops="stops" variant="full" />
            <ul v-if="decisions.length" class="mt-4 grid gap-2 text-sm">
              <li v-for="row in decisions" :key="row.text!">
                {{ row.text
                }}<span v-if="row.comment" class="text-ink-muted"> — “{{ row.comment }}”</span>
              </li>
            </ul>
            <p v-if="p.escalatedFrom" class="mt-3 text-sm text-ink-muted">
              Escalated past {{ p.escalatedFrom.displayName }} (site manager): approvals for their
              team go to {{ p.approver?.displayName }}.
            </p>
          </section>

          <section v-if="p.hotel" aria-labelledby="hotel-title">
            <h2 id="hotel-title" class="flex items-center gap-2 font-display text-[20px] leading-7">
              <Hotel class="size-4 text-ink-muted" aria-hidden="true" /> Hotel
            </h2>
            <p class="mt-2">
              {{ formatDateRange(p.hotel.checkInOn, p.hotel.checkOutOn, { weekday: true }) }}
              <span v-if="p.hotel.cost" class="num text-ink-muted">
                · {{ formatMoney(p.hotel.cost) }}</span
              >
            </p>
          </section>

          <TrainingGoalsCard :participation="p" />

          <section v-if="p.bookedAt || p.attachments.length" aria-labelledby="booking-title">
            <h2
              id="booking-title"
              class="flex items-center gap-2 font-display text-[20px] leading-7"
            >
              <TicketCheck class="size-4 text-ink-muted" aria-hidden="true" /> Booking
            </h2>
            <p class="mt-2">
              <span v-if="p.bookingReference"
                >Reference <span class="mono">{{ p.bookingReference }}</span> ·
              </span>
              <span v-if="p.bookedAt">booked {{ formatDate(p.bookedAt) }}</span>
            </p>
            <FileList v-if="p.attachments.length" class="mt-3" :files="p.attachments" />
          </section>

          <section aria-labelledby="ratings-title">
            <h2 id="ratings-title" class="font-display text-[20px] leading-7">Feedback</h2>
            <p class="mt-1 text-sm text-ink-muted">
              Three short rounds: right after the training, two months later, and your manager's
              view a month after that.
            </p>
            <TrainingRatingCards class="mt-4" :ratings="p.ratings" :attendee="p.user" />
          </section>
        </div>

        <aside class="grid content-start gap-8">
          <WorkflowDiagram name="training_attendee" :current="p.status" :visited="visited" />
          <LifecycleTimeline
            :entries="timeline.data.value"
            :loading="timeline.isPending.value"
            :limit="6"
          />
        </aside>
      </div>
    </template>
  </PageBody>
</template>
