<script setup lang="ts">
import { History, Play } from '@lucide/vue'
import { describeError } from '~/lib/api'
import { coreKeys } from '~/lib/query/core'
import type { JobDto, JobRunDto, Page } from '~/types/api'

/**
 * Admin · Jobs (SCREENS §2 /admin/jobs, SPEC §8): a card per scheduled job — schedule, next run,
 * last run with its summary — with "Run now" and a paged runs drawer.
 */
definePageMeta({ title: 'Jobs', access: ['it_admin'] })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const demo = useDemoMode()

const jobs = useQuery({
  queryKey: coreKeys.jobs,
  queryFn: ({ signal }) => api.get<JobDto[]>('/admin/jobs', undefined, { signal }),
})

const running = ref<string | null>(null)
async function runNow(job: JobDto) {
  running.value = job.name
  try {
    await api.post(`/admin/jobs/${encodeURIComponent(job.name)}/run`, {})
    toast.success(
      demo.isMsw.value
        ? 'Started. The run appears below in a moment.'
        : 'Started. Emails appear in the demo mailbox.',
    )
    await queryClient.invalidateQueries({ queryKey: coreKeys.jobs })
  } catch (error) {
    toast.error(describeError(error))
  } finally {
    running.value = null
  }
}

// Runs drawer
const runsFor = ref<JobDto | null>(null)
const runsOpen = computed({
  get: () => runsFor.value !== null,
  set: (value) => {
    if (!value) runsFor.value = null
  },
})
const runsPage = ref(1)
const runs = useQuery({
  queryKey: computed(() => coreKeys.jobRuns(runsFor.value?.name ?? '', { page: runsPage.value })),
  queryFn: ({ signal }) =>
    api.get<Page<JobRunDto>>(
      `/admin/jobs/${encodeURIComponent(runsFor.value!.name)}/runs`,
      { page: runsPage.value, perPage: 10 },
      { signal },
    ),
  enabled: computed(() => runsFor.value !== null),
})
function openRuns(job: JobDto) {
  runsPage.value = 1
  runsFor.value = job
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
/** "15 7 * * *" → "Daily at 07:15"; falls back to the cron expression. */
function humanCron(cron: string | null) {
  if (!cron) return 'Manual only'
  const [minute, hour, dom, month, dow] = cron.trim().split(/\s+/)
  const time =
    /^\d+$/.test(minute ?? '') && /^\d+$/.test(hour ?? '')
      ? `${hour!.padStart(2, '0')}:${minute!.padStart(2, '0')}`
      : null
  if (time && dom === '*' && month === '*' && dow === '*') return `Daily at ${time}`
  if (time && dom === '*' && month === '*' && dow === '1-5') return `Weekdays at ${time}`
  if (time && dom === '*' && month === '*' && /^\d$/.test(dow ?? ''))
    return `${DAYS[Number(dow) % 7]}s at ${time}`
  if (/^\*\/\d+$/.test(minute ?? '') && hour === '*') return `Every ${minute!.slice(2)} minutes`
  if (minute === '0' && hour === '*') return 'Hourly'
  return cron
}
const duration = (run: JobRunDto) =>
  run.finishedAt
    ? `${Math.max(0, Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000))} s`
    : 'running'
const RUN_TONE = { running: 'waiting', succeeded: 'positive', failed: 'neutral' } as const
</script>

<template>
  <PageBody>
    <PageHeader
      title="Jobs"
      subtitle="Scheduled work: reminders, digests, publishing and clean-up."
    />

    <ProblemAlert
      v-if="jobs.error.value"
      class="mt-6"
      :error="jobs.error.value"
      :retry="() => jobs.refetch()"
    />
    <div v-else-if="jobs.isPending.value" class="mt-6 grid gap-3 md:grid-cols-2">
      <UiSkeleton v-for="index in 4" :key="index" class="h-40 rounded-lg" />
    </div>
    <ul v-else class="m-0 mt-6 grid list-none gap-3 p-0 md:grid-cols-2">
      <li
        v-for="job in jobs.data.value ?? []"
        :key="job.name"
        class="grid content-start gap-3 rounded-lg border border-rule bg-sheet p-4 shadow-sheet"
        :data-testid="`job-${job.name}`"
      >
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="mono text-[13.5px] font-semibold">{{ job.name }}</h2>
            <p class="mt-1 text-base text-ink-muted">{{ job.description }}</p>
          </div>
          <UiTag tone="neutral">{{ job.slice === 'F' ? 'Foundation' : job.slice }}</UiTag>
        </div>
        <FactGrid
          :columns="2"
          :items="[
            { label: 'Schedule', value: job.enabled ? humanCron(job.cron) : 'Disabled' },
            { label: 'Next run', value: job.nextRunAt ? formatDateTime(job.nextRunAt) : '—' },
          ]"
        />
        <div v-if="job.lastRun" class="grid gap-1.5 border-t border-rule pt-3 text-sm">
          <div class="flex items-center gap-2">
            <UiTag :tone="RUN_TONE[job.lastRun.status]">{{ job.lastRun.status }}</UiTag>
            <span class="text-ink-muted">
              Last run {{ formatAge(job.lastRun.startedAt) }} · {{ duration(job.lastRun) }} ·
              {{
                job.lastRun.triggeredBy === 'manual'
                  ? `by ${job.lastRun.triggeredByUser?.displayName ?? 'an admin'}`
                  : 'scheduled'
              }}
            </span>
          </div>
          <dl
            v-if="Object.keys(job.lastRun.summary).length"
            class="m-0 flex flex-wrap gap-x-4 gap-y-1"
          >
            <div v-for="(value, key) in job.lastRun.summary" :key="key" class="flex gap-1.5">
              <dt class="text-ink-muted">{{ key }}</dt>
              <dd class="num m-0 font-medium">{{ value }}</dd>
            </div>
          </dl>
          <p v-if="job.lastRun.error" class="text-st-negative">{{ job.lastRun.error }}</p>
        </div>
        <p v-else class="border-t border-rule pt-3 text-sm text-ink-muted">Hasn't run yet.</p>
        <div class="flex flex-wrap gap-2">
          <UiButton
            size="sm"
            variant="secondary"
            :icon="Play"
            :loading="running === job.name"
            :disabled="Boolean(running) || !job.enabled"
            @click="runNow(job)"
            >Run now</UiButton
          >
          <UiButton size="sm" variant="ghost" :icon="History" @click="openRuns(job)"
            >View runs</UiButton
          >
        </div>
      </li>
    </ul>

    <UiDrawer
      v-model:open="runsOpen"
      :title="runsFor ? `Runs of ${runsFor.name}` : 'Runs'"
      width="480px"
    >
      <div v-if="runs.isPending.value" class="grid gap-2">
        <UiSkeleton v-for="index in 4" :key="index" class="h-14" />
      </div>
      <p v-else-if="!runs.data.value?.data.length" class="text-ink-muted">No runs yet.</p>
      <ol v-else class="m-0 grid list-none gap-0 p-0">
        <li
          v-for="run in runs.data.value.data"
          :key="run.id"
          class="grid gap-1 border-b border-rule py-3 text-sm"
        >
          <div class="flex items-center gap-2">
            <UiTag :tone="RUN_TONE[run.status]">{{ run.status }}</UiTag>
            <span>{{ formatDateTime(run.startedAt) }}</span>
            <span class="ml-auto text-ink-muted">{{ duration(run) }}</span>
          </div>
          <p class="text-ink-muted">
            {{
              run.triggeredBy === 'manual'
                ? `Started by ${run.triggeredByUser?.displayName ?? 'an admin'}`
                : 'Scheduled run'
            }}
            <template v-if="Object.keys(run.summary).length">
              ·
              {{
                Object.entries(run.summary)
                  .map(([key, value]) => `${key} ${value}`)
                  .join(' · ')
              }}
            </template>
          </p>
          <p v-if="run.error" class="text-st-negative">{{ run.error }}</p>
        </li>
      </ol>
      <div
        v-if="(runs.data.value?.meta.totalPages ?? 1) > 1"
        class="mt-3 flex items-center justify-between"
      >
        <UiButton size="sm" variant="secondary" :disabled="runsPage <= 1" @click="runsPage--"
          >Newer</UiButton
        >
        <span class="num text-sm text-ink-muted"
          >{{ runsPage }} / {{ runs.data.value?.meta.totalPages }}</span
        >
        <UiButton
          size="sm"
          variant="secondary"
          :disabled="runsPage >= (runs.data.value?.meta.totalPages ?? 1)"
          @click="runsPage++"
          >Older</UiButton
        >
      </div>
    </UiDrawer>
  </PageBody>
</template>
