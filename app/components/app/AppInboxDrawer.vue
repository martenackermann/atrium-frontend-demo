<script setup lang="ts">
import { coreKeys } from '~/lib/query/core'
import type { InboxResponse, NotificationDto, NotificationPage } from '~/types/api'

/**
 * Inbox drawer (SCREENS §1.4, DESIGN §7): tabs To do (`/me/inbox`, with inline quick actions) and
 * Updates (`/me/notifications`, unread bold, "Mark all as read"). Full width on mobile.
 */
const { inboxOpen } = useShell()
const api = useApi()
const auth = useAuthStore()
const queryClient = useQueryClient()
const tab = ref<'todo' | 'updates'>('todo')

const inbox = useQuery({
  queryKey: coreKeys.inbox(),
  queryFn: ({ signal }) => api.get<InboxResponse>('/me/inbox', undefined, { signal }),
  enabled: computed(() => auth.isAuthenticated && inboxOpen.value),
})
const notifications = useQuery({
  queryKey: coreKeys.notifications({ perPage: 30 }),
  queryFn: ({ signal }) =>
    api.get<NotificationPage>('/me/notifications', { perPage: 30 }, { signal }),
  enabled: computed(() => auth.isAuthenticated),
  refetchInterval: 60_000,
})

const readAll = useMutation({
  mutationFn: () => api.post('/me/notifications/read-all'),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: coreKeys.notifications() }),
})

async function openNotification(notification: NotificationDto) {
  if (!notification.readAt) {
    await api.post(`/me/notifications/${notification.id}/read`).catch(() => undefined)
    void queryClient.invalidateQueries({ queryKey: ['summary', 'notifications'] })
  }
  if (notification.link) {
    inboxOpen.value = false
    await navigateTo(internalLink(notification.link))
  }
}

const tabs = computed(() => [
  {
    value: 'todo' as const,
    label: 'To do',
    count: inbox.data.value?.meta.total ?? null,
    countTone: 'you' as const,
  },
  {
    value: 'updates' as const,
    label: 'Updates',
    count: notifications.data.value?.meta.unread || null,
  },
])
</script>

<template>
  <UiDrawer v-model:open="inboxOpen" title="Inbox" description="Your to-dos and updates">
    <template #header>
      <UiTabs v-model="tab" :tabs="tabs" aria-label="Inbox" list-class="px-5" />
    </template>

    <div v-if="tab === 'todo'" data-testid="inbox-drawer">
      <div v-if="inbox.isPending.value" class="grid">
        <div
          v-for="index in 4"
          :key="index"
          class="grid grid-cols-[32px_1fr] gap-3 border-b border-rule px-5 py-3.5"
        >
          <UiSkeleton class="size-8" />
          <div class="grid gap-2">
            <UiSkeleton class="h-4 w-3/4" /><UiSkeleton class="h-3 w-1/2" />
          </div>
        </div>
      </div>
      <ProblemAlert
        v-else-if="inbox.error.value"
        :error="inbox.error.value"
        class="m-5"
        :retry="() => inbox.refetch()"
      />
      <template v-else>
        <InboxItemRow
          v-for="item in inbox.data.value?.data ?? []"
          :key="item.id"
          :item="item"
          @navigate="inboxOpen = false"
        />
        <p
          class="mx-auto max-w-[34ch] px-5 pt-5 pb-7 text-center text-sm leading-[19px] text-ink-subtle"
        >
          <template v-if="inbox.data.value?.data.length">
            That is everything. New approvals, bookings and ratings appear here, and you get an
            email for each.
          </template>
          <template v-else>
            You're all caught up. New approvals, bookings and ratings will appear here.
          </template>
        </p>
      </template>
    </div>

    <div v-else>
      <div
        v-if="notifications.data.value?.meta.unread"
        class="flex justify-end border-b border-rule px-5 py-2"
      >
        <UiButton
          variant="ghost"
          size="sm"
          :loading="readAll.isPending.value"
          @click="readAll.mutate()"
          >Mark all as read</UiButton
        >
      </div>
      <p
        v-if="!notifications.data.value?.data.length"
        class="px-5 py-8 text-center text-sm text-ink-subtle"
      >
        No updates yet.
      </p>
      <button
        v-for="notification in notifications.data.value?.data ?? []"
        :key="notification.id"
        type="button"
        class="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-rule px-5 py-3.5 text-left hover:bg-hover"
        :class="!notification.readAt && 'bg-marker-tint'"
        @click="openNotification(notification)"
      >
        <span class="grid gap-0.5">
          <span
            class="text-base leading-5"
            :class="!notification.readAt ? 'font-semibold' : 'font-medium'"
            >{{ notification.title }}</span
          >
          <span class="text-sm text-ink-muted">{{ notification.body }}</span>
        </span>
        <time
          :datetime="notification.createdAt"
          class="text-meta whitespace-nowrap text-ink-subtle"
          >{{ formatAge(notification.createdAt) }}</time
        >
      </button>
    </div>
  </UiDrawer>
</template>
