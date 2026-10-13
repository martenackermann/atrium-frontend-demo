<script setup lang="ts">
import { MessageCircleQuestion, Plus, UserPlus } from '@lucide/vue'
import { usePeopleCounts, usePeopleRequests } from '~/modules/people/api'
import type { PeopleRequestSummary } from '~/modules/people/api/types'
import { PRIORITY_LABELS, TYPE_META } from '~/modules/people/constants'
import type { DataTableColumn } from '~/types/ui'

/**
 * `/people-requests` (SCREENS §7.1, owned by A4): my people requests (as requester, manager or
 * manager's deputy) with a banner when People Ops waits for my reply.
 */
definePageMeta({ title: 'My people requests' })

const auth = useAuthStore()
const enums = useEnums()
const list = useListQuery({
  filters: ['status', 'type'],
  multi: ['status'],
  defaultSort: '-createdAt',
})
const params = computed(() => ({ ...list.apiQuery.value, scope: 'mine' }))
const requests = usePeopleRequests(params)
const counts = usePeopleCounts()
const waiting = computed(() => counts.data.value?.mine.waitingOnMe ?? 0)

const ANY = 'any'
const typeFilter = computed({
  get: () => (list.state.value.filters.type as string) || ANY,
  set: (value: string) => list.setFilter('type', value === ANY ? '' : value),
})
const statusFilter = computed({
  get: () => ((list.state.value.filters.status as string[] | undefined) ?? [])[0] ?? ANY,
  set: (value: string) => list.setFilter('status', value === ANY ? [] : [value]),
})
const typeOptions = [
  { value: ANY, label: 'All types' },
  ...(Object.keys(TYPE_META) as (keyof typeof TYPE_META)[]).map((value) => ({
    value,
    label: TYPE_META[value].label,
  })),
]
const statusOptions = computed(() => [
  { value: ANY, label: 'All statuses' },
  ...enums.options('peopleRequestStatus').map((option) => ({
    value: String(option.value),
    label: option.label,
  })),
])

const columns: DataTableColumn<PeopleRequestSummary>[] = [
  {
    key: 'reference',
    label: 'Reference',
    format: 'mono',
    required: true,
    width: '128px',
    mobile: 'meta',
  },
  { key: 'type', label: 'Type', width: '150px', mobile: 'hidden' },
  { key: 'title', label: 'Title', required: true, mobile: 'title' },
  { key: 'subjectName', label: 'Person', mobile: 'meta' },
  {
    key: 'effectiveDate',
    label: 'Effective',
    sort: 'effectiveDate',
    format: 'date',
    width: '120px',
    mobile: 'meta',
  },
  { key: 'status', label: 'Status', sort: 'status', width: '190px', mobile: 'status' },
  { key: 'priority', label: 'Priority', sort: 'priority', width: '110px', mobile: 'hidden' },
  {
    key: 'assignee',
    label: 'Assignee',
    value: (row) => row.assignee?.displayName ?? 'Unassigned',
    hidden: true,
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    value: (row) => formatAge(row.updatedAt),
    width: '110px',
    mobile: 'hidden',
  },
]
</script>

<template>
  <PageBody wide>
    <PageHeader
      title="My people requests"
      subtitle="Onboardings, offboardings and role changes you asked for or manage."
    >
      <template #actions>
        <UiButton variant="primary" :icon="Plus" to="/people-requests/new"
          >New people request</UiButton
        >
      </template>
    </PageHeader>

    <div
      v-if="waiting > 0"
      class="region-marker mt-6 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
      role="status"
      data-testid="reply-banner"
    >
      <MessageCircleQuestion class="size-4 flex-none" aria-hidden="true" />
      <p class="flex-1 text-base font-semibold text-ink">
        People Ops needs your reply on {{ waiting }} request{{ waiting === 1 ? '' : 's' }}.
      </p>
      <UiButton size="sm" @click="list.setFilter('status', ['waiting_on_requester'])"
        >Show {{ waiting === 1 ? 'it' : 'them' }}</UiButton
      >
    </div>

    <DataTable
      class="mt-6"
      :columns="columns"
      :rows="requests.data.value?.data"
      :meta="requests.data.value?.meta"
      :loading="requests.isPending.value"
      :error="requests.error.value"
      :list="list"
      noun="people requests"
      storage-key="people-requests"
      caption="My people requests"
      search-placeholder="Search reference, title or name"
      :row-to="(row) => `/people-requests/${row.id}`"
      @retry="requests.refetch()"
    >
      <template #filters>
        <UiSelect
          v-model="typeFilter"
          :options="typeOptions"
          size="sm"
          aria-label="Type"
          class="w-48"
        />
        <UiSelect
          v-model="statusFilter"
          :options="statusOptions"
          size="sm"
          aria-label="Status"
          class="w-48"
        />
      </template>
      <template #cell-type="{ row }">
        <span class="inline-flex items-center gap-1.5 text-sm text-ink-muted">
          <component :is="TYPE_META[row.type].icon" class="size-3.5" aria-hidden="true" />
          {{ TYPE_META[row.type].short }}
        </span>
      </template>
      <template #cell-title="{ row }">
        <NuxtLink
          :to="`/people-requests/${row.id}`"
          class="font-semibold text-ink no-underline hover:underline"
          >{{ row.title }}</NuxtLink
        >
      </template>
      <template #cell-status="{ row }">
        <StatusBadge
          enum="peopleRequestStatus"
          :value="row.status"
          :available-actions="row.availableActions"
          :actor="
            row.status === 'waiting_on_requester' && row.requester.id === auth.me?.id
              ? true
              : undefined
          "
        />
      </template>
      <template #cell-priority="{ row }">
        <span class="inline-flex items-center gap-1.5 text-sm">
          <PriorityFlag :level="row.priority" />{{ PRIORITY_LABELS[row.priority] }}
        </span>
      </template>
      <template #empty>
        <EmptyState
          :icon="UserPlus"
          title="No requests yet"
          description="Start onboarding a new colleague, an offboarding or a role change."
        >
          <UiButton variant="secondary" :icon="Plus" to="/people-requests/new"
            >New people request</UiButton
          >
        </EmptyState>
      </template>
    </DataTable>
  </PageBody>
</template>
