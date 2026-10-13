<script setup lang="ts">
import { CalendarClock, Eye, PenLine, Save, Trash2, X } from '@lucide/vue'
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import type { AttachmentDto } from '~/types/api'
import { newsKeys, postPath, useNewsTimeline } from '../api'
import type { CreateNewsPost, NewsPostDetail, NewsType } from '../api/types'
import { NEWS_ACTION_MESSAGES, NEWS_ACTIONS, NEWS_TYPE_OPTIONS } from '../constants'

/**
 * The news editor (SCREENS §8 /back-office/news/new and /[id]): title, type, summary (280 with a
 * counter), cover image (`news_cover`), the rich-text body, pinned and "expires at". The side panel
 * holds the status, Save, the lifecycle actions (Publish now, Schedule…, Unschedule, Archive,
 * Restore, Delete), a preview toggle and the timeline.
 */
const props = defineProps<{ post?: NewsPostDetail | null }>()

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const { confirm } = useConfirm()
const timeline = useNewsTimeline(() => props.post?.id)

const schema = toTypedSchema(
  z.object({
    title: z
      .string({ error: 'Give the post a title.' })
      .trim()
      .min(3, 'Give the post a title (at least 3 characters).')
      .max(140),
    type: z.enum(['changelog', 'update', 'information']),
    summary: z.string().max(280, 'Keep the summary under 280 characters.'),
    bodyHtml: z.string().max(50_000),
    pinned: z.boolean(),
    expireAt: z.string().nullable(),
  }),
)
const { defineField, errors, values, handleSubmit, isSubmitting, resetForm, setErrors, meta } =
  useForm({ validationSchema: schema })
const [title] = defineField('title')
const [type] = defineField<'type', NewsType>('type')
const [summary] = defineField('summary')
const [bodyHtml] = defineField('bodyHtml')
const [pinned] = defineField<'pinned', boolean>('pinned')
const [expireAt] = defineField('expireAt')

const uploads = ref<AttachmentDto[]>([])
const coverRemoved = ref(false)
const preview = ref(false)
const formError = ref<string | null>(null)

watch(
  () => props.post,
  (post) => {
    resetForm({
      values: {
        title: post?.title ?? '',
        type: post?.type ?? 'information',
        summary: post?.summary ?? '',
        bodyHtml: post?.bodyHtml ?? '',
        pinned: post?.pinned ?? false,
        expireAt: post?.expireAt ?? null,
      },
    })
    uploads.value = []
    coverRemoved.value = false
  },
  { immediate: true },
)

const actions = computed(() => props.post?.availableActions ?? [])
const editable = computed(() => !props.post || actions.value.includes('edit'))
const coverChanged = computed(() => uploads.value.length > 0 || coverRemoved.value)
const dirty = computed(() => meta.value.dirty || coverChanged.value)
const currentCover = computed(() =>
  coverRemoved.value || uploads.value.length ? null : (props.post?.coverImage ?? null),
)

const FIELDS = ['title', 'type', 'summary', 'bodyHtml', 'pinned', 'expireAt', 'coverImageId']

function applyErrors(error: unknown): boolean {
  if (!isApiError(error) || !error.isValidationError) return false
  const mapped: Record<string, string> = {}
  for (const [path, messages] of Object.entries(error.fieldErrors)) {
    if (FIELDS.includes(path)) mapped[path === 'coverImageId' ? 'title' : path] = messages[0] ?? ''
  }
  setErrors(mapped)
  if (error.fieldErrors.coverImageId) formError.value = error.fieldErrors.coverImageId[0] ?? null
  return true
}

async function persist(): Promise<NewsPostDetail | null> {
  formError.value = null
  let saved: NewsPostDetail | null = null
  await handleSubmit(async (v) => {
    const body: CreateNewsPost = {
      title: v.title.trim(),
      type: v.type,
      summary: v.summary.trim(),
      bodyHtml: v.bodyHtml,
      pinned: v.pinned,
      expireAt: v.expireAt || null,
    }
    if (coverChanged.value) body.coverImageId = uploads.value[0]?.id ?? null
    try {
      saved = props.post
        ? await api.patch<NewsPostDetail>(postPath(props.post.id), {
            ...body,
            version: props.post.version,
          })
        : await api.post<NewsPostDetail>('/news', body)
      await queryClient.invalidateQueries({ queryKey: newsKeys.posts.module })
    } catch (error) {
      if (applyErrors(error)) return
      if (isApiError(error) && error.code === 'version_conflict') {
        await queryClient.invalidateQueries({ queryKey: newsKeys.posts.module })
      }
      formError.value = describeError(error).detail ?? describeError(error).title
    }
  })()
  return saved
}

