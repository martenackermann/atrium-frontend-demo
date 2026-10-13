<script setup lang="ts">
import type { DataTableColumn } from '~/types/ui'
import { useRatings, useRatingStats } from '~/modules/training/api'
import type { Likert, TrainingRatingDto } from '~/modules/training/api/types'
import { IMPROVEMENT_OPTIONS, LIKERT_OPTIONS, ROUND_LABEL } from '~/modules/training/constants'

/**
 * Ratings overview (SCREENS §4.9): stats for the period (loop-1 averages and participation
 * rate, loop-2 statements as stacked bars, loop-3 distribution and certification rate, open
 * rounds) and every rating (`scope=all`) with state, round and search filters.
 */
definePageMeta({ title: 'Ratings overview', access: ['training_office', 'it_admin'] })

const enums = useEnums()
const list = useListQuery({ filters: ['state', 'loop', 'from', 'to'], defaultSort: 'dueAt' })
const range = computed(() => ({
  from: (list.state.value.filters.from as string) || null,
  to: (list.state.value.filters.to as string) || null,
}))
const setRange = (value: { from: string | null; to: string | null }) =>
  list.update({ filters: { from: value.from ?? '', to: value.to ?? '' } })
const stats = useRatingStats(computed(() => ({ from: range.value.from, to: range.value.to })))
const ratings = useRatings(
  computed(() => {
    const { from: _from, to: _to, ...rest } = list.apiQuery.value as Record<string, string | number>
    return { ...rest, scope: 'all' }
  }),
)

const ANY = 'any'
const filterModel = (key: string) =>
  computed<string>({
    get: () => String(list.state.value.filters[key] || ANY),
    set: (value) => list.setFilter(key, value === ANY ? undefined : value),
  })
const stateFilter = filterModel('state')
const loopFilter = filterModel('loop')

