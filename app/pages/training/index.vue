<script setup lang="ts">
import { Plus, Star, Target } from '@lucide/vue'
import type { DataTableColumn, TabItem } from '~/types/ui'
import { useParticipations, useTrainingRequests } from '~/modules/training/api'
import type {
  TrainingParticipationListItem,
  TrainingRequestSummary,
} from '~/modules/training/api/types'
import { ATTENDEE_STATUSES } from '~/modules/training/constants'
import { nextStepText } from '~/modules/training/route'

/**
 * My training (SCREENS §4.1): "My participations" (`scope=mine`) and "Requests I created"
 * (`scope=created`), with search, status and date filters in the URL.
 */
definePageMeta({ title: 'My training' })

type Tab = 'participations' | 'requests'
const route = useRoute()
const router = useRouter()
const enums = useEnums()
const tab = computed<Tab>({
  get: () => (route.query.tab === 'requests' ? 'requests' : 'participations'),
  set: (value) =>
    router.replace({ query: { tab: value === 'participations' ? undefined : value } }),
})
const tabs: TabItem<Tab>[] = [
  { value: 'participations', label: 'My participations' },
  { value: 'requests', label: 'Requests I created' },
]

const list = useListQuery({
  filters: ['status', 'from', 'to'],
  multi: ['status'],
  defaultSort: '-createdAt',
})
const participations = useParticipations(
  computed(() => ({ ...list.apiQuery.value, scope: 'mine' })),
  computed(() => tab.value === 'participations'),
)
const requestsQuery = computed(() => {
  const { status, ...rest } = list.apiQuery.value as Record<string, string | number>
  return { ...rest, scope: 'created', ...(status ? { attendeeStatus: status } : {}) }
})
const requests = useTrainingRequests(requestsQuery)

const statusOptions = computed(() =>
  ATTENDEE_STATUSES.map((value) => ({ value, label: enums.label('attendeeStatus', value) })),
)
const ANY = 'any'
const statusFilter = computed<string>({
  get: () => {
    const value = list.state.value.filters.status
    return Array.isArray(value) && value.length ? value[0]! : ANY
  },
  set: (value) => list.setFilter('status', value === ANY ? undefined : [value]),
})
const range = computed(() => ({
  from: (list.state.value.filters.from as string) || null,
  to: (list.state.value.filters.to as string) || null,
}))
function setRange(value: { from: string | null; to: string | null }) {
  list.update({ filters: { from: value.from ?? '', to: value.to ?? '' } })
}

const participationColumns: DataTableColumn<TrainingParticipationListItem>[] = [
  {
    key: 'training',
    label: 'Training',
    required: true,
    mobile: 'title',
    value: (row) => row.request.topic,
  },
  {
    key: 'dates',
    label: 'Dates',
    sort: 'startsOn',
    value: (row) => formatDateRange(row.request.startsOn, row.request.endsOn),
    mobile: 'meta',
  },
  { key: 'status', label: 'Status', mobile: 'status' },
  { key: 'next', label: 'Next step', value: (row) => nextStepText(row) },
  {
    key: 'approver',
    label: 'Approver',
    value: (row) => row.approver?.displayName ?? '—',
    hidden: true,
  },
  { key: 'extras', label: 'Goals & feedback' },
]
const requestColumns: DataTableColumn<TrainingRequestSummary>[] = [
  { key: 'reference', label: 'Reference', format: 'mono', required: true, width: '120px' },
  { key: 'topic', label: 'Training', sort: 'topic', mobile: 'title' },
  {
    key: 'dates',
    label: 'Dates',
    sort: 'startsOn',
    value: (row) => formatDateRange(row.startsOn, row.endsOn),
    mobile: 'meta',
  },
  { key: 'attendees', label: 'Attendees' },
  {
    key: 'cost',
    label: 'Per attendee',
    sort: 'cost',
    align: 'right',
    value: (row) => formatMoney(row.cost),
  },
  {
    key: 'createdAt',
    label: 'Created',
    sort: 'createdAt',
    value: (row) => formatAge(row.createdAt),
  },
]
</script>

<template>
  <PageBody wide>
    <PageHeader title="My training" subtitle="Your participations and the requests you created.">
      <template #actions>
        <UiButton variant="primary" :icon="Plus" to="/training/new">Request training</UiButton>
      </template>
    </PageHeader>
    <UiTabs v-model="tab" :tabs="tabs" class="mt-5" aria-label="My training" />

    <DataTable
      v-if="tab === 'participations'"
      class="mt-4"
      :columns="participationColumns"
      :rows="participations.data.value?.data"
      :meta="participations.data.value?.meta"
      :loading="participations.isPending.value"
      :error="participations.error.value"
      :list="list"
      :row-to="(row) => `/training/participations/${row.id}`"
      noun="participations"
      storage-key="training-participations"
      search-placeholder="Search topic, provider or TRN-…"
      caption="My participations"
      :empty="{
        title: 'No trainings yet',
        description: 'Request one for yourself or your team.',
      }"
      @retry="participations.refetch()"
    >
      <template #filters>
        <UiSelect
          v-model="statusFilter"
          size="sm"
          aria-label="Status"
          :options="[{ value: ANY, label: 'Any status' }, ...statusOptions]"
          class="w-52"
        />
        <DateRangeFilter :from="range.from" :to="range.to" label="Starts" @change="setRange" />
      </template>
      <template #cell-training="{ row }">
        <span class="font-medium">{{ row.request.topic }}</span>
        <span class="block text-meta text-ink-subtle">{{ row.request.provider }}</span>
      </template>
      <template #cell-status="{ row }">
        <span class="inline-flex flex-wrap items-center gap-2">
          <StatusBadge
            enum="attendeeStatus"
            :value="row.status"
            :available-actions="row.availableActions"
          />
          <PriorityFlag v-if="row.isHighPriority" high :starts-at="row.request.startsOn" />
        </span>
      </template>
      <template #cell-extras="{ row }">
        <span class="inline-flex flex-wrap items-center gap-2">
          <UiMiniChip v-if="row.goalsSet" :icon="Target" label="Goals set" />
          <NuxtLink
            v-if="
              row.openRating &&
              (row.openRating.state === 'due' || row.openRating.state === 'overdue')
            "
            :to="`/training/ratings/${row.openRating.id}`"
            class="inline-flex items-center gap-1 text-[12.5px] font-semibold"
            :class="row.openRating.state === 'overdue' ? 'text-st-negative' : 'text-marker-text'"
          >
            <Star class="size-3.5" aria-hidden="true" />
            {{ row.openRating.state === 'overdue' ? 'Rating overdue' : 'Rating due' }}
          </NuxtLink>
        </span>
      </template>
    </DataTable>

    <DataTable
      v-else
      class="mt-4"
      :columns="requestColumns"
      :rows="requests.data.value?.data"
      :meta="requests.data.value?.meta"
      :loading="requests.isPending.value"
      :error="requests.error.value"
      :list="list"
      :row-to="(row) => `/training/requests/${row.id}`"
      noun="requests"
      search-placeholder="Search topic, provider or TRN-…"
      caption="Requests I created"
      :empty="{
        title: 'No requests yet',
        description: 'Request a training for yourself or your team; it shows up here.',
      }"
      @retry="requests.refetch()"
    >
      <template #filters>
        <DateRangeFilter :from="range.from" :to="range.to" label="Starts" @change="setRange" />
      </template>
      <template #cell-attendees="{ row }">
        <TrainingStatusBar :counts="row.statusCounts" :total="row.attendeeCount" />
      </template>
    </DataTable>
  </PageBody>
</template>
