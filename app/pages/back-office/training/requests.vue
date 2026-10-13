<script setup lang="ts">
import type { DataTableColumn } from '~/types/ui'
import { useTrainingRequests } from '~/modules/training/api'
import type { TrainingRequestSummary } from '~/modules/training/api/types'
import { ATTENDEE_STATUSES } from '~/modules/training/constants'

/**
 * All training requests (SCREENS §4.8): `/training/requests?scope=all` with billing status,
 * attendee status, date range and search; the row opens the request with the back-office panel.
 */
definePageMeta({ title: 'All training requests', access: ['training_office', 'it_admin'] })

const enums = useEnums()
const list = useListQuery({
  filters: ['billingStatus', 'attendeeStatus', 'from', 'to'],
  defaultSort: '-createdAt',
})
const requests = useTrainingRequests(computed(() => ({ ...list.apiQuery.value, scope: 'all' })))

const ANY = 'any'
const filterModel = (key: string) =>
  computed<string>({
    get: () => String(list.state.value.filters[key] || ANY),
    set: (value) => list.setFilter(key, value === ANY ? undefined : value),
  })
const billingFilter = filterModel('billingStatus')
const statusFilter = filterModel('attendeeStatus')
const range = computed(() => ({
  from: (list.state.value.filters.from as string) || null,
  to: (list.state.value.filters.to as string) || null,
}))
const setRange = (value: { from: string | null; to: string | null }) =>
  list.update({ filters: { from: value.from ?? '', to: value.to ?? '' } })

const columns: DataTableColumn<TrainingRequestSummary>[] = [
  { key: 'reference', label: 'Reference', format: 'mono', required: true, width: '120px' },
  { key: 'topic', label: 'Training', sort: 'topic', mobile: 'title' },
  { key: 'provider', label: 'Provider', mobile: 'meta' },
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
  { key: 'billingStatus', label: 'Billing', mobile: 'status' },
  {
    key: 'actualCost',
    label: 'Actual cost',
    align: 'right',
    value: (row) => (row.actualCost ? formatMoney(row.actualCost) : '—'),
  },
]
</script>

<template>
  <PageBody wide>
    <PageHeader
      title="All training requests"
      subtitle="Billing, actual cost and every attendee's state."
    />
    <DataTable
      class="mt-6"
      :columns="columns"
      :rows="requests.data.value?.data"
      :meta="requests.data.value?.meta"
      :loading="requests.isPending.value"
      :error="requests.error.value"
      :list="list"
      :row-to="(row) => `/training/requests/${row.id}`"
      noun="requests"
      storage-key="training-office-requests"
      search-placeholder="Search topic, provider or TRN-…"
      caption="All training requests"
      :empty="{
        title: 'No training requests match these filters',
        description: 'Clear a filter to see more.',
      }"
      @retry="requests.refetch()"
    >
      <template #filters>
        <UiSelect
          v-model="billingFilter"
          aria-label="Billing status"
          :options="[
            { value: ANY, label: 'Any billing' },
            ...['open', 'invoice_received', 'free_of_charge'].map((value) => ({
              value,
              label: enums.label('billingStatus', value),
            })),
          ]"
          class="w-44"
        />
        <UiSelect
          v-model="statusFilter"
          aria-label="Attendee status"
          :options="[
            { value: ANY, label: 'Any attendee status' },
            ...ATTENDEE_STATUSES.map((value) => ({
              value,
              label: enums.label('attendeeStatus', value),
            })),
          ]"
          class="w-52"
        />
        <DateRangeFilter :from="range.from" :to="range.to" label="Starts" @change="setRange" />
      </template>
      <template #cell-attendees="{ row }">
        <TrainingStatusBar :counts="row.statusCounts" :total="row.attendeeCount" />
      </template>
      <template #cell-billingStatus="{ row }">
        <StatusBadge enum="billingStatus" :value="row.billingStatus" />
      </template>
    </DataTable>
  </PageBody>
</template>