const s = computed(() => stats.data.value)
const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`
const grade = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toFixed(1)
const STATEMENTS = [
  { key: 'appliesLearned', label: 'Applies what was learned' },
  { key: 'supervisorSupported', label: 'Manager supported it' },
  { key: 'worthwhileForOrganization', label: 'Worthwhile for the organisation' },
] as const
const LIKERT_FILL: Record<Likert, string> = {
  A: 'bg-st-positive-line',
  B: 'bg-st-moving-line',
  C: 'bg-st-waiting-line',
  D: 'bg-st-negative-line',
}
function segments(dist: Record<Likert, number>) {
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1
  return LIKERT_OPTIONS.map((option) => ({
    ...option,
    count: dist[option.value],
    width: `${(dist[option.value] / total) * 100}%`,
  }))
}

const improvement = computed(() => {
  const dist = s.value?.loop3.distribution
  if (!dist) return []
  const values = IMPROVEMENT_OPTIONS.map((option) => dist[Number(option.value) as 1] ?? 0)
  const max = Math.max(1, ...values)
  return IMPROVEMENT_OPTIONS.map((option, index) => ({
    label: option.label,
    value: values[index]!,
    width: `${(values[index]! / max) * 100}%`,
  }))
})

const columns: DataTableColumn<TrainingRatingDto>[] = [
  {
    key: 'training',
    label: 'Training',
    required: true,
    mobile: 'title',
    value: (row) => row.training.topic,
  },
  {
    key: 'attendee',
    label: 'Attendee',
    value: (row) => row.attendee.user.displayName,
    mobile: 'meta',
  },
  { key: 'round', label: 'Round', value: (row) => `${row.loop} · ${ROUND_LABEL[row.loop]}` },
  { key: 'rater', label: 'Rater', value: (row) => row.rater.displayName },
  {
    key: 'dueAt',
    label: 'Due',
    sort: 'dueAt',
    value: (row) => formatDate(row.dueAt),
    mobile: 'meta',
  },
  { key: 'reminders', label: 'Reminders', align: 'right', width: '100px' },
  { key: 'state', label: 'State', mobile: 'status' },
]
</script>

<template>
  <PageBody wide>
    <PageHeader
      title="Ratings overview"
      subtitle="How trainings were rated, and which rounds are still open."
    >
      <template #actions>
        <DateRangeFilter
          :from="range.from"
          :to="range.to"
          label="Training ended"
          @change="setRange"
        />
      </template>
    </PageHeader>

    <div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard :value="s?.open.due" label="Due now" :loading="stats.isPending.value" />
      <StatCard :value="s?.open.overdue" label="Overdue" :loading="stats.isPending.value" />
      <StatCard
        :value="s?.open.maxedOut"
        label="All reminders sent"
        :loading="stats.isPending.value"
      />
      <StatCard
        :value="s?.loop1.submitted"
        label="Round-1 answers"
        :loading="stats.isPending.value"
      />
    </div>

    <div v-if="s" class="mt-6 grid gap-6 xl:grid-cols-3">
      <section class="rounded-lg border border-rule bg-sheet p-5" aria-labelledby="loop1-title">
        <h2 id="loop1-title" class="text-lg font-[650] tracking-heading">
          Round 1 · Your feedback
        </h2>
        <p class="mt-1 text-sm text-ink-muted">School grades, 1 excellent … 6 insufficient.</p>
        <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-ink-subtle">Took part</dt>
            <dd class="text-[22px] leading-8 font-semibold">{{ pct(s.loop1.participatedRate) }}</dd>
          </div>
          <div>
            <dt class="text-ink-subtle">Overall</dt>
            <dd class="text-[22px] leading-8 font-semibold">{{ grade(s.loop1.avgOverall) }}</dd>
          </div>
          <div>
            <dt class="text-ink-subtle">Trainer</dt>
            <dd class="text-[22px] leading-8 font-semibold">{{ grade(s.loop1.avgTrainer) }}</dd>
          </div>
          <div>
            <dt class="text-ink-subtle">Expectations</dt>
            <dd class="text-[22px] leading-8 font-semibold">
              {{ grade(s.loop1.avgExpectations) }}
            </dd>
          </div>
        </dl>
      </section>
      <section class="rounded-lg border border-rule bg-sheet p-5" aria-labelledby="loop2-title">
        <h2 id="loop2-title" class="text-lg font-[650] tracking-heading">Round 2 · In practice</h2>
        <p class="mt-1 text-sm text-ink-muted">{{ s.loop2.submitted }} answers.</p>
        <ul class="mt-4 grid gap-3">
          <li v-for="statement in STATEMENTS" :key="statement.key" class="grid gap-1">
            <span class="text-sm">{{ statement.label }}</span>
            <span class="flex h-2.5 overflow-hidden rounded-pill bg-well" aria-hidden="true">
              <span
                v-for="seg in segments(s.loop2.distribution[statement.key])"
                :key="seg.value"
                :class="LIKERT_FILL[seg.value]"
                :style="{ width: seg.width }"
              />
            </span>
            <span class="flex flex-wrap gap-x-3 gap-y-0.5 text-meta text-ink-muted">
              <span
                v-for="seg in segments(s.loop2.distribution[statement.key])"
                :key="seg.value"
                class="inline-flex items-center gap-1.5"
              >
                <span class="size-2 rounded-full" :class="LIKERT_FILL[seg.value]" />
                {{ seg.label }} <span class="num text-ink">{{ seg.count }}</span>
              </span>
            </span>
          </li>
        </ul>
      </section>
      <section class="rounded-lg border border-rule bg-sheet p-5" aria-labelledby="loop3-title">
        <h2 id="loop3-title" class="text-lg font-[650] tracking-heading">
          Round 3 · Manager's view
        </h2>
        <p class="mt-1 text-sm text-ink-muted">
          {{ s.loop3.submitted }} answers · certification {{ pct(s.loop3.certificationRate) }}
        </p>
        <p class="mt-4 text-sm text-ink-subtle">Improvement seen</p>
        <ul class="mt-2 grid list-none gap-2.5 p-0">
          <li
            v-for="bar in improvement"
            :key="bar.label"
            class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 text-sm"
          >
            <span class="truncate">{{ bar.label }}</span>
            <span class="num font-semibold">{{ bar.value }}</span>
            <span class="col-span-2 h-1.5 rounded-pill bg-viz-grid" aria-hidden="true">
              <span class="block h-full rounded-pill bg-viz-1" :style="{ width: bar.width }" />
            </span>
          </li>
        </ul>
      </section>
    </div>

    <DataTable
      class="mt-8"
      :columns="columns"
      :rows="ratings.data.value?.data"
      :meta="ratings.data.value?.meta"
      :loading="ratings.isPending.value"
      :error="ratings.error.value"
      :list="list"
      :row-to="(row) => `/training/ratings/${row.id}`"
      noun="ratings"
      search-placeholder="Search training, attendee or TRN-…"
      caption="All ratings"
      :empty="{
        title: 'No ratings in this period.',
        description: 'Rounds open when booked trainings end.',
      }"
      @retry="ratings.refetch()"
    >
      <template #filters>
        <UiSelect
          v-model="stateFilter"
          aria-label="State"
          :options="[
            { value: ANY, label: 'Any state' },
            ...['upcoming', 'due', 'overdue', 'submitted'].map((value) => ({
              value,
              label: enums.label('ratingState', value),
            })),
          ]"
          class="w-40"
        />
        <UiSelect
          v-model="loopFilter"
          aria-label="Round"
          :options="[
            { value: ANY, label: 'Any round' },
            { value: '1', label: 'Round 1' },
            { value: '2', label: 'Round 2' },
            { value: '3', label: 'Round 3' },
          ]"
          class="w-36"
        />
      </template>
      <template #cell-training="{ row }">
        <span class="font-medium">{{ row.training.topic }}</span>
        <span class="block text-meta text-ink-subtle mono">{{ row.training.reference }}</span>
      </template>
      <template #cell-reminders="{ row }">
        <span class="num" :class="row.reminderCount >= 4 && 'font-semibold text-st-negative'"
          >{{ row.reminderCount }} / 4</span
        >
      </template>
      <template #cell-state="{ row }">
        <StatusBadge enum="ratingState" :value="row.state" :actor="false" />
      </template>
    </DataTable>
  </PageBody>
</template>
