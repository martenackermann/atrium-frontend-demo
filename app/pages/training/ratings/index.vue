<script setup lang="ts">
import type { DataTableColumn, TabItem } from '~/types/ui'
import { useRatings, useTrainingCounts } from '~/modules/training/api'
import type { TrainingRatingDto } from '~/modules/training/api/types'
import { ROUND_LABEL } from '~/modules/training/constants'

/**
 * My feedback rounds (SCREENS §4.6): To do (due + overdue) · Upcoming · Done, with the round
 * explained, the subject for loop 3, due date and reminders sent.
 */
definePageMeta({ title: 'Ratings' })

type Tab = 'todo' | 'upcoming' | 'done'
const STATES: Record<Tab, string> = { todo: 'due,overdue', upcoming: 'upcoming', done: 'submitted' }

const route = useRoute()
const router = useRouter()
const counts = useTrainingCounts()
const tab = computed<Tab>({
  get: () =>
    route.query.tab === 'upcoming' || route.query.tab === 'done' ? route.query.tab : 'todo',
  set: (value) =>
    router.replace({
      query: { ...route.query, tab: value === 'todo' ? undefined : value, page: undefined },
    }),
})
const tabs = computed<TabItem<Tab>[]>(() => [
  {
    value: 'todo',
    label: 'To do',
    count: counts.data.value?.mine.ratingsDue ?? null,
    countTone: 'you',
  },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'done', label: 'Done' },
])

const list = useListQuery({ defaultSort: 'dueAt' })
const params = computed(() => ({
  ...list.apiQuery.value,
  scope: 'mine',
  state: STATES[tab.value],
  ...(tab.value === 'done' && !route.query.sort ? { sort: '-submittedAt' } : {}),
}))
const ratings = useRatings(params)

const columns: DataTableColumn<TrainingRatingDto>[] = [
  {
    key: 'training',
    label: 'Training',
    required: true,
    mobile: 'title',
    value: (row) => row.training.topic,
  },
  {
    key: 'round',
    label: 'Round',
    value: (row) => `${row.loop} · ${ROUND_LABEL[row.loop]}`,
    mobile: 'meta',
  },
  {
    key: 'subject',
    label: 'About',
    value: (row) => (row.loop === 3 ? row.attendee.user.displayName : 'You'),
  },
  {
    key: 'dueAt',
    label: 'Due',
    sort: 'dueAt',
    value: (row) =>
      row.state === 'overdue'
        ? `Overdue since ${formatDate(row.dueAt)}`
        : `Due ${formatDate(row.dueAt)}`,
    mobile: 'meta',
  },
  {
    key: 'reminders',
    label: 'Reminders',
    align: 'right',
    width: '110px',
    value: (row) => `${row.reminderCount} of 4`,
  },
  { key: 'state', label: 'State', mobile: 'status' },
]
</script>

<template>
  <PageBody wide>
    <PageHeader
      title="Feedback"
      subtitle="Three short rounds per training: right after it, two months later, and the manager's view."
    />
    <UiTabs v-model="tab" :tabs="tabs" class="mt-5" aria-label="Feedback rounds" />
    <DataTable
      class="mt-4"
      :columns="columns"
      :rows="ratings.data.value?.data"
      :meta="ratings.data.value?.meta"
      :loading="ratings.isPending.value"
      :error="ratings.error.value"
      :list="list"
      :row-to="(row) => `/training/ratings/${row.id}`"
      noun="ratings"
      search-placeholder="Search training or TRN-…"
      caption="Feedback rounds"
      :empty="
        tab === 'todo'
          ? {
              title: 'No feedback due',
              description: 'Thanks for keeping up. New rounds show here when they are due.',
            }
          : tab === 'upcoming'
            ? {
                title: 'Nothing coming up',
                description: 'Rounds open after a booked training ends.',
              }
            : { title: 'No feedback yet', description: 'Rounds you submitted show here.' }
      "
      @retry="ratings.refetch()"
    >
      <template #cell-training="{ row }">
        <span class="font-medium">{{ row.training.topic }}</span>
        <span class="block text-meta text-ink-subtle">
          <span class="mono">{{ row.training.reference }}</span> · {{ row.training.provider }}
        </span>
      </template>
      <template #cell-dueAt="{ row }">
        <span v-if="row.state === 'overdue'" class="font-medium text-st-negative">
          Overdue since {{ formatDate(row.dueAt) }}
        </span>
        <template v-else>{{ formatDate(row.dueAt) }}</template>
      </template>
      <template #cell-state="{ row }">
        <StatusBadge
          enum="ratingState"
          :value="row.state"
          :available-actions="row.availableActions"
        />
      </template>
    </DataTable>
  </PageBody>
</template>
