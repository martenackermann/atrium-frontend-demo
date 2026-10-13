<script setup lang="ts">
import { AlarmClock, ArrowRight, GraduationCap, Route, UserPlus } from '@lucide/vue'
import type { HomePeopleRequest, UpcomingItem } from '../api/types'
import { type OpenRequestRow, peopleRow, type RequestFilter, upcomingRow } from '../constants'

/**
 * "My open requests" (DESIGN §8.1; covers SCREENS' "Coming up"): trainings and trips of the next
 * 30 days plus my open people requests, sorted by date. Each row: type glyph, title, meta (mono
 * reference · dates · detail or urgency), a compact routing slip with "where it is" and the status.
 */
const props = defineProps<{
  upcoming: readonly UpcomingItem[]
  people: readonly HomePeopleRequest[]
  loading?: boolean
}>()

const auth = useAuthStore()
const initials = computed(() => (auth.me ? initialsOf(auth.me.displayName) : 'ME'))
const filter = ref<RequestFilter>('all')

const rows = computed<OpenRequestRow[]>(() =>
  [
    ...props.upcoming.map((item) => upcomingRow(item, initials.value)),
    ...props.people.map((request) => peopleRow(request, initials.value)),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
)
const visible = computed(() =>
  filter.value === 'all' ? rows.value : rows.value.filter((row) => row.module === filter.value),
)
const options = computed(() => {
  const present = new Set(rows.value.map((row) => row.module))
  return [
    { value: 'all' as const, label: 'All' },
    ...(present.has('travel') ? [{ value: 'travel' as const, label: 'Travel' }] : []),
    ...(present.has('training') ? [{ value: 'training' as const, label: 'Training' }] : []),
    ...(present.has('people') ? [{ value: 'people' as const, label: 'People' }] : []),
  ]
})
const viewAll = computed(
  () =>
    ({ all: null, travel: '/travel', training: '/training', people: '/people-requests' })[
      filter.value
    ],
)
</script>

<template>
  <section aria-labelledby="requests-heading" data-testid="open-requests">
    <header class="flex flex-wrap items-center gap-3 pb-3">
      <h2 id="requests-heading" class="text-lg font-[650] tracking-heading">My open requests</h2>
      <span class="num text-sm text-ink-subtle">{{ rows.length }}</span>
      <div class="ml-auto flex items-center gap-4 max-md:ml-0 max-md:w-full max-md:justify-between">
        <UiSegmented
          v-if="options.length > 2"
          v-model="filter"
          :options="options"
          label="Filter requests"
          size="sm"
        />
        <NuxtLink
          v-if="viewAll"
          :to="viewAll"
          class="inline-flex items-center gap-1 text-sm font-medium text-ink-muted no-underline hover:text-ink"
          >View all<ArrowRight class="size-3.5" aria-hidden="true"
        /></NuxtLink>
      </div>
    </header>

    <div v-if="loading" class="grid gap-3 border-t border-ink pt-4" aria-busy="true">
      <UiSkeleton v-for="index in 3" :key="index" class="h-14" />
    </div>
    <ul v-else-if="visible.length" class="m-0 list-none border-t border-ink p-0">
      <li v-for="row in visible" :key="row.key" class="request-row">
        <span class="req-glyph" aria-hidden="true">
          <component :is="row.glyph" class="size-4" />
        </span>
        <div class="min-w-0">
          <NuxtLink
            :to="internalLink(row.link, '/')"
            class="text-md leading-[22px] font-semibold text-ink no-underline hover:underline hover:decoration-rule-strong"
            >{{ row.title }}</NuxtLink
          >
          <p class="req-meta">
            <span v-if="row.reference" class="mono text-[12px] text-ink-subtle">{{
              row.reference
            }}</span>
            <template v-for="(part, index) in row.meta" :key="index">
              <span
                v-if="row.reference || index > 0"
                aria-hidden="true"
                class="mx-1.5 text-ink-subtle"
                >·</span
              >{{ part }}
            </template>
            <span
              v-if="row.urgent"
              class="inline-flex items-center gap-1 font-semibold text-st-negative"
            >
              <span aria-hidden="true" class="mx-0.5 font-normal text-ink-subtle">·</span>
              <AlarmClock class="size-3.5" aria-hidden="true" />{{ row.urgent }}
            </span>
          </p>
        </div>
        <div class="req-route min-w-0">
          <RoutingSlip :stops="row.stops" variant="compact" :summary="row.where" />
        </div>
        <div class="req-status">
          <StatusBadge
            :enum="row.status.enum"
            :value="row.status.value"
            :actor="row.status.actor"
          />
        </div>
      </li>
    </ul>
    <div v-else class="grid gap-4 border-t border-ink py-6">
      <p class="text-base text-ink-muted">
        No trainings or trips in the next 30 days, and no open people requests.
      </p>
      <div class="flex flex-wrap gap-2">
        <UiButton :icon="GraduationCap" to="/training/new">Request training</UiButton>
        <UiButton :icon="Route" to="/travel/new">Book a trip</UiButton>
        <UiButton :icon="UserPlus" to="/people-requests/new">Start a people request</UiButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.request-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 196px 150px;
  gap: 18px;
  align-items: center;
  padding: 16px 4px;
  border-bottom: 1px solid var(--rule);
}
.req-glyph {
  width: 32px;
  height: 32px;
  border-radius: var(--round-md);
  display: grid;
  place-items: center;
  background: var(--well);
  color: var(--ink-muted);
  box-shadow: inset 0 0 0 1px var(--rule);
}
.req-meta {
  margin-top: 2px;
  font-size: 13px;
  line-height: 18px;
  color: var(--ink-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.req-status {
  justify-self: end;
}
@media (max-width: 1279px) {
  .request-row {
    grid-template-columns: 32px minmax(0, 1fr) 150px;
  }
  .req-route {
    grid-column: 2 / 3;
    grid-row: 2;
  }
  .req-status {
    grid-row: 1;
    grid-column: 3;
  }
}
@media (max-width: 767px) {
  .request-row {
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 8px 12px;
    padding: 14px 0;
  }
  .req-route {
    grid-column: 2;
    grid-row: auto;
  }
  .req-meta {
    white-space: normal;
  }
  .req-status {
    grid-column: 2;
    grid-row: auto;
    justify-self: start;
  }
}
</style>
