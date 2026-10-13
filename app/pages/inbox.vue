<script setup lang="ts">
import { ArrowRight, BellOff, CheckCheck } from '@lucide/vue'
import { describeError, isApiError } from '~/lib/api'
import { inboxIcon } from '~/lib/inbox'
import { coreKeys } from '~/lib/query/core'
import type { InboxItem, InboxResponse, NotificationPage } from '~/types/api'

/**
 * Inbox (SCREENS §2 /inbox, DESIGN §8.3): the split inbox over `/me/inbox` — module filter,
 * "High priority only", quick actions (A approve, D decline) — and the Updates feed.
 */
definePageMeta({ title: 'Inbox', hideMobileTitle: true })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const route = useRoute()
const router = useRouter()

const tab = computed({
  get: () => (route.query.tab === 'updates' ? 'updates' : 'todo'),
  set: (value) =>
    router.replace({
      query: { ...route.query, tab: value === 'todo' ? undefined : value, selected: undefined },
    }),
})
const filter = computed({
  get: () => (typeof route.query.module === 'string' ? route.query.module : 'all'),
  set: (value) =>
    router.replace({ query: { ...route.query, module: value === 'all' ? undefined : value } }),
})
const highOnly = computed({
  get: () => route.query.high === 'true',
  set: (value) => router.replace({ query: { ...route.query, high: value ? 'true' : undefined } }),
})

const inbox = useQuery({
  queryKey: coreKeys.inbox(),
  queryFn: ({ signal }) => api.get<InboxResponse>('/me/inbox', undefined, { signal }),
})
const notifications = useQuery({
  queryKey: coreKeys.notifications({ perPage: 50 }),
  queryFn: ({ signal }) =>
    api.get<NotificationPage>('/me/notifications', { perPage: 50 }, { signal }),
})

const items = computed(() =>
  (inbox.data.value?.data ?? []).filter(
    (item) =>
      (filter.value === 'all' || item.module === filter.value) &&
      (!highOnly.value || item.priority === 'high'),
  ),
)
const byModule = computed(() => inbox.data.value?.meta.byModule)
const filters = computed(() => [
  { value: 'all', label: 'All' },
  ...(['training', 'travel', 'assets', 'people'] as const)
    .filter((module) => (byModule.value?.[module] ?? 0) > 0)
    .map((module) => ({
      value: module,
      label: { training: 'Training', travel: 'Travel', assets: 'Devices', people: 'People' }[
        module
      ],
    })),
])
const tabs = computed(() => [
  {
    value: 'todo',
    label: 'To do',
    count: inbox.data.value?.meta.total ?? null,
    countTone: 'you' as const,
  },
  { value: 'updates', label: 'Updates', count: notifications.data.value?.meta.unread || null },
])

// Quick actions (approve / decline) posted to `${actionsPath}/actions/{action}` (#4).
const pending = ref<string | null>(null)
const declining = ref<InboxItem | null>(null)
const declineError = ref<string | null>(null)
const declineOpen = computed({
  get: () => declining.value !== null,
  set: (value) => {
    if (!value) declining.value = null
  },
})

async function run(
  item: InboxItem,
  action: 'approve' | 'decline',
  body: Record<string, unknown> = {},
) {
  if (!item.quickActions.includes(action) || !isInternalPath(item.actionsPath)) return
  pending.value = action
  try {
    await api.action(item.actionsPath, action, body)
    toast.success(action === 'approve' ? 'Approved.' : 'Declined.')
    declining.value = null
    await queryClient.invalidateQueries({ queryKey: ['summary'] })
  } catch (error) {
    if (isApiError(error) && error.status === 422 && action === 'decline') {
      declineError.value = error.fieldError('reason') ?? error.detail ?? error.title
      return
    }
    toast.error(describeError(error))
    await queryClient.invalidateQueries({ queryKey: ['summary'] })
  } finally {
    pending.value = null
  }
}

function decline(item: InboxItem) {
  if (!item.quickActions.includes('decline')) return
  declineError.value = null
  declining.value = item
}

