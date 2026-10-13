<script setup lang="ts">
import { Download, Search } from '@lucide/vue'
import { describeError } from '~/lib/api'
import type { TabItem } from '~/types/ui'
import { useTravelActions, useTravelCounts, useTravelRequests } from '~/modules/travel/api'
import type { TravelRequestSummary } from '~/modules/travel/api/types'
import { TRAVEL_ACTION_CONFIG } from '~/modules/travel/constants'
import { requestTitle, tripDates } from '~/modules/travel/lib/present'

/**
 * Travel desk (SCREENS §5.6, DESIGN §8.3): queues to book (high priority pinned to the top, then by
 * start) · cancellations · booking impossible · approvals (read-only overview) · all; filters kind,
 * search, "High priority only"; CSV export. Detail with driver data and the desk actions: Book…
 * (booking number, PIN, PDFs), Booking impossible…, Retry, Close, Confirm / Reject cancellation.
 */
definePageMeta({ title: 'Travel desk', access: ['travel_desk', 'it_admin'], hideMobileTitle: true })

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()

type Queue = 'to_book' | 'cancellations' | 'booking_impossible' | 'approvals' | 'all'
const QUEUE_STATUS: Record<Queue, string | undefined> = {
  to_book: 'to_book',
  cancellations: 'cancellation_requested',
  booking_impossible: 'booking_impossible',
  approvals: 'pending_approval',
  all: undefined,
}
const setQuery = (patch: Record<string, string | undefined>) =>
  router.replace({ query: { ...route.query, ...patch } })

const queue = computed<Queue>({
  get: () => (String(route.query.queue) in QUEUE_STATUS ? (route.query.queue as Queue) : 'to_book'),
  set: (value) => setQuery({ queue: value === 'to_book' ? undefined : value, selected: undefined }),
})
const kind = computed({
  get: () => (typeof route.query.kind === 'string' ? route.query.kind : 'all'),
  set: (value: string) =>
    setQuery({ kind: value === 'all' ? undefined : value, selected: undefined }),
})
const highOnly = computed({
  get: () => route.query.highPriority === 'true',
  set: (value: boolean) =>
    setQuery({ highPriority: value ? 'true' : undefined, selected: undefined }),
})
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
watchDebounced(search, (value) => setQuery({ q: value.trim() || undefined, selected: undefined }), {
  debounce: 300,
})

const counts = useTravelCounts()
const desk = computed(() => counts.data.value?.desk)
const tabs = computed<TabItem[]>(() => [
  { value: 'to_book', label: 'To book', count: desk.value?.toBook ?? null, countTone: 'you' },
  {
    value: 'cancellations',
    label: 'Cancellations',
    count: desk.value?.cancellationRequested ?? null,
    countTone: 'you',
  },
  {
    value: 'booking_impossible',
    label: 'Booking impossible',
    count: desk.value?.bookingImpossible ?? null,
  },
  { value: 'approvals', label: 'Awaiting approval', count: desk.value?.pendingApproval ?? null },
  { value: 'all', label: 'All' },
])

const params = computed(() => ({
  scope: 'all',
  status: QUEUE_STATUS[queue.value],
  kind: kind.value === 'all' ? undefined : kind.value,
  q: typeof route.query.q === 'string' ? route.query.q : undefined,
  highPriority: highOnly.value ? 'true' : undefined,
  sort: queue.value === 'all' ? '-createdAt' : 'startsAt',
  perPage: 100,
}))
const list = useTravelRequests(params)
// High priority pinned to the top of the booking queue, then by start.
const items = computed(() => {
  const rows = list.data.value?.data
  if (!rows) return null
  if (queue.value !== 'to_book') return rows
  return [...rows].sort(
    (a, b) =>
      Number(b.isHighPriority) - Number(a.isHighPriority) || a.startsAt.localeCompare(b.startsAt),
  )
})

const selectedId = computed(() =>
  typeof route.query.selected === 'string' ? route.query.selected : null,
)
const actions = useTravelActions(selectedId)
const actionBar = ref<{ setReasonError: (e: unknown) => void; done: () => void } | null>(null)
const pending = ref<string | null>(null)
const bookFor = ref<TravelRequestSummary | null>(null)
const bookOpen = computed({
  get: () => bookFor.value !== null,
  set: (value) => {
    if (!value) bookFor.value = null
  },
})

