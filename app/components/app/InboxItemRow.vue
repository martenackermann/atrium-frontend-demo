<script setup lang="ts">
import { describeError, isApiError } from '~/lib/api'
import { inboxIcon } from '~/lib/inbox'
import type { InboxItem } from '~/types/api'

/**
 * One inbox to-do (SCREENS §1.4): module icon, title, subtitle, due date (relative; negative when
 * past), high-priority marker, "as deputy" chip and inline quick actions (Approve; Decline →
 * reason dialog) posted to `${actionsPath}/actions/{action}`. The row links to the item.
 */
const props = defineProps<{ item: InboxItem }>()
const emit = defineEmits<{ navigate: [] }>()

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const pending = ref<string | null>(null)
const declineOpen = ref(false)
const declineError = ref<string | null>(null)

const due = computed(() => {
  const days = daysFromToday(props.item.dueAt)
  if (days === null) return null
  if (days < 0)
    return {
      text:
        days === -1
          ? 'Due yesterday'
          : `Overdue since ${formatDate(props.item.dueAt, { weekday: false })}`,
      overdue: true,
    }
  if (days === 0) return { text: 'Due today', overdue: false }
  if (days === 1) return { text: 'Due tomorrow', overdue: false }
  return { text: `Due ${formatDate(props.item.dueAt)}`, overdue: false }
})

async function run(action: string, body: Record<string, unknown> = {}) {
  pending.value = action
  try {
    if (!isInternalPath(props.item.actionsPath)) throw new Error('Unexpected action path')
    await api.action(props.item.actionsPath, action, body)
    toast.success(action === 'approve' ? 'Approved.' : action === 'decline' ? 'Declined.' : 'Done.')
    declineOpen.value = false
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
</script>

<template>
  <article
    class="grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-b border-rule px-5 py-3.5"
    :data-testid="`inbox-item-${item.type}`"
  >
    <span
      class="grid size-8 place-items-center rounded-md bg-well text-ink-muted shadow-[inset_0_0_0_1px_var(--rule)]"
      aria-hidden="true"
    >
      <component :is="inboxIcon(item)" class="size-4" />
    </span>
    <div class="min-w-0">
      <NuxtLink
        :to="internalLink(item.link, '/inbox')"
        class="block text-base leading-5 font-semibold text-ink no-underline hover:underline hover:decoration-rule-strong"
        @click="emit('navigate')"
      >
        {{ item.title }}
      </NuxtLink>
      <p class="mt-px text-[12.5px] leading-[18px] text-ink-muted">
        <span v-if="item.subtitle">{{ item.subtitle }}</span>
        <template v-if="due">
          <span v-if="item.subtitle" aria-hidden="true"> · </span>
          <span :class="due.overdue && 'font-semibold text-st-negative'">{{ due.text }}</span>
        </template>
      </p>
      <div
        v-if="item.priority === 'high' || item.actingAs === 'deputy'"
        class="mt-1.5 flex flex-wrap gap-1.5"
      >
        <span v-if="item.priority === 'high'" class="text-meta font-semibold text-st-negative"
          >High priority</span
        >
        <UiMiniChip v-if="item.actingAs === 'deputy'" label="as deputy" />
      </div>
      <div v-if="item.quickActions.length" class="mt-2.5 flex gap-1.5">
        <UiButton
          v-if="item.quickActions.includes('approve')"
          variant="primary"
          size="sm"
          :loading="pending === 'approve'"
          :disabled="Boolean(pending)"
          @click="run('approve')"
          >Approve</UiButton
        >
        <UiButton
          v-if="item.quickActions.includes('decline')"
          variant="ghost"
          size="sm"
          :disabled="Boolean(pending)"
          @click="((declineError = null), (declineOpen = true))"
          >Decline…</UiButton
        >
      </div>
    </div>
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
      @submit="(reason) => run('decline', { reason })"
    />
  </article>
</template>
