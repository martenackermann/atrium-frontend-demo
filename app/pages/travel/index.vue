<script setup lang="ts">
import { ChevronDown, Copy, Ellipsis, Eye, Plus } from '@lucide/vue'
import { useTravelRequests } from '~/modules/travel/api'
import type { TravelKind, TravelRequestSummary } from '~/modules/travel/api/types'
import { KIND_META } from '~/modules/travel/constants'
import { approvalChip, tripDates } from '~/modules/travel/lib/present'
import type { DataTableColumn, TabItem } from '~/types/ui'

/**
 * My trips (SCREENS §5.1): tabs All · Car · Train · Flight (`kind`), scope `mine` (traveller,
 * requester or companion), filters status / dates / q in the URL, "New request" menu, row menu
 * with Duplicate (→ `/travel/new/{kind}?from={id}`).
 */
definePageMeta({ title: 'My trips' })

const enums = useEnums()
const list = useListQuery({
  filters: ['kind', 'status', 'from', 'to'],
  multi: ['status'],
  defaultSort: '-createdAt',
})
const query = useTravelRequests(() => ({ scope: 'mine', ...list.apiQuery.value }))

const kindTab = computed({
  get: () => (list.state.value.filters.kind as string | undefined) || 'all',
  set: (value: string) => list.setFilter('kind', value === 'all' ? undefined : value),
})
const tabs: TabItem[] = [
  { value: 'all', label: 'All' },
  { value: 'car', label: 'Car' },
  { value: 'train', label: 'Train' },
  { value: 'flight', label: 'Flight' },
]
const status = computed({
  get: () => ((list.state.value.filters.status as string[] | undefined) ?? [])[0] ?? 'any',
  set: (value: string) => list.setFilter('status', value === 'any' ? undefined : [value]),
})
const statusOptions = computed(() => [
  { value: 'any', label: 'Any status' },
  ...enums.options('travelStatus').map((option) => ({
    value: String(option.value),
    label: option.label,
  })),
])

const columns: DataTableColumn<TravelRequestSummary>[] = [
  {
    key: 'reference',
    label: 'Reference',
    format: 'mono',
    required: true,
    mobile: 'hidden',
    width: '130px',
  },
  { key: 'route', label: 'Trip', required: true, mobile: 'title' },
  {
    key: 'startsAt',
    label: 'Dates',
    sort: 'startsAt',
    value: (row) => tripDates(row.startsAt, row.endsAt),
    mobile: 'meta',
  },
  { key: 'status', label: 'Status', mobile: 'status', width: '200px' },
  {
    key: 'approval',
    label: 'Approval',
    value: (row) => approvalChip(row).label,
    mobile: 'meta',
  },
  {
    key: 'approver',
    label: 'Approver',
    value: (row) => row.approver?.displayName ?? '—',
    hidden: true,
  },
  {
    key: 'actions',
    label: 'Actions',
    align: 'right',
    required: true,
    width: '56px',
    mobile: 'hidden',
  },
]

const newMenu = (Object.keys(KIND_META) as TravelKind[]).map((kind) => ({
  kind,
  ...KIND_META[kind],
}))
</script>

<template>
  <PageBody wide>
    <PageHeader
      title="My trips"
      subtitle="Rental cars, train journeys and flights you travel on or requested."
    >
      <template #actions>
        <UiMenu aria-label="New travel request">
          <template #trigger>
            <UiButton variant="primary" :icon="Plus" :icon-right="ChevronDown"
              >New request</UiButton
            >
          </template>
          <UiMenuItem v-for="item in newMenu" :key="item.kind" :icon="item.icon" :to="item.to">{{
            item.newLabel
          }}</UiMenuItem>
        </UiMenu>
      </template>
    </PageHeader>

    <UiTabs v-model="kindTab" :tabs="tabs" aria-label="Kind of trip" class="mt-6" />

    <DataTable
      class="mt-4"
      :columns="columns"
      :rows="query.data.value?.data"
      :meta="query.data.value?.meta"
      :loading="query.isPending.value"
      :error="query.error.value"
      :list="list"
      noun="trips"
      storage-key="travel-mine"
      search-placeholder="Search trips"
      :row-to="(row) => `/travel/requests/${row.id}`"
      :empty="{
        title: 'No trips yet',
        description: 'Book a rental car, a train journey or a flight.',
      }"
      @retry="query.refetch()"
    >
      <template #filters>
        <UiSelect v-model="status" :options="statusOptions" aria-label="Status" class="w-52" />
        <DateRangeFilter
          :from="(list.state.value.filters.from as string) || null"
          :to="(list.state.value.filters.to as string) || null"
          @change="
            (range) => list.update({ filters: { from: range.from ?? '', to: range.to ?? '' } })
          "
        />
      </template>
      <template #cell-route="{ row }">
        <NuxtLink
          :to="`/travel/requests/${row.id}`"
          class="inline-flex items-center gap-2 font-medium text-ink no-underline hover:underline"
        >
          <TravelKindIcon :kind="row.kind" />
          {{ row.route }}
        </NuxtLink>
        <PriorityFlag v-if="row.isHighPriority" :starts-at="row.startsAt" high class="ml-2" />
      </template>
      <template #cell-status="{ row }">
        <StatusBadge
          enum="travelStatus"
          :value="row.status"
          :available-actions="row.availableActions"
        />
      </template>
      <template #cell-approval="{ row }">
        <TravelApprovalChip :request="row" />
      </template>
      <template #cell-actions="{ row }">
        <UiMenu :aria-label="`Actions for ${row.reference}`">
          <template #trigger>
            <UiIconButton :icon="Ellipsis" :label="`Actions for ${row.reference}`" />
          </template>
          <UiMenuItem :icon="Eye" :to="`/travel/requests/${row.id}`">Open</UiMenuItem>
          <UiMenuItem :icon="Copy" :to="`${KIND_META[row.kind].to}?from=${row.id}`"
            >Duplicate</UiMenuItem
          >
        </UiMenu>
      </template>
    </DataTable>
  </PageBody>
</template>
