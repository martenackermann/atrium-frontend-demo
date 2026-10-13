<script setup lang="ts">
import { ArrowRight, Users } from '@lucide/vue'
import { describeError, isApiError } from '~/lib/api'
import { whySeeingText } from '~/lib/why'
import type { TabItem } from '~/types/ui'
import { travelKeys, useTravelCounts, useTravelRequests } from '~/modules/travel/api'
import type { TravelRequestDetail, TravelRequestSummary } from '~/modules/travel/api/types'
import { TRAVEL_ACTION_CONFIG, TRAVEL_ACTION_MESSAGES } from '~/modules/travel/constants'
import { requestTitle, tripDates } from '~/modules/travel/lib/present'

/**
 * Travel approvals (SCREENS §5.5, DESIGN §8.3): split inbox with tabs To approve · As deputy ·
 * Team (`tab=approvals|deputy|team`, SPEC_RESOLUTIONS #18). Rows: traveller, kind, route, start,
 * "{n} reasons", high priority, "for {principal}". Detail: reasons first, facts, "Why you're
 * seeing this"; Approve (A) / Decline (D, reason required).
 */
definePageMeta({ title: 'Travel approvals', access: ['approver'], hideMobileTitle: true })

const route = useRoute()
const router = useRouter()
const api = useApi()
const auth = useAuthStore()
const toast = useToast()
const queryClient = useQueryClient()

type Tab = 'approvals' | 'deputy' | 'team'
const tab = computed<Tab>({
  get: () =>
    ['deputy', 'team'].includes(String(route.query.tab)) ? (route.query.tab as Tab) : 'approvals',
  set: (value) =>
    patchQuery(router, { tab: value === 'approvals' ? undefined : value, selected: undefined }),
})
const counts = useTravelCounts()
const tabs = computed<TabItem[]>(() => [
  {
    value: 'approvals',
    label: 'To approve',
    count: counts.data.value?.approvals.mine ?? null,
    countTone: 'you',
  },
  {
    value: 'deputy',
    label: 'As deputy',
    count: counts.data.value?.approvals.deputy ?? null,
    countTone: 'you',
  },
  { value: 'team', label: 'Team', count: counts.data.value?.approvals.team || null },
])

const list = useTravelRequests(() => ({ scope: tab.value, perPage: 100 }))
const items = computed(() => list.data.value?.data ?? null)

const deputyWindow = (principalId: string | undefined) =>
  auth.me?.activeDeputyFor.find((entry) => entry.principal.id === principalId)
const whyText = (item: TravelRequestDetail) =>
  item.actingAs || tab.value !== 'team'
    ? whySeeingText({
        actingAs: item.actingAs ?? 'approver',
        subject: item.traveller,
        approverReason: item.approverReason,
        escalatedFrom: item.escalatedFrom,
        principal: item.approver,
        deputyUntil: deputyWindow(item.approver?.id)?.validTo ?? null,
      })
    : `${item.traveller.displayName.split(' ')[0]} is in your reporting line.`

const pending = ref<string | null>(null)
const declining = ref<TravelRequestSummary | null>(null)
const declineError = ref<string | null>(null)
const declineOpen = computed({
  get: () => declining.value !== null,
  set: (value) => {
    if (!value) declining.value = null
  },
})

async function run(
  item: TravelRequestSummary,
  action: 'approve' | 'decline',
  body: Record<string, unknown> = {},
) {
  if (!item.availableActions.includes(action)) return
  pending.value = action
  try {
    const detail = await api.action<TravelRequestDetail>(
      `/travel/requests/${item.id}`,
      action,
      body,
    )
    const message = TRAVEL_ACTION_MESSAGES[action]
    toast.success(typeof message === 'function' ? message(detail) : (message ?? 'Done.'))
    declining.value = null
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: travelKeys.requests.module }),
      queryClient.invalidateQueries({ queryKey: ['summary'] }),
    ])
  } catch (error) {
    if (isApiError(error) && error.status === 422 && action === 'decline') {
      declineError.value = error.fieldError('reason') ?? error.detail ?? error.title
      return
    }
    toast.error(describeError(error))
    await queryClient.invalidateQueries({ queryKey: travelKeys.requests.module })
  } finally {
    pending.value = null
  }
}

function decline(item: TravelRequestSummary) {
  if (!item.availableActions.includes('decline')) return
  declineError.value = null
  declining.value = item
}

