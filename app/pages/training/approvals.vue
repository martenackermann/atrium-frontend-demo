<script setup lang="ts">
import { BadgeEuro, CornerUpRight, Hotel, UsersRound } from '@lucide/vue'
import type { TabItem } from '~/types/ui'
import { useParticipations, useTrainingCounts } from '~/modules/training/api'
import type {
  ParticipationScope,
  TrainingParticipationListItem,
} from '~/modules/training/api/types'

/**
 * Training approvals (SCREENS §4.5, DESIGN §8.3): split inbox with the tabs To approve
 * (`scope=approvals`), Executive (executives only, #13), As deputy and Team (manager-chain
 * overrides). Approve / Decline from the detail, A / D shortcuts, next item auto-selected.
 */
definePageMeta({ title: 'Training approvals', access: ['approver'], hideMobileTitle: true })

type Tab = Extract<ParticipationScope, 'approvals' | 'executive' | 'deputy' | 'team'>

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const counts = useTrainingCounts()

const tabs = computed<TabItem<Tab>[]>(() => {
  const approvals = counts.data.value?.approvals
  const list: TabItem<Tab>[] = [
    {
      value: 'approvals',
      label: 'To approve',
      count: approvals?.manager ?? null,
      countTone: 'you',
    },
  ]
  if (auth.me?.isExecutive)
    list.push({
      value: 'executive',
      label: 'Executive',
      count: approvals?.executive ?? null,
      countTone: 'you',
    })
  if ((auth.me?.activeDeputyFor.length ?? 0) > 0 || (approvals?.deputy ?? 0) > 0)
    list.push({
      value: 'deputy',
      label: 'As deputy',
      count: approvals?.deputy ?? null,
      countTone: 'you',
    })
  if (auth.me?.isManager)
    list.push({ value: 'team', label: 'Team', count: approvals?.team || null })
  return list
})

const tab = computed<Tab>({
  get: () => {
    const raw = route.query.tab
    const wanted = (typeof raw === 'string' ? raw : 'approvals') as Tab
    return tabs.value.some((t) => t.value === wanted) ? wanted : 'approvals'
  },
  set: (value) =>
    router.replace({
      query: {
        ...route.query,
        tab: value === 'approvals' ? undefined : value,
        selected: undefined,
        filter: undefined,
      },
    }),
})
const filter = computed({
  get: () => (route.query.filter === 'all' ? 'all' : 'pending'),
  set: (value) =>
    router.replace({ query: { ...route.query, filter: value === 'pending' ? undefined : value } }),
})

const params = computed(() => ({
  scope: tab.value,
  perPage: 100,
  ...(tab.value === 'team' && filter.value === 'pending'
    ? { status: 'pending_manager_approval,pending_executive_approval' }
    : {}),
}))
const list = useParticipations(params)
const items = computed(() => list.data.value?.data ?? [])
const decides = (item: TrainingParticipationListItem) =>
  item.availableActions.includes('approve') || item.availableActions.includes('decline')
const pendingCount = computed(() => items.value.filter(decides).length)

const actions = ref<{ trigger: (action: string) => void }>()
function decide(item: TrainingParticipationListItem, action: 'approve' | 'decline') {
  if (item.availableActions.includes(action)) actions.value?.trigger(action)
}

const principalOf = (item: TrainingParticipationListItem) =>
  item.status === 'pending_executive_approval' ? item.executiveApprover : item.approver
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <SplitInbox
      v-model:tab="tab"
      v-model:filter="filter"
      title="Approvals"
      :count-label="list.data.value ? `${pendingCount} to decide` : undefined"
      :tabs="tabs"
      :filters="
        tab === 'team'
          ? [
              { value: 'pending', label: 'Waiting' },
              { value: 'all', label: 'All' },
            ]
          : undefined
      "
      sort-note="Earliest start first"
      :items="items"
      :item-key="(item) => item.id"
      :item-label="(item) => `${item.user.displayName}: ${item.request.topic}`"
      :loading="list.isPending.value"
      :error="list.error.value"
      :can-decide="decides"
      :item-to="(item) => `/training/participations/${item.id}`"
      :empty="{
        title: 'Nothing to approve',
        description: 'You\'ll get an email when someone needs your decision.',
      }"
      @approve="(item) => decide(item, 'approve')"
      @decline="(item) => decide(item, 'decline')"
      @retry="list.refetch()"
    >
      <template #item="{ item }">
        <div class="flex items-center gap-2 text-sm text-ink-muted">
          <UiAvatar :initials="item.user.initials" :name="item.user.displayName" size="sm" />
          <span class="font-medium text-ink">{{ item.user.displayName }}</span>
          <time
            class="ml-auto text-meta whitespace-nowrap text-ink-subtle"
            :datetime="item.updatedAt"
            >{{ formatAge(item.updatedAt) }}</time
          >
        </div>
        <p class="mt-0.5 text-[14.5px] leading-5 font-semibold">{{ item.request.topic }}</p>
        <p class="text-sm text-ink-muted">
          {{ formatDateRange(item.request.startsOn, item.request.endsOn, { weekday: true }) }} ·
          <span class="num">{{ formatMoney(item.request.cost) }}</span>
        </p>
        <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <PriorityFlag v-if="item.isHighPriority" high :starts-at="item.request.startsOn" />
          <UiMiniChip
            v-if="item.request.executiveStepRequired"
            :icon="BadgeEuro"
            label="≥ €5,000"
          />
          <UiMiniChip v-if="item.escalatedFrom" :icon="CornerUpRight" label="Escalated" />
          <UiMiniChip
            v-if="item.actingAs === 'deputy' && principalOf(item)"
            :icon="UsersRound"
            :label="`for ${principalOf(item)!.displayName}`"
          />
          <UiMiniChip v-if="item.hotelNeeded" :icon="Hotel" label="Hotel" />
          <StatusBadge
            v-if="tab === 'team'"
            enum="attendeeStatus"
            :value="item.status"
            :available-actions="item.availableActions"
          />
        </div>
      </template>

      <template #detail-title="{ item }">{{ item.request.topic }}</template>
      <template #detail-meta="{ item }">
        <span>{{ item.user.displayName }}</span>
        <span aria-hidden="true">·</span>
        <span class="mono text-ink-subtle">{{ item.request.reference }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ formatDateRange(item.request.startsOn, item.request.endsOn) }}</span>
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
          <span class="text-sm text-ink-muted">
            Requested by
            <strong class="font-medium text-ink">{{ item.request.requester.displayName }}</strong>
          </span>
        </div>
        <TrainingParticipationPanel :item="item" mode="approval" />
      </template>
    </SplitInbox>
  </div>
</template>