const dueText = (item: InboxItem) => {
  const days = daysFromToday(item.dueAt)
  if (days === null) return null
  if (days < 0) return { text: days === -1 ? 'Overdue' : `${-days} days overdue`, overdue: true }
  if (days === 0) return { text: 'Due today', overdue: false }
  return { text: `Due ${formatDate(item.dueAt)}`, overdue: false }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <SplitInbox
      v-if="tab === 'todo'"
      v-model:tab="tab"
      v-model:filter="filter"
      title="Inbox"
      :count-label="inbox.data.value ? `${inbox.data.value.meta.total} to do` : undefined"
      :tabs="tabs"
      :filters="filters.length > 2 ? filters : undefined"
      sort-note="Most urgent first"
      :items="items"
      :item-key="(item) => item.id"
      :item-label="(item) => item.title"
      :loading="inbox.isPending.value"
      :error="inbox.error.value"
      :can-decide="(item) => item.quickActions.includes('approve')"
      :item-to="(item) => internalLink(item.link, '/inbox')"
      :empty="{
        title: 'You\'re all caught up',
        description:
          'New approvals, bookings and ratings will appear here, and you get an email for each.',
      }"
      @approve="(item) => run(item, 'approve')"
      @decline="decline"
      @retry="inbox.refetch()"
    >
      <template #list-tools>
        <UiSwitch v-model="highOnly" label="High priority only" class="text-sm" />
      </template>
      <template #item="{ item }">
        <div class="flex items-center gap-2 text-sm text-ink-muted">
          <span class="font-medium">{{
            { training: 'Training', travel: 'Travel', assets: 'Devices', people: 'People' }[
              item.module
            ]
          }}</span>
          <span v-if="item.reference" class="mono text-ink-subtle">{{ item.reference }}</span>
          <time
            v-if="item.createdAt"
            class="ml-auto text-meta whitespace-nowrap text-ink-subtle"
            :datetime="item.createdAt"
            >{{ formatAge(item.createdAt) }}</time
          >
        </div>
        <p class="mt-0.5 flex items-center gap-[7px] text-[14.5px] leading-5 font-semibold">
          <component
            :is="inboxIcon(item)"
            class="size-4 flex-none text-ink-muted"
            aria-hidden="true"
          />
          {{ item.title }}
        </p>
        <p v-if="item.subtitle" class="pl-[23px] text-sm text-ink-muted">{{ item.subtitle }}</p>
        <div class="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pl-[23px]">
          <span v-if="item.priority === 'high'" class="text-[12.5px] font-semibold text-st-negative"
            >High priority</span
          >
          <span
            v-if="dueText(item)"
            class="text-[12.5px]"
            :class="dueText(item)!.overdue ? 'font-semibold text-st-negative' : 'text-ink-muted'"
            >{{ dueText(item)!.text }}</span
          >
          <UiMiniChip v-if="item.actingAs === 'deputy'" label="as deputy" />
        </div>
      </template>

      <template #detail-title="{ item }">{{ item.title }}</template>
      <template #detail-meta="{ item }">
        <span>{{
          { training: 'Training', travel: 'Travel', assets: 'Devices', people: 'People requests' }[
            item.module
          ]
        }}</span>
        <template v-if="item.reference"
          ><span aria-hidden="true">·</span
          ><span class="mono text-ink-subtle">{{ item.reference }}</span></template
        >
      </template>
      <template #detail-actions="{ item }">
        <UiButton
          v-if="item.quickActions.includes('decline')"
          variant="secondary"
          kbd="D"
          :disabled="Boolean(pending)"
          @click="decline(item)"
          >Decline…</UiButton
        >
        <UiButton
          v-if="item.quickActions.includes('approve')"
          variant="primary"
          kbd="A"
          :loading="pending === 'approve'"
          :disabled="Boolean(pending)"
          @click="run(item, 'approve')"
          >Approve</UiButton
        >
        <UiButton
          v-if="!item.quickActions.length"
          variant="primary"
          :to="internalLink(item.link, '/inbox')"
          :icon-right="ArrowRight"
          >Open</UiButton
        >
      </template>
      <template #detail="{ item }">
        <div class="grid gap-5">
          <p v-if="item.subtitle" class="font-display text-[17px] leading-[25px]">
            {{ item.subtitle }}
          </p>
          <FactGrid
            :items="[
              {
                label: 'Due',
                value: item.dueAt ? formatDate(item.dueAt) : 'No due date',
                detail: dueText(item)?.text,
              },
              { label: 'Priority', value: item.priority === 'high' ? 'High' : 'Normal' },
              { label: 'Reference', value: item.reference ?? '—', mono: Boolean(item.reference) },
            ]"
          />
          <p class="text-sm text-ink-muted">
            Open the full page for the route, the history and every action.
            <NuxtLink :to="internalLink(item.link, '/inbox')" class="link font-medium text-ink"
              >Open full page</NuxtLink
            >
          </p>
        </div>
      </template>
    </SplitInbox>

    <PageBody v-else>
      <div class="flex flex-wrap items-baseline gap-3">
        <h1 class="font-display text-display-md font-normal tracking-display">Inbox</h1>
      </div>
      <UiTabs v-model="tab" :tabs="tabs" class="mt-4" aria-label="Inbox" />
      <div class="mt-4 grid border-t border-ink">
        <p v-if="!notifications.data.value?.data.length" class="py-10 text-center text-ink-muted">
          <BellOff class="mx-auto mb-2 size-5" aria-hidden="true" />No updates yet.
        </p>
        <NuxtLink
          v-for="notification in notifications.data.value?.data ?? []"
          :key="notification.id"
          :to="internalLink(notification.link, '/inbox?tab=updates')"
          class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-rule px-2 py-3.5 text-ink no-underline hover:bg-hover"
          :class="!notification.readAt && 'bg-marker-tint'"
        >
          <span class="grid gap-0.5">
            <span :class="!notification.readAt ? 'font-semibold' : 'font-medium'">{{
              notification.title
            }}</span>
            <span class="text-sm text-ink-muted">{{ notification.body }}</span>
          </span>
          <time class="text-meta text-ink-subtle" :datetime="notification.createdAt">{{
            formatAge(notification.createdAt)
          }}</time>
        </NuxtLink>
      </div>
      <p
        v-if="notifications.data.value?.data.length"
        class="mt-4 flex items-center gap-2 text-sm text-ink-subtle"
      >
        <CheckCheck class="size-4" aria-hidden="true" /> Updates are kept for 90 days.
      </p>
    </PageBody>

    <ReasonDialog
      v-model:open="declineOpen"
      title="Decline this request?"
      description="The requester is told why and can change the request."
      label="Tell them why"
      hint="The requester and their manager see this reason."
      confirm-label="Decline request"
      destructive
      :loading="pending === 'decline'"
      :error="declineError"
      @submit="(reason) => declining && run(declining, 'decline', { reason })"
    />
  </div>
</template>