async function save() {
  const saved = await persist()
  if (!saved) return
  toast.success(props.post ? 'Changes saved.' : 'Draft saved.')
  if (!props.post) await navigateTo(`/back-office/news/${(saved as NewsPostDetail).id}`)
}

const pending = ref<string | null>(null)
async function run(action: string, body: Record<string, unknown> = {}) {
  if (!props.post) return
  if (dirty.value && action !== 'archive' && action !== 'restore') {
    const saved = await persist()
    if (!saved) return
  }
  pending.value = action
  try {
    await api.action<NewsPostDetail>(postPath(props.post.id), action, body)
    toast.success(NEWS_ACTION_MESSAGES[action] ?? 'Done.')
    scheduleOpen.value = false
    await queryClient.invalidateQueries({ queryKey: newsKeys.posts.module })
  } catch (error) {
    if (action === 'schedule' && isApiError(error) && error.isValidationError) {
      scheduleErrors.value = {
        publishAt: error.fieldError('publishAt') ?? null,
        expireAt: error.fieldError('expireAt') ?? null,
      }
      if (error.fieldError('summary') || error.fieldError('bodyHtml')) {
        applyErrors(error)
        scheduleOpen.value = false
      }
      return
    }
    if (!applyErrors(error)) toast.error(describeError(error))
    await queryClient.invalidateQueries({ queryKey: newsKeys.posts.module })
  } finally {
    pending.value = null
  }
}

// Schedule dialog --------------------------------------------------------------------------------
const scheduleOpen = ref(false)
const publishAt = ref<string | null>(null)
const scheduleExpire = ref<string | null>(null)
const scheduleErrors = ref<{ publishAt: string | null; expireAt: string | null }>({
  publishAt: null,
  expireAt: null,
})
function openSchedule() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(8, 0, 0, 0)
  publishAt.value = props.post?.publishAt ?? tomorrow.toISOString()
  scheduleExpire.value = values.expireAt ?? null
  scheduleErrors.value = { publishAt: null, expireAt: null }
  scheduleOpen.value = true
}
function submitSchedule() {
  if (!publishAt.value) {
    scheduleErrors.value = { publishAt: 'Pick when the post goes live.', expireAt: null }
    return
  }
  void run('schedule', { publishAt: publishAt.value, expireAt: scheduleExpire.value || null })
}

async function remove() {
  if (!props.post) return
  const ok = await confirm({
    title: 'Delete this post?',
    description: 'It is removed from the editor list. The history stays in the audit log.',
    confirmLabel: 'Delete post',
    destructive: true,
  })
  if (!ok) return
  try {
    await api.delete(postPath(props.post.id))
    toast.success('Post deleted.')
    await queryClient.invalidateQueries({ queryKey: newsKeys.posts.module })
    await navigateTo('/back-office/news')
  } catch (error) {
    toast.error(describeError(error))
  }
}

const summaryLength = computed(() => (values.summary ?? '').length)
</script>

