<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { coreKeys } from '~/lib/query/core'
import type { AuditEntryDto, Page } from '~/types/api'
import type { DataTableColumn } from '~/types/ui'

/**
 * Admin · Audit (SCREENS §2 /admin/audit): every recorded change. Filters: module, entity type,
 * actor, action, date range; rows expand into the field-level diff.
 */
definePageMeta({ title: 'Audit log', access: ['it_admin'] })

const api = useApi()
const list = useListQuery({
  filters: ['module', 'entityType', 'actorId', 'action', 'from', 'to'],
  defaultSort: '-occurredAt',
})
const audit = useQuery({
  queryKey: computed(() => coreKeys.audit(list.apiQuery.value)),
  queryFn: ({ signal }) => api.get<Page<AuditEntryDto>>('/audit', list.apiQuery.value, { signal }),
  placeholderData: keepPreviousData,
})

const MODULES = [
  { value: 'any', label: 'All modules' },
  { value: 'core', label: 'Core' },
  { value: 'training', label: 'Training' },
  { value: 'travel', label: 'Travel' },
  { value: 'assets', label: 'Assets' },
  { value: 'people', label: 'People' },
  { value: 'news', label: 'News' },
]
// "any" = no filter (select items can't have an empty value).
const filter = (key: string) =>
  computed<string>({
    get: () => String(list.state.value.filters[key] || (key === 'module' ? 'any' : '')),
    set: (value) => list.setFilter(key, value && value !== 'any' ? value : undefined),
  })
const moduleFilter = filter('module')
const entityTypeFilter = filter('entityType')
const actionFilter = filter('action')
const range = computed({
  get: () => ({
    start: (list.state.value.filters.from as string) || null,
    end: (list.state.value.filters.to as string) || null,
  }),
  set: (value: { start: string | null; end: string | null }) =>
    list.update({ filters: { from: value.start ?? '', to: value.end ?? '' } }),
})

const ACTING: Record<string, string> = {
  self: '',
  deputy: 'as deputy',
  manager_chain: 'via manager chain',
  office: 'as office',
  admin: 'as admin',
  system: 'system',
}

const columns: DataTableColumn<AuditEntryDto>[] = [
  {
    key: 'occurredAt',
    label: 'Time',
    sort: 'occurredAt',
    width: '150px',
    value: (row) => formatDateTime(row.occurredAt),
    mobile: 'meta',
  },
  { key: 'actor', label: 'Actor', value: (row) => row.actor?.displayName ?? 'Atrium' },
  { key: 'module', label: 'Module', width: '100px', hidden: true },
  {
    key: 'entity',
    label: 'Entity',
    required: true,
    value: (row) => row.entityLabel,
    mobile: 'title',
  },
  { key: 'action', label: 'Action', format: 'mono' },
  {
    key: 'states',
    label: 'From → to',
    value: (row) =>
      row.fromState || row.toState ? `${row.fromState ?? '—'} → ${row.toState ?? '—'}` : '',
  },
  { key: 'summary', label: 'Summary', mobile: 'meta' },
  { key: 'diff', label: '', width: '44px', required: true, mobile: 'hidden' },
]

const expanded = ref<Set<string>>(new Set())
function toggle(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}
</script>

<template>
  <PageBody wide>
    <PageHeader title="Audit log" subtitle="Every state change and edit, newest first." />

    <DataTable
      class="mt-6"
      :columns="columns"
      :rows="audit.data.value?.data"
      :meta="audit.data.value?.meta"
      :loading="audit.isPending.value"
      :error="audit.error.value"
      :list="list"
      noun="audit entries"
      storage-key="admin-audit"
      search-placeholder="Search summaries"
      caption="Audit log"
      :empty="{ title: 'No audit entries in this range.' }"
      @retry="audit.refetch()"
    >
      <template #filters>
        <UiSelect
          v-model="moduleFilter"
          size="sm"
          aria-label="Module"
          :options="MODULES"
          class="w-36"
        />
        <UiInput
          v-model.lazy="entityTypeFilter"
          aria-label="Entity type"
          placeholder="Entity type"
          class="w-36"
        />
        <UiInput
          v-model.lazy="actionFilter"
          aria-label="Action"
          placeholder="Action"
          class="w-32"
        />
        <DateRangeFilter v-model="range" label="Date" />
      </template>
      <template #cell-actor="{ row }">
        {{ row.actor?.displayName ?? 'Atrium' }}
        <span v-if="ACTING[row.actingAs]" class="text-sm text-ink-muted">{{
          ACTING[row.actingAs]
        }}</span>
      </template>
      <template #cell-summary="{ row }">
        <span>{{ row.summary }}</span>
        <q v-if="row.reason" class="mt-0.5 block text-sm text-ink-muted">{{ row.reason }}</q>
        <ul v-if="expanded.has(row.id) && row.changes?.length" class="mt-2 grid gap-1 text-sm">
          <li v-for="change in row.changes" :key="change.field">
            <span class="font-medium">{{ change.label }}:</span>
            <span class="text-ink-muted line-through">{{ change.from ?? '—' }}</span>
            → <span>{{ change.to ?? '—' }}</span>
          </li>
        </ul>
      </template>
      <template #cell-diff="{ row }">
        <UiIconButton
          v-if="row.changes?.length"
          :icon="ChevronDown"
          :label="expanded.has(row.id) ? 'Hide changes' : 'Show changes'"
          :aria-expanded="expanded.has(row.id)"
          :class="expanded.has(row.id) && 'rotate-180'"
          @click.stop="toggle(row.id)"
        />
      </template>
    </DataTable>
  </PageBody>
</template>
