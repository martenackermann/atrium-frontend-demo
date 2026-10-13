<script setup lang="ts">
import { Lock, MessageCircleQuestion, Send, StickyNote } from '@lucide/vue'
import { describeError, isApiError } from '~/lib/api'
import { peopleKeys, requestPath, usePeopleComments } from '../api'
import type { PeopleCommentDto, PeopleRequestDetail } from '../api/types'

/**
 * Conversation (SCREENS §7.3/§7.4): the comment thread with questions and status notes, and a
 * composer. People Ops get an "Internal" toggle (internal comments look different and are never
 * shown to the requester). A requester's reply while People Ops waits moves the request back to
 * "In progress" — the composer says so before posting.
 */
const props = defineProps<{ request: PeopleRequestDetail }>()

const api = useApi()
const auth = useAuthStore()
const toast = useToast()
const queryClient = useQueryClient()
const comments = usePeopleComments(() => props.request.id)

const body = ref('')
const internal = ref(false)
const error = ref<string | null>(null)
const sending = ref(false)

const canComment = computed(() => props.request.availableActions.includes('comment'))
const canInternal = computed(() => props.request.availableActions.includes('comment_internal'))
const canWrite = computed(() => canComment.value || canInternal.value)
const viewerIsRequester = computed(() => auth.me?.id === props.request.requester.id)
const repliesToQuestion = computed(
  () =>
    viewerIsRequester.value && props.request.status === 'waiting_on_requester' && !internal.value,
)
watchEffect(() => {
  if (!canComment.value && canInternal.value) internal.value = true
})

const KIND = {
  question: { icon: MessageCircleQuestion, label: 'Question' },
  status_note: { icon: StickyNote, label: 'Status note' },
} as const

const label = (comment: PeopleCommentDto) =>
  comment.internal ? 'Internal' : comment.kind === 'comment' ? null : KIND[comment.kind].label

async function send() {
  const text = body.value.trim()
  error.value = null
  if (!text) {
    error.value = 'Write a comment first.'
    return
  }
  sending.value = true
  try {
    await api.post(`${requestPath(props.request.id)}/comments`, {
      body: text,
      ...(canInternal.value ? { internal: internal.value } : {}),
    })
    body.value = ''
    toast.success(
      repliesToQuestion.value
        ? 'Reply sent. The request is back with People Ops.'
        : internal.value
          ? 'Internal comment added.'
          : 'Comment sent.',
    )
    await queryClient.invalidateQueries({ queryKey: peopleKeys.requests.module })
  } catch (cause) {
    if (isApiError(cause) && cause.status === 422) {
      error.value = cause.fieldError('body') ?? cause.detail ?? cause.title
    } else {
      toast.error(describeError(cause))
    }
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section aria-labelledby="conversation-heading" class="grid gap-3">
    <h2 id="conversation-heading" class="text-lg font-[650] tracking-heading">Conversation</h2>
    <div class="border-t border-ink">
      <div v-if="comments.isPending.value" class="grid gap-3 py-4">
        <UiSkeleton class="h-14" />
        <UiSkeleton class="h-14" />
      </div>
      <ProblemAlert v-else-if="comments.error.value" :error="comments.error.value" class="mt-3" />
      <p
        v-else-if="!comments.data.value?.length"
        class="py-5 text-base text-ink-muted"
        data-testid="conversation-empty"
      >
        No comments yet. Questions and answers about this request appear here.
      </p>
      <ol v-else class="m-0 list-none p-0" data-testid="conversation">
        <li
          v-for="comment in comments.data.value"
          :key="comment.id"
          class="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b border-rule py-4"
          :class="comment.internal && 'bg-well -mx-3 px-3'"
        >
          <UiAvatar
            :name="comment.author.displayName"
            :initials="comment.author.initials"
            size="sm"
            :me="comment.author.id === auth.me?.id"
          />
          <div class="min-w-0">
            <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span class="font-semibold text-ink">{{ comment.author.displayName }}</span>
              <time :datetime="comment.createdAt" class="text-ink-subtle">{{
                formatDateTime(comment.createdAt)
              }}</time>
              <UiMiniChip
                v-if="label(comment)"
                :icon="comment.internal ? Lock : KIND[comment.kind as 'question']?.icon"
                :label="label(comment)!"
              />
            </p>
            <p
              class="mt-1 whitespace-pre-line"
              :class="
                comment.kind === 'question' && !comment.internal
                  ? 'font-display text-[17px] leading-[25px] text-ink'
                  : 'text-base text-ink'
              "
            >
              {{ comment.body }}
            </p>
          </div>
        </li>
      </ol>
    </div>

    <form v-if="canWrite" class="grid gap-3 pt-2" novalidate @submit.prevent="send">
      <UiField
        id="people-comment"
        :label="repliesToQuestion ? 'Your reply' : 'Add a comment'"
        :hint="
          repliesToQuestion
            ? 'Sending your reply moves the request back to In progress with People Ops.'
            : internal
              ? 'Internal comments are visible to People Ops only.'
              : 'The requester, the manager and People Ops see comments.'
        "
        :error="error"
      >
        <UiTextarea v-model="body" :rows="3" :maxlength="4000" />
      </UiField>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UiSwitch
          v-if="canInternal && canComment"
          v-model="internal"
          label="Internal"
          description="Only People Ops sees it"
        />
        <span v-else />
        <UiButton type="submit" variant="primary" :icon="Send" :loading="sending">
          {{
            repliesToQuestion ? 'Send reply' : internal ? 'Add internal comment' : 'Send comment'
          }}
        </UiButton>
      </div>
    </form>
    <p v-else class="text-sm text-ink-muted">
      {{
        request.status === 'completed' ||
        request.status === 'rejected' ||
        request.status === 'cancelled'
          ? 'This request is closed. Reopen it to add a comment.'
          : 'You can read this conversation but not comment on it.'
      }}
    </p>
  </section>
</template>