async function run(item: TravelRequestSummary, action: string, body: Record<string, unknown>) {
  if (action === 'book') {
    bookFor.value = item
    return
  }
  pending.value = action
  try {
    await actions.run(action, body)
    actionBar.value?.done()
  } catch (error) {
    actionBar.value?.setReasonError(error)
  } finally {
    pending.value = null
  }
}

const exporting = ref(false)
async function exportCsv() {
  exporting.value = true
  try {
    const { scope: _scope, perPage: _perPage, sort: _sort, ...filters } = params.value
    const blob = await api.get<Blob>('/travel/requests/export.csv', filters, { parse: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `travel-requests-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    toast.error(describeError(error))
  } finally {
    exporting.value = false
  }
}

const EMPTY: Record<Queue, { title: string; description: string }> = {
  to_book: { title: 'Nothing to book', description: 'High-priority trips will appear at the top.' },
  cancellations: {
    title: 'No cancellation requests',
    description: 'Requests to cancel a trip land here.',
  },
  booking_impossible: {
    title: 'No failed bookings',
    description: 'Trips you could not book wait here for a retry.',
  },
  approvals: {
    title: 'Nothing awaits approval',
    description: 'Trips waiting for a manager show here, read only.',
  },
  all: {
    title: 'No travel requests match',
    description: 'Try another search or clear the filters.',
  },
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <SplitInbox
      v-model:tab="queue"
      v-model:filter="kind"
      title="Travel desk"
      :count-label="items ? `${items.length} in this queue` : undefined"
      :tabs="tabs"
      :filters="[
        { value: 'all', label: 'All' },
        { value: 'car', label: 'Car' },
        { value: 'train', label: 'Train' },
        { value: 'flight', label: 'Flight' },
      ]"
      :items="items"
      :item-key="(item) => item.id"
      :item-label="(item) => `${requestTitle(item)} for ${item.traveller.displayName}`"
      :loading="list.isPending.value"
      :error="list.error.value"
      :item-to="(item) => `/travel/requests/${item.id}`"
      :empty="EMPTY[queue]"
      @retry="list.refetch()"
    >
      <template #list-tools>
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative w-44">
            <Search
              class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <UiInput
              v-model="search"
              type="search"
              aria-label="Search by reference, route or traveller"
              placeholder="Search"
              class="[&_input]:h-[30px] [&_input]:pl-8 [&_input]:text-sm"
            />
          </div>
          <UiSwitch v-model="highOnly" label="High priority only" class="text-sm" />
          <UiIconButton
            :icon="Download"
            label="Export CSV"
            :loading="exporting"
            @click="exportCsv"
          />
        </div>
      </template>

      <template #item="{ item }">
        <div class="flex items-center gap-2 text-sm">
          <TravelKindIcon :kind="item.kind" />
          <span class="mono text-ink-subtle">{{ item.reference }}</span>
          <span class="ml-auto text-meta whitespace-nowrap text-ink-subtle">{{
            formatDate(item.startsAt)
          }}</span>
        </div>
        <p class="mt-0.5 text-[14.5px] leading-5 font-semibold">{{ item.route }}</p>
        <p class="text-sm text-ink-muted">
          {{ item.traveller.displayName }} · {{ tripDates(item.startsAt, item.endsAt) }}
        </p>
        <div class="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <PriorityFlag v-if="item.isHighPriority" :starts-at="item.startsAt" high />
          <StatusBadge
            v-if="queue === 'all' || queue === 'approvals'"
            enum="travelStatus"
            :value="item.status"
            :available-actions="item.availableActions"
          />
          <TravelApprovalChip v-else :request="item" />
        </div>
      </template>

      <template #detail-title="{ item }">{{ requestTitle(item) }}</template>
      <template #detail-meta="{ item }">
        <TravelKindIcon :kind="item.kind" labelled />
        <span aria-hidden="true">·</span><span>{{ item.traveller.displayName }}</span>
        <span aria-hidden="true">·</span
        ><span class="mono text-ink-subtle">{{ item.reference }}</span>
      </template>
      <template #detail-actions="{ item }">
        <ActionBar
          ref="actionBar"
          :actions="
            item.availableActions.filter(
              (a) => !['approve', 'decline', 'withdraw', 'request_cancellation'].includes(a),
            )
          "
          :config="TRAVEL_ACTION_CONFIG"
          :pending="pending"
          @run="(action, body) => run(item, action, body)"
        />
      </template>
      <template #detail="{ item }">
        <TravelSplitDetail :item="item" why="Your desk handles this queue." />
      </template>
    </SplitInbox>

    <TravelBookDialog v-model:open="bookOpen" :request="bookFor" />
  </div>
</template>
