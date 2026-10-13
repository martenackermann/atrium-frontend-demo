<script setup lang="ts">
import { describeError, isApiError } from '~/lib/api'
import { dueLabel, namesDate } from '~/lib/due'
import { inboxIcon } from '~/lib/inbox'
import type { InboxItem } from '~/types/api'
import { QUICK_ACTION_LABELS, todoCta } from '../constants'

/**
 * One to-do in "Needs your attention" (DESIGN §8.1): glyph, title, subtitle with the due date,
 * and the action right there. Quick actions post to `${actionsPath}/actions/{action}`
 * (SPEC_RESOLUTIONS #4); Decline opens an inline reason panel (DESIGN principle 5, no modal).
 * To-dos without quick actions get one button that opens the item.
 */
const props = defineProps<{ item: InboxItem }>()

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const pending = ref<string | null>(null)
const declining = ref(false)
const reason = ref('')
const reasonError = ref<string | null>(null)

const due = computed(() => {
  const label = dueLabel(props.item.dueAt)
  // The subtitle already names the date (e.g. "effective Sun 18 Oct"): only flag it when overdue.
  if (!label || (namesDate(props.item.subtitle, props.item.dueAt) && !label.overdue)) return null
  return label
})

// A subtitle that ends a sentence ("I am ill and cannot travel.") loses its full stop when the
// due date and urgency follow it with "·".
const subtitleClause = computed(() => (props.item.subtitle ?? '').replace(/\.$/, ''))

// Asset subtitles already end with the tag ("Marlowe X5 · AST-00115"): don't repeat it.
const showReference = computed(
  () => Boolean(props.item.reference) && !props.item.subtitle?.includes(props.item.reference!),
)

const positive = computed(() => props.item.quickActions.filter((action) => action !== 'decline'))
const canDecline = computed(() => props.item.quickActions.includes('decline'))

async function run(action: string, body: Record<string, unknown> = {}) {
  pending.value = action
  reasonError.value = null
  try {
    if (!isInternalPath(props.item.actionsPath)) throw new Error('Unexpected action path')
    await api.action(props.item.actionsPath, action, body)
    toast.success(
      action === 'approve'
        ? 'Approved.'
        : action === 'decline'
          ? 'Declined.'
          : action === 'accept'
            ? 'Accepted.'
            : 'Done.',
    )
    declining.value = false
  } catch (error) {
    if (isApiError(error) && error.status === 422 && action === 'decline') {
      reasonError.value = error.fieldError('reason') ?? error.detail ?? error.title
      return
    }
    toast.error(describeError(error))
  } finally {
    pending.value = null
    await queryClient.invalidateQueries({ queryKey: ['summary'] })
  }
}

function submitDecline() {
  const text = reason.value.trim()
  if (text.length < 3) {
    reasonError.value = 'Add a reason. They need it to change the request.'
    return
  }
  void run('decline', { reason: text })
}
</script>

<template>
  <article class="attention-task" :data-testid="`attention-${item.type}`">
    <span class="glyph" aria-hidden="true">
      <component :is="inboxIcon(item)" class="size-5" />
    </span>
    <div class="min-w-0">
      <h3 class="text-md leading-[22px] font-semibold">
        <NuxtLink :to="internalLink(item.link, '/inbox')" class="no-underline hover:underline">{{
          item.title
        }}</NuxtLink>
      </h3>
      <!-- Meta line (DESIGN §8.1): mono ID · subtitle · due · urgency, one "·" between parts. -->
      <p class="mt-0.5 max-w-[64ch] text-[13.5px] leading-5 text-ink-muted">
        <span v-if="showReference" class="mono text-ink-subtle">{{ item.reference }}</span>
        <template v-if="item.subtitle"
          ><span v-if="showReference" aria-hidden="true"> · </span
          ><span>{{
            due || item.priority === 'high' ? subtitleClause : item.subtitle
          }}</span></template
        >
        <template v-if="due"
          ><span v-if="showReference || item.subtitle" aria-hidden="true"> · </span
          ><span :class="due.overdue && 'font-semibold text-st-negative'">{{
            due.text
          }}</span></template
        >
        <template v-if="item.priority === 'high'"
          ><span aria-hidden="true"> · </span
          ><span class="font-semibold text-st-negative">High priority</span></template
        >
      </p>
    </div>
    <div class="task-act">
      <template v-if="item.quickActions.length">
        <UiButton
          v-if="canDecline"
          variant="ghost"
          size="sm"
          :disabled="Boolean(pending)"
          :aria-expanded="declining"
          @click="((declining = !declining), (reasonError = null))"
          >{{ QUICK_ACTION_LABELS.decline }}</UiButton
        >
        <UiButton
          v-for="action in positive"
          :key="action"
          variant="primary"
          size="sm"
          :loading="pending === action"
          :disabled="Boolean(pending)"
          @click="run(action)"
          >{{ QUICK_ACTION_LABELS[action] ?? action.replace(/_/g, ' ') }}</UiButton
        >
      </template>
      <UiButton v-else size="sm" :to="internalLink(item.link, '/inbox')">{{
        todoCta(item)
      }}</UiButton>
    </div>
    <form v-if="declining" class="decline-panel" novalidate @submit.prevent="submitDecline">
      <UiField
        label="Tell them why"
        hint="The requester and their manager see this reason."
        :error="reasonError"
      >
        <UiTextarea v-model="reason" :rows="2" :maxlength="1000" autofocus />
      </UiField>
      <div class="flex justify-end gap-2">
        <UiButton size="sm" variant="ghost" @click="declining = false">Keep it</UiButton>
        <UiButton size="sm" variant="danger-solid" type="submit" :loading="pending === 'decline'"
          >Decline request</UiButton
        >
      </div>
    </form>
  </article>
</template>

<style scoped>
.attention-task {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 16px 0;
  border-top: 1px solid color-mix(in srgb, var(--marker-strong) 38%, transparent);
}
.glyph {
  width: 40px;
  height: 40px;
  border-radius: var(--round-lg);
  display: grid;
  place-items: center;
  background: var(--sheet);
  color: var(--ink);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--marker-strong) 40%, transparent);
}
.task-act {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-self: end;
}
.decline-panel {
  grid-column: 2 / -1;
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--round-lg);
  background: var(--st-negative-bg);
  box-shadow: inset 0 0 0 1px var(--st-negative-line);
}
@media (max-width: 767px) {
  .attention-task {
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 4px 12px;
    align-items: start;
  }
  .glyph {
    width: 36px;
    height: 36px;
  }
  .task-act {
    grid-column: 2;
    justify-self: start;
    margin-top: 10px;
    flex-wrap: wrap;
  }
  .decline-panel {
    grid-column: 1 / -1;
  }
}
</style>
