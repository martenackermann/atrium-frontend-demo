<script setup lang="ts">
import { Download, Hotel } from '@lucide/vue'
import { describeError } from '~/lib/api'
import type { TabItem } from '~/types/ui'
import { useParticipations, useTrainingCounts } from '~/modules/training/api'
import type { TrainingParticipationListItem } from '~/modules/training/api/types'

/**
 * Training office queues (SCREENS §4.7): to book · cancellations · booking impossible ·
 * approvals (read-only overview) · all — split view over `/training/participations?scope=all`,
 * with search, date range, "High priority only" and CSV export.
 */
definePageMeta({
  title: 'Training office',
  access: ['training_office', 'it_admin'],
  hideMobileTitle: true,
})

type Queue = 'to_book' | 'cancellations' | 'booking_impossible' | 'approvals' | 'all'

const QUEUE_STATUS: Record<Queue, string | undefined> = {
  to_book: 'to_book',
  cancellations: 'cancellation_requested',
  booking_impossible: 'booking_impossible',
  approvals: 'pending_manager_approval,pending_executive_approval',
  all: undefined,
}
const EMPTY: Record<Queue, { title: string; description: string }> = {
  to_book: {
    title: 'Nothing to book right now.',
    description: 'Approved trainings land here; high-priority ones come first.',
  },
  cancellations: {
    title: 'No cancellation requests.',
    description: 'When an attendee asks to cancel, you confirm or reject it here.',
  },
  booking_impossible: {
    title: 'No failed bookings.',
    description: 'Bookings you mark as impossible wait here for a retry.',
  },
  approvals: {
    title: 'Nothing waiting for approval.',
    description: 'Requests awaiting a manager or an executive show here, read-only.',
  },
  all: { title: 'No participations match.', description: 'Clear the search or the dates.' },
}

const api = useApi()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const counts = useTrainingCounts()

const queue = computed<Queue>({
  get: () => {
    const raw = route.query.queue
    return typeof raw === 'string' && raw in QUEUE_STATUS ? (raw as Queue) : 'to_book'
  },
  set: (value) =>
    router.replace({
      query: {
        ...route.query,
        queue: value === 'to_book' ? undefined : value,
        selected: undefined,
      },
    }),
})
const tabs = computed<TabItem<Queue>[]>(() => {
  const office = counts.data.value?.office
  return [
    { value: 'to_book', label: 'To book', count: office?.toBook ?? null, countTone: 'you' },
    {
      value: 'cancellations',
      label: 'Cancellations',
      count: office?.cancellationRequested ?? null,
      countTone: 'you',
    },
    {
      value: 'booking_impossible',
      label: 'Booking impossible',
      count: office?.bookingImpossible ?? null,
    },
    { value: 'approvals', label: 'Awaiting approval', count: office?.pendingApproval ?? null },
    { value: 'all', label: 'All' },
  ]
})

const q = computed({
  get: () => (typeof route.query.q === 'string' ? route.query.q : ''),
  set: (value: string) => patchQuery(router, { q: value || undefined }),
})
const search = ref(q.value)
watchDebounced(search, (value) => (q.value = value.trim()), { debounce: 300 })
const highOnly = computed({
  get: () => route.query.high === 'true',
  set: (value) => patchQuery(router, { high: value ? 'true' : undefined }),
})
const range = computed({
  get: () => ({
    from: typeof route.query.from === 'string' ? route.query.from : null,
    to: typeof route.query.to === 'string' ? route.query.to : null,
  }),
  set: (value: { from: string | null; to: string | null }) =>
    patchQuery(router, { from: value.from || undefined, to: value.to || undefined }),
})

const filters = computed(() => ({
  status: QUEUE_STATUS[queue.value],
  q: q.value || undefined,
  from: range.value.from ?? undefined,
  to: range.value.to ?? undefined,
  highPriority: highOnly.value ? 'true' : undefined,
}))
const params = computed(() => ({
  scope: 'all',
  perPage: 100,
  sort: queue.value === 'all' ? '-createdAt' : 'startsOn',
  ...filters.value,
}))
const list = useParticipations(params)
const items = computed(() => {
  const rows = list.data.value?.data ?? []
  // High priority pinned to the top of the booking queue (DESIGN §8.3).
  return queue.value === 'to_book'
    ? [...rows].sort((a, b) => Number(b.isHighPriority) - Number(a.isHighPriority))
    : rows
})