<template>
  <div class="grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
    <form class="grid content-start gap-5" novalidate @submit.prevent="save">
      <fieldset :disabled="!editable" class="grid gap-5 border-0 p-0">
        <UiField label="Title" :error="errors.title">
          <UiInput v-model="title" :maxlength="140" data-testid="news-title" />
        </UiField>
        <div class="grid gap-5 sm:grid-cols-[minmax(0,1fr)_200px]">
          <UiField label="Type" :error="errors.type">
            <UiSegmented v-model="type" :options="NEWS_TYPE_OPTIONS" label="Type" />
          </UiField>
          <UiField label="Pinned">
            <UiSwitch v-model="pinned" label="Pin to the top" />
          </UiField>
        </div>
        <UiField
          label="Summary"
          hint="Shown on Home and in the news list. Plain text."
          :error="errors.summary"
        >
          <UiTextarea v-model="summary" :rows="2" :maxlength="280" data-testid="news-summary" />
          <span class="justify-self-end text-meta text-ink-subtle" aria-live="polite"
            >{{ summaryLength }} / 280</span
          >
        </UiField>
        <UiField label="Cover image" optional hint="PNG, JPEG or WebP. Shown at 2:1.">
          <div v-if="currentCover" class="flex items-center gap-3">
            <img
              :src="currentCover.url"
              alt="Current cover"
              class="h-16 w-32 rounded-md border border-rule object-cover"
            />
            <UiButton size="sm" variant="ghost" :icon="X" @click="coverRemoved = true"
              >Remove cover</UiButton
            >
          </div>
          <FileDrop v-else v-model="uploads" purpose="news_cover" :max="1" />
        </UiField>
        <UiField label="Article" :error="errors.bodyHtml">
          <div v-if="preview" class="rounded-md border border-rule bg-sheet px-5 py-4">
            <NewsBody :html="values.bodyHtml ?? ''" />
          </div>
          <NewsEditor v-else v-model="bodyHtml" :invalid="Boolean(errors.bodyHtml)" />
        </UiField>
        <UiField
          label="Expires at"
          optional
          hint="The post is archived automatically at this time."
          :error="errors.expireAt"
        >
          <UiDatePicker v-model="expireAt" time />
        </UiField>
      </fieldset>
      <p v-if="formError" role="alert" class="text-sm text-st-negative">{{ formError }}</p>
    </form>

    <aside class="grid content-start gap-6" aria-label="Publishing">
      <section class="grid gap-4 rounded-xl border border-rule bg-well p-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-md font-[650]">Status</h2>
          <StatusBadge enum="newsStatus" :value="post?.status ?? 'draft'" />
        </div>
        <p v-if="post?.status === 'scheduled' && post.publishAt" class="text-sm text-ink-muted">
          Goes live {{ formatDate(post.publishAt) }}, {{ formatTime(post.publishAt) }}.
        </p>
        <p
          v-else-if="post?.status === 'published' && post.publishedAt"
          class="text-sm text-ink-muted"
        >
          Published {{ formatDate(post.publishedAt) }}, {{ formatTime(post.publishedAt) }}.
        </p>
        <p v-if="post?.expireAt" class="text-sm text-ink-muted">
          Expires {{ formatDate(post.expireAt) }}, {{ formatTime(post.expireAt) }}.
        </p>
        <div class="grid gap-2">
          <UiButton
            v-if="editable"
            variant="secondary"
            :icon="Save"
            :loading="isSubmitting && !pending"
            :disabled="Boolean(post) && !dirty"
            data-testid="news-save"
            @click="save"
            >{{ post ? 'Save changes' : 'Save draft' }}</UiButton
          >
          <UiButton
            v-if="actions.includes('schedule')"
            :icon="CalendarClock"
            data-testid="news-schedule"
            @click="openSchedule"
            >Schedule…</UiButton
          >
          <ActionBar
            :actions="actions"
            :config="NEWS_ACTIONS"
            :pending="pending"
            :max="4"
            @run="(action, body) => run(action, body)"
          />
          <UiButton
            v-if="actions.includes('delete')"
            variant="danger"
            :icon="Trash2"
            @click="remove"
            >Delete post</UiButton
          >
        </div>
        <UiButton
          variant="ghost"
          size="sm"
          :icon="preview ? PenLine : Eye"
          class="justify-self-start"
          @click="preview = !preview"
          >{{ preview ? 'Back to editing' : 'Preview article' }}</UiButton
        >
      </section>
      <LifecycleTimeline
        v-if="post"
        :entries="timeline.data.value"
        :loading="timeline.isPending.value"
      />
      <WorkflowDiagram v-if="post" name="news_post" :current="post.status" />
    </aside>

    <UiDialog
      v-model:open="scheduleOpen"
      title="Schedule this post"
      description="It goes live automatically at the time you pick (at least 5 minutes from now)."
    >
      <form id="news-schedule-form" class="grid gap-4" novalidate @submit.prevent="submitSchedule">
        <UiField label="Publish at" :error="scheduleErrors.publishAt">
          <UiDatePicker v-model="publishAt" time />
        </UiField>
        <UiField label="Expires at" optional :error="scheduleErrors.expireAt">
          <UiDatePicker v-model="scheduleExpire" time />
        </UiField>
      </form>
      <template #footer>
        <UiButton variant="secondary" @click="scheduleOpen = false">Cancel</UiButton>
        <UiButton
          variant="primary"
          type="submit"
          form="news-schedule-form"
          :loading="pending === 'schedule'"
          >Schedule post</UiButton
        >
      </template>
    </UiDialog>
  </div>
</template>
