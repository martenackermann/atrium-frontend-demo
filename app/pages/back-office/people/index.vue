<script setup lang="ts">
import { Search } from '@lucide/vue'
import { usePeopleCounts, usePeopleRequests } from '~/modules/people/api'
import type { PeopleRequestSummary, PeopleRequestType, Priority } from '~/modules/people/api/types'
import { OPS_QUEUES, type OpsQueue, PRIORITY_LABELS, TYPE_META } from '~/modules/people/constants'
import type { TabItem } from '~/types/ui'

/**
 * `/back-office/people` (SCREENS §7.4, owned by A4): the People Ops queue as a split view —
 * queues open (open + reopened) · in progress · waiting · closed · all; filters type, priority,
 * assignee and search; the detail with personal data, assignee/priority/internal note and the
 * conversation with internal comments.
 */
definePageMeta({
  title: 'People Ops queue',
  access: ['people_ops', 'it_admin'],
  hideMobileTitle: true,
})

const route = useRoute()
const router = useRouter()
const counts = usePeopleCounts()

const queryParam = (key: string, fallback: string) =>
  typeof route.query[key] === 'string' && route.query[key] ? (route.query[key] as string) : fallback
const setQuery = (patch: Record<string, string | undefined>) =>
  router.replace({ query: { ...route.query, ...patch, selected: undefined } })

const queue = computed<OpsQueue>({
  get: () => {
    const value = queryParam('queue', 'open')
    return (value in OPS_QUEUES ? value : 'open') as OpsQueue
  },
  set: (value) => setQuery({ queue: value === 'open' ? undefined : value }),
})
const assignee = computed({
  get: () => queryParam('assignee', 'any'),
  set: (value: string) => setQuery({ assignee: value === 'any' ? undefined : value }),
})
const type = computed({
  get: () => queryParam('type', 'any'),
  set: (value: string) => setQuery({ type: value === 'any' ? undefined : value }),
})
const priority = computed({
  get: () => queryParam('priority', 'any'),
  set: (value: string) => setQuery({ priority: value === 'any' ? undefined : value }),
})
const search = ref(queryParam('q', ''))
watchDebounced(search, (value) => setQuery({ q: value.trim() || undefined }), { debounce: 300 })

const params = computed(() => ({
  scope: 'all',
  perPage: 100,
  sort: queue.value === 'closed' || queue.value === 'all' ? '-createdAt' : 'priority,effectiveDate',
  status: OPS_QUEUES[queue.value].statuses.join(','),
  type: type.value === 'any' ? undefined : type.value,
  priority: priority.value === 'any' ? undefined : priority.value,
  assigneeId: assignee.value === 'any' ? undefined : assignee.value,
  q: queryParam('q', '') || undefined,
}))
const requests = usePeopleRequests(params)

const tabs = computed<TabItem[]>(() => {
  const ops = counts.data.value?.ops
  return [
    { value: 'open', label: 'Open', count: ops ? ops.open + ops.reopened : null, countTone: 'you' },
    { value: 'in_progress', label: 'Working', count: ops?.inProgress ?? null },
    { value: 'waiting', label: 'Waiting', count: ops?.waiting ?? null },
    { value: 'closed', label: 'Closed' },
    { value: 'all', label: 'All' },
  ]
})
const assigneeFilters = [
  { value: 'any', label: 'Any assignee' },
  { value: 'me', label: 'Assigned to me' },
  { value: 'none', label: 'Unassigned' },
]
const typeOptions = [
  { value: 'any', label: 'All types' },
  ...(Object.keys(TYPE_META) as PeopleRequestType[]).map((value) => ({
    value,
    label: TYPE_META[value].label,
  })),
]
const priorityOptions = [
  { value: 'any', label: 'Any priority' },
  ...(Object.keys(PRIORITY_LABELS) as Priority[]).map((value) => ({
    value,
    label: PRIORITY_LABELS[value],
  })),
]

const empty = computed(() =>
  queue.value === 'open'
    ? {
        title: 'No open requests. Nice.',
        description: 'New onboardings, offboardings and changes land here first.',
      }
    : { title: 'Nothing here', description: 'No requests match this queue and these filters.' },
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <SplitInbox
      v-model:tab="queue"
      title="People Ops"
      :count-label="
        requests.data.value ? `${requests.data.value.meta.total} in this queue` : undefined
      "
      :tabs="tabs"
      :items="requests.data.value?.data"
      :item-key="(item: PeopleRequestSummary) => item.id"
      :item-label="(item: PeopleRequestSummary) => `${item.reference} ${item.title}`"
      :item-to="(item: PeopleRequestSummary) => `/people-requests/${item.id}`"
      :loading="requests.isPending.value"
      :error="requests.error.value"
      :empty="empty"
      @retry="requests.refetch()"
    >
      <template #list-tools>
        <div class="grid w-full min-w-0 flex-1 grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
          <label class="relative col-span-3">
            <span class="sr">Search requests</span>
            <Search
              class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <input
              v-model="search"
              type="search"
              placeholder="Search reference, title or name"
              class="h-[30px] w-full rounded-md border border-field bg-sheet pr-2 pl-8 text-sm text-ink outline-none placeholder:text-ink-subtle focus-visible:border-ink"
              data-testid="ops-search"
            />
          </label>
          <UiSelect v-model="assignee" :options="assigneeFilters" size="sm" aria-label="Assignee" />
          <UiSelect v-model="type" :options="typeOptions" size="sm" aria-label="Type" />
          <UiSelect v-model="priority" :options="priorityOptions" size="sm" aria-label="Priority" />
        </div>
      </template>
      <template #item="{ item }">
        <div class="flex items-center gap-2 text-sm text-ink-muted">
          <component :is="TYPE_META[item.type].icon" class="size-3.5" aria-hidden="true" />
          <span class="font-medium">{{ TYPE_META[item.type].short }}</span>
          <span class="mono text-ink-subtle">{{ item.reference }}</span>
          <time
            class="ml-auto text-meta whitespace-nowrap text-ink-subtle"
            :datetime="item.createdAt"
            >{{ formatAge(item.createdAt) }}</time
          >
        </div>
        <p class="mt-0.5 text-[14.5px] leading-5 font-semibold">{{ item.title }}</p>
        <p class="text-sm text-ink-muted">
          {{ item.subjectName }} · {{ TYPE_META[item.type].effectiveLabel.toLowerCase() }}
          {{ formatDate(item.effectiveDate) }}
        </p>
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <StatusBadge
            enum="peopleRequestStatus"
            :value="item.status"
            :available-actions="item.availableActions"
          />
          <PriorityFlag :level="item.priority" />
          <UiMiniChip :label="item.assignee ? item.assignee.displayName : 'Unassigned'" />
        </div>
      </template>
      <template #detail-title="{ item }">{{ item.title }}</template>
      <template #detail-meta="{ item }">
        <span>{{ TYPE_META[item.type].label }}</span>
        <span aria-hidden="true">·</span>
        <span class="mono">{{ item.reference }}</span>
        <span aria-hidden="true">·</span>
        <span>Requested by {{ item.requester.displayName }}</span>
      </template>
      <template #detail-actions="{ item }">
        <PeopleQueueActions :id="item.id" />
      </template>
      <template #detail="{ item }">
        <PeopleQueueDetail :id="item.id" />
      </template>
    </SplitInbox>
  </div>
</template>
