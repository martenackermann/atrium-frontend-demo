<script setup lang="ts">
import { Copy } from '@lucide/vue'
import { isApiError } from '~/lib/api'
import { useTravelActions, useTravelRequest, useTravelTimeline } from '~/modules/travel/api'
import type { TravelRequestDetail } from '~/modules/travel/api/types'
import { KIND_META, TRAVEL_ACTION_CONFIG } from '~/modules/travel/constants'
import { requestTitle, routeStops, tripDates } from '~/modules/travel/lib/present'

/**
 * Travel request detail (SCREENS §5.4, DESIGN §8.4): header (title, kind · route · reference ·
 * dates, status, high-priority flag, ActionBar + Duplicate), the routing slip, approval card,
 * booking card (PIN reveal, confirmation PDFs), kind facts and costs; side: lifecycle diagram +
 * timeline.
 */
definePageMeta({ title: 'Travel request' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const detail = useTravelRequest(id)
const timeline = useTravelTimeline(id)
const actions = useTravelActions(id)
const request = computed(() => detail.data.value ?? null)

useBreadcrumbTail(() => request.value?.reference)

watch(
  () => detail.error.value,
  (error) => {
    if (isApiError(error) && error.status === 404) {
      showError({ statusCode: 404, statusMessage: 'Not found' })
    }
  },
)

const actionBar = ref<{ setReasonError: (e: unknown) => void; done: () => void } | null>(null)
const bookOpen = ref(false)
const pending = ref<string | null>(null)

async function run(action: string, body: Record<string, unknown>) {
  if (action === 'book') {
    bookOpen.value = true
    return
  }
  pending.value = action
  try {
    await actions.run(action, body)
    actionBar.value?.done()
    await timeline.refetch()
  } catch (error) {
    actionBar.value?.setReasonError(error)
  } finally {
    pending.value = null
  }
}

function onBooked(_: TravelRequestDetail) {
  void timeline.refetch()
}

const visited = computed(() => [
  ...new Set(
    (timeline.data.value ?? [])
      .flatMap((entry) => [entry.fromState, entry.toState])
      .filter((state): state is string => Boolean(state)),
  ),
])

const statusNote = computed(() => {
  const r = request.value
  if (!r) return null
  if (r.status === 'booking_impossible' && r.bookingImpossibleReason) {
    return { title: 'Booking not possible', text: r.bookingImpossibleReason }
  }
  if (r.status === 'cancellation_requested' && r.cancellationReason) {
    return { title: 'Cancellation requested', text: r.cancellationReason }
  }
  if (r.status === 'cancelled') {
    return { title: 'Cancelled', text: r.cancellationReason ?? 'This trip was cancelled.' }
  }
  return null
})
</script>

<template>
  <PageBody>
    <div v-if="detail.isPending.value" class="grid gap-4" aria-busy="true">
      <UiSkeleton class="h-10 w-2/3" />
      <UiSkeleton class="h-5 w-1/2" />
      <UiSkeleton class="h-24 w-full" />
    </div>
    <ProblemAlert
      v-else-if="detail.error.value && !request"
      :error="detail.error.value"
      :retry="() => detail.refetch()"
    />
    <template v-else-if="request">
      <PageHeader :title="requestTitle(request)">
        <template #meta>
          <span class="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="inline-flex items-center gap-1.5">
              <TravelKindIcon :kind="request.kind" labelled />
            </span>
            <span aria-hidden="true">·</span><span>{{ request.route }}</span>
            <span aria-hidden="true">·</span
            ><span class="mono text-ink-subtle">{{ request.reference }}</span>
            <span aria-hidden="true">·</span
            ><span>{{ tripDates(request.startsAt, request.endsAt) }}</span>
          </span>
        </template>
        <template #status>
          <StatusBadge
            enum="travelStatus"
            :value="request.status"
            :available-actions="request.availableActions"
          />
          <PriorityFlag v-if="request.isHighPriority" :starts-at="request.startsAt" high />
        </template>
        <template #actions>
          <ActionBar
            ref="actionBar"
            :actions="request.availableActions"
            :config="TRAVEL_ACTION_CONFIG"
            :pending="pending"
            sticky-mobile
            @run="run"
          />
          <UiButton
            variant="ghost"
            :icon="Copy"
            :to="`${KIND_META[request.kind].to}?from=${request.id}`"
            >Duplicate</UiButton
          >
        </template>
      </PageHeader>

      <div class="mt-6 overflow-x-auto pb-1">
        <RoutingSlip :stops="routeStops(request)" variant="full" />
      </div>

      <div class="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div class="grid min-w-0 content-start gap-8">
          <section
            v-if="statusNote"
            class="rounded-xl border border-rule bg-well p-4 text-sm"
            aria-live="polite"
          >
            <p class="font-semibold">{{ statusNote.title }}</p>
            <p class="mt-1 font-display text-[17px] leading-[25px]">“{{ statusNote.text }}”</p>
          </section>
          <TravelApprovalCard
            :request="request"
            :marker="request.availableActions.includes('approve')"
          />
          <TravelBookingCard v-if="request.booking" :request="request" />
          <TravelRequestFacts :request="request" />
        </div>
        <aside class="grid min-w-0 content-start gap-6">
          <WorkflowDiagram
            name="travel_request"
            :current="request.status"
            :visited="visited"
            title="How travel requests move"
          />
          <LifecycleTimeline :entries="timeline.data.value" :loading="timeline.isPending.value" />
        </aside>
      </div>

      <TravelBookDialog v-model:open="bookOpen" :request="request" @done="onBooked" />
    </template>
  </PageBody>
</template>