const emptyText = computed(() =>
  tab.value === 'team'
    ? {
        title: 'Nothing from your team',
        description: 'Trips of the people in your reporting line appear here.',
      }
    : {
        title: 'No travel requests waiting for you',
        description: 'You get an email when someone needs your decision.',
      },
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <SplitInbox
      v-model:tab="tab"
      title="Travel approvals"
      :count-label="items ? `${items.length} ${tab === 'team' ? 'trips' : 'to decide'}` : undefined"
      :tabs="tabs"
      sort-note="Soonest first"
      :items="items"
      :item-key="(item) => item.id"
      :item-label="(item) => `${item.traveller.displayName}, ${requestTitle(item)}`"
      :loading="list.isPending.value"
      :error="list.error.value"
      :can-decide="
        (item) =>
          item.availableActions.includes('approve') || item.availableActions.includes('decline')
      "
      :item-to="(item) => `/travel/requests/${item.id}`"
      :empty="emptyText"
      @approve="(item) => run(item, 'approve')"
      @decline="decline"
      @retry="list.refetch()"
    >
      <template #item="{ item }">
        <div class="flex items-center gap-2 text-sm">
          <UiAvatar
            :name="item.traveller.displayName"
            :initials="item.traveller.initials"
            size="sm"
          />
          <span class="font-semibold">{{ item.traveller.displayName }}</span>
          <time
            class="ml-auto text-meta whitespace-nowrap text-ink-subtle"
            :datetime="item.createdAt"
            >{{ formatAge(item.createdAt) }}</time
          >
        </div>
        <p class="mt-0.5 flex items-center gap-[7px] text-[14.5px] leading-5 font-semibold">
          <TravelKindIcon :kind="item.kind" />
          {{ requestTitle(item) }}
        </p>
        <p class="pl-[23px] text-sm text-ink-muted">
          {{ tripDates(item.startsAt, item.endsAt) }} · {{ item.route }}
          <template v-if="item.approvalReasons.length">
            · {{ item.approvalReasons.length }} reason{{
              item.approvalReasons.length === 1 ? '' : 's'
            }}</template
          >
        </p>
        <div class="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pl-[23px]">
          <PriorityFlag v-if="item.isHighPriority" :starts-at="item.startsAt" high />
          <UiMiniChip v-if="item.approverReason === 'site_manager_escalation'" label="Escalated" />
          <UiMiniChip
            v-if="item.actingAs === 'deputy' && item.approver"
            :icon="Users"
            :label="`for ${item.approver.displayName}`"
          />
          <StatusBadge
            v-if="tab === 'team'"
            enum="travelStatus"
            :value="item.status"
            :available-actions="item.availableActions"
          />
        </div>
      </template>

      <template #detail-title="{ item }">{{ requestTitle(item) }}</template>
      <template #detail-meta="{ item }">
        <TravelKindIcon :kind="item.kind" labelled />
        <span aria-hidden="true">·</span><span>{{ item.route }}</span>
        <span aria-hidden="true">·</span
        ><span class="mono text-ink-subtle">{{ item.reference }}</span>
      </template>
      <template #detail-actions="{ item }">
        <UiButton
          v-if="item.availableActions.includes('decline')"
          variant="secondary"
          kbd="D"
          :disabled="Boolean(pending)"
          @click="decline(item)"
          >Decline…</UiButton
        >
        <UiButton
          v-if="item.availableActions.includes('approve')"
          variant="primary"
          kbd="A"
          :icon="TRAVEL_ACTION_CONFIG.approve?.icon"
          :loading="pending === 'approve'"
          :disabled="Boolean(pending)"
          @click="run(item, 'approve')"
          >Approve</UiButton
        >
        <UiButton
          v-if="
            !item.availableActions.includes('approve') && !item.availableActions.includes('decline')
          "
          variant="secondary"
          :to="`/travel/requests/${item.id}`"
          :icon-right="ArrowRight"
          >Open</UiButton
        >
      </template>
      <template #detail="{ item }">
        <TravelSplitDetail :item="item" :why="whyText" />
      </template>
    </SplitInbox>

    <ReasonDialog
      v-model:open="declineOpen"
      title="Decline this trip?"
      description="The traveller is told why and can duplicate the request with changes."
      label="Tell them why"
      hint="The traveller and the requester see this reason in their email."
      confirm-label="Decline request"
      destructive
      :loading="pending === 'decline'"
      :error="declineError"
      @submit="(reason) => declining && run(declining, 'decline', { reason })"
    />
  </div>
</template>