const exporting = ref(false)
async function exportCsv() {
  exporting.value = true
  try {
    const blob = await api.get<Blob>('/training/participations/export.csv', filters.value, {
      parse: 'blob',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'training-participations.csv'
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    toast.error(describeError(error))
  } finally {
    exporting.value = false
  }
}

const actions = ref<{ trigger: (action: string) => void }>()
const label = (item: TrainingParticipationListItem) =>
  `${item.request.topic} – ${item.user.displayName}`
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <SplitInbox
      v-model:tab="queue"
      title="Training office"
      :count-label="list.data.value ? `${list.data.value.meta.total} in this queue` : undefined"
      :tabs="tabs"
      :sort-note="queue === 'all' ? 'Newest first' : 'Earliest start first'"
      :items="items"
      :item-key="(item) => item.id"
      :item-label="label"
      :loading="list.isPending.value"
      :error="list.error.value"
      :item-to="(item) => `/training/participations/${item.id}`"
      :empty="EMPTY[queue]"
      @retry="list.refetch()"
    >
      <template #list-tools>
        <div class="grid gap-2">
          <UiInput
            v-model="search"
            type="search"
            placeholder="Search topic, provider, attendee or TRN-…"
            aria-label="Search participations"
          />
          <div class="flex flex-wrap items-center gap-3">
            <DateRangeFilter
              :from="range.from"
              :to="range.to"
              label="Starts"
              @change="(value) => (range = value)"
            />
            <UiSwitch v-model="highOnly" label="High priority only" class="text-sm" />
            <UiButton
              size="sm"
              variant="ghost"
              :icon="Download"
              :loading="exporting"
              @click="exportCsv"
            >
              Export CSV
            </UiButton>
          </div>
        </div>
      </template>
      <template #item="{ item }">
        <div class="flex items-center gap-2 text-sm text-ink-muted">
          <span class="mono text-ink-subtle">{{ item.request.reference }}</span>
          <span>· {{ item.user.displayName }}</span>
          <time
            class="ml-auto text-meta whitespace-nowrap text-ink-subtle"
            :datetime="item.updatedAt"
            >{{ formatAge(item.updatedAt) }}</time
          >
        </div>
        <p class="mt-0.5 text-[14.5px] leading-5 font-semibold">{{ item.request.topic }}</p>
        <p class="text-sm text-ink-muted">
          {{ item.request.provider }} ·
          {{ formatDateRange(item.request.startsOn, item.request.endsOn, { weekday: true }) }}
        </p>
        <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <StatusBadge
            enum="attendeeStatus"
            :value="item.status"
            :available-actions="item.availableActions"
          />
          <PriorityFlag v-if="item.isHighPriority" high :starts-at="item.request.startsOn" />
          <UiMiniChip v-if="item.hotelNeeded" :icon="Hotel" label="Hotel" />
        </div>
      </template>

      <template #detail-title="{ item }">{{ item.request.topic }}</template>
      <template #detail-meta="{ item }">
        <span>{{ item.user.displayName }}</span>
        <span aria-hidden="true">·</span>
        <span class="mono text-ink-subtle">{{ item.request.reference }}</span>
      </template>
      <template #detail-actions="{ item }">
        <TrainingParticipationActions
          ref="actions"
          :participation-id="item.id"
          :actions="item.availableActions"
          :subject="`${item.user.displayName} on ${item.request.topic}`"
          sticky-mobile
        />
      </template>
      <template #detail="{ item }">
        <div class="mb-5 flex flex-wrap items-center gap-2.5">
          <StatusBadge
            enum="attendeeStatus"
            :value="item.status"
            :available-actions="item.availableActions"
          />
          <PriorityFlag v-if="item.isHighPriority" high :starts-at="item.request.startsOn" />
        </div>
        <TrainingParticipationPanel :item="item" mode="office" />
      </template>
    </SplitInbox>
  </div>
</template>
