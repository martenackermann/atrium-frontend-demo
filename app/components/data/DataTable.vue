<script setup lang="ts" generic="T extends { id: string }">
import { NuxtLink } from '#components'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Search,
  SearchX,
  TriangleAlert,
} from '@lucide/vue'
import type { RouteLocationRaw } from 'vue-router'
import type { ListQueryController } from '~/composables/useListQuery'
import { describeError } from '~/lib/api'
import { PER_PAGE_OPTIONS, sortDirection } from '~/lib/list-query'
import type { PageMeta } from '~/types/api'
import type { DataTableColumn } from '~/types/ui'

/**
 * DataTable (DESIGN §9, SCREENS §1.6/§1.7): toolbar (search, filters slot, Clear, column menu,
 * export) · ink top rule · sticky well header · 40px rows · pagination "1–25 of 312" + page size.
 * Server-side: bind `list` (useListQuery) so page/sort/search/filters live in the URL.
 * Loading = 8 skeleton rows; empty = EmptyState in the body; error row with Retry.
 * Below 768px rows become a list: title + status, meta lines, chevron.
 *
 *   <DataTable :columns="columns" :rows="query.data.value?.data" :meta="query.data.value?.meta"
 *              :loading="query.isPending.value" :error="query.error.value" :list="list"
 *              :row-to="(row) => `/travel/requests/${row.id}`" noun="trips"
 *              :empty="{ title: 'No trips yet', description: 'Book a rental car, a train journey or a flight.' }">
 *     <template #filters>…</template>
 *     <template #cell-status="{ row }"><StatusBadge enum="travelStatus" :value="row.status" /></template>
 *   </DataTable>
 */
const props = withDefaults(
  defineProps<{
    columns: readonly DataTableColumn<T>[]
    rows: readonly T[] | null | undefined
    meta?: PageMeta | null
    loading?: boolean
    error?: unknown
    list?: ListQueryController
    rowTo?: (row: T) => RouteLocationRaw
    /** Plural noun for messages: "Couldn't load assets." */
    noun?: string
    empty?: { title: string; description?: string }
    searchPlaceholder?: string
    /** CSV export endpoint (fetched with the session, same filters). */
    exportPath?: string
    exportFilename?: string
    /** Remember column visibility under this key (localStorage). */
    storageKey?: string
    caption?: string
  }>(),
  { noun: 'items', searchPlaceholder: 'Search' },
)
const emit = defineEmits<{ retry: [] }>()
const slots = useSlots()

const api = useApi()
const toast = useToast()

// Column visibility (column chooser), remembered per table.
const hiddenStore = useLocalStorage<string[]>(
  `atrium.table.${props.storageKey ?? 'default'}.hidden`,
  props.columns.filter((column) => column.hidden).map((column) => column.key),
)
const visibleColumns = computed(() =>
  props.columns.filter((column) => column.required || !hiddenStore.value.includes(column.key)),
)
function toggleColumn(key: string, visible: boolean | 'indeterminate') {
  hiddenStore.value = visible
    ? hiddenStore.value.filter((item) => item !== key)
    : [...hiddenStore.value, key]
}

// Debounced search bound to the URL.
const search = ref(props.list?.state.value.q ?? '')
watch(
  () => props.list?.state.value.q,
  (value) => {
    if (value !== undefined && value !== search.value.trim()) search.value = value
  },
)
watchDebounced(
  search,
  (value) => {
    if (props.list && value.trim() !== props.list.state.value.q) props.list.setSearch(value)
  },
  { debounce: 300 },
)

const range = computed(() => {
  const meta = props.meta
  if (!meta || meta.total === 0) return null
  const start = (meta.page - 1) * meta.perPage + 1
  return { start, end: Math.min(meta.page * meta.perPage, meta.total), total: meta.total }
})

function cellValue(row: T, column: DataTableColumn<T>): string {
  const raw = column.value ? column.value(row) : (row as Record<string, unknown>)[column.key]
  if (raw === null || raw === undefined || raw === '') return '—'
  if (column.format === 'money') return formatMoney(raw as never)
  if (column.format === 'date') return formatDate(raw as string)
  return String(raw)
}

function onRowClick(row: T, event: MouseEvent) {
  if (!props.rowTo) return
  const target = event.target as HTMLElement
  if (target.closest('a,button,input,[role=menu]')) return
  void navigateTo(props.rowTo(row))
}

const exporting = ref(false)
async function exportCsv() {
  if (!props.exportPath) return
  exporting.value = true
  try {
    const query = { ...(props.list?.apiQuery.value ?? {}) } as Record<string, unknown>
    delete query.page
    delete query.perPage
    const blob = await api.get<Blob>(props.exportPath, query, { parse: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = props.exportFilename ?? 'export.csv'
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    toast.error(describeError(error))
  } finally {
    exporting.value = false
  }
}

const titleColumn = computed(
  () => props.columns.find((column) => column.mobile === 'title') ?? props.columns[0],
)
const statusColumn = computed(() => props.columns.find((column) => column.mobile === 'status'))
const metaColumns = computed(() =>
  props.columns.filter((column) => column.mobile === 'meta').slice(0, 3),
)
const perPageOptions = PER_PAGE_OPTIONS.map((value) => ({ value, label: `${value} per page` }))
</script>

<template>
  <div class="grid min-w-0 gap-3">
    <div v-if="list || $slots.filters || exportPath" class="flex flex-wrap items-end gap-2">
      <div v-if="list" class="relative w-full sm:w-72">
        <Search
          class="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-ink-subtle"
          aria-hidden="true"
        />
        <UiInput
          v-model="search"
          type="search"
          :aria-label="searchPlaceholder"
          :placeholder="searchPlaceholder"
          class="[&_input]:pl-9"
        />
      </div>
      <slot name="filters" />
      <UiButton
        v-if="list && list.activeFilterCount.value > 0"
        variant="ghost"
        size="sm"
        @click="list.clear()"
      >
        Clear
      </UiButton>
      <div class="ml-auto flex items-center gap-1">
        <UiMenu>
          <template #trigger>
            <UiIconButton :icon="Columns3" label="Choose columns" />
          </template>
          <UiMenuLabel>Columns</UiMenuLabel>
          <div class="grid gap-2 px-2.5 py-1.5">
            <UiCheckbox
              v-for="column in columns.filter((item) => !item.required)"
              :key="column.key"
              :model-value="!hiddenStore.includes(column.key)"
              :label="column.label"
              @update:model-value="(value) => toggleColumn(column.key, value)"
            />
          </div>
        </UiMenu>
        <UiButton
          v-if="exportPath"
          variant="secondary"
          size="sm"
          :icon="Download"
          :loading="exporting"
          @click="exportCsv"
        >
          Export CSV
        </UiButton>
      </div>
    </div>

    <!-- Desktop table -->
    <div class="max-md:hidden overflow-x-auto border-t border-ink">
      <table class="w-full border-collapse text-base">
        <caption v-if="caption" class="sr">
          {{
            caption
          }}
        </caption>
        <thead class="sticky top-0 z-[1] bg-well">
          <tr>
            <th
              v-for="column in visibleColumns"
              :key="column.key"
              scope="col"
              :style="{ width: column.width }"
              :aria-sort="
                column.sort && list
                  ? sortDirection(list.state.value.sort, column.sort) === 'asc'
                    ? 'ascending'
                    : sortDirection(list.state.value.sort, column.sort) === 'desc'
                      ? 'descending'
                      : 'none'
                  : undefined
              "
              class="h-9 border-b border-rule px-3 text-[12.5px] font-semibold whitespace-nowrap text-ink-muted"
              :class="
                column.align === 'right'
                  ? 'text-right'
                  : column.align === 'center'
                    ? 'text-center'
                    : 'text-left'
              "
            >
              <button
                v-if="column.sort && list"
                type="button"
                class="inline-flex items-center gap-1 hover:text-ink"
                @click="list.toggleSort(column.sort)"
              >
                {{ column.label }}
                <ArrowUp
                  v-if="sortDirection(list.state.value.sort, column.sort) === 'asc'"
                  class="size-3.5"
                  aria-hidden="true"
                />
                <ArrowDown
                  v-else-if="sortDirection(list.state.value.sort, column.sort) === 'desc'"
                  class="size-3.5"
                  aria-hidden="true"
                />
              </button>
              <template v-else>{{ column.label }}</template>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="index in 8" :key="`skeleton-${index}`" class="h-10 border-b border-rule">
              <td v-for="column in visibleColumns" :key="column.key" class="px-3">
                <UiSkeleton
                  class="h-3.5"
                  :class="column.align === 'right' ? 'ml-auto w-12' : 'w-3/4'"
                />
              </td>
            </tr>
          </template>
          <tr v-else-if="error">
            <td :colspan="visibleColumns.length" class="px-3 py-6">
              <div class="flex items-center gap-3 text-base">
                <TriangleAlert class="size-4 text-st-negative" aria-hidden="true" />
                <span
                  >Couldn't load {{ noun }}.
                  {{ describeError(error).detail ?? 'Check your connection and try again.' }}</span
                >
                <UiButton size="sm" variant="secondary" class="ml-auto" @click="emit('retry')"
                  >Try again</UiButton
                >
              </div>
            </td>
          </tr>
          <tr v-else-if="!rows?.length">
            <td :colspan="visibleColumns.length">
              <slot name="empty">
                <EmptyState
                  :icon="list?.activeFilterCount.value ? SearchX : undefined"
                  :title="
                    list?.activeFilterCount.value
                      ? `No ${noun} match these filters`
                      : (empty?.title ?? `No ${noun} yet`)
                  "
                  :description="
                    list?.activeFilterCount.value
                      ? 'Change or clear the filters to see more.'
                      : empty?.description
                  "
                  compact
                />
              </slot>
            </td>
          </tr>
          <template v-else>
            <tr
              v-for="row in rows"
              :key="row.id"
              class="h-10 border-b border-rule transition-colors duration-(--dur-1) hover:bg-hover"
              :class="rowTo && 'cursor-pointer'"
              @click="onRowClick(row, $event)"
            >
              <td
                v-for="(column, index) in visibleColumns"
                :key="column.key"
                class="px-3 py-2.5"
                :class="[
                  column.align === 'right'
                    ? 'text-right'
                    : column.align === 'center'
                      ? 'text-center'
                      : 'text-left',
                  column.format === 'mono' && 'font-mono text-[13px]',
                  column.format === 'money' && 'font-mono text-[13px]',
                  column.format === 'num' && 'num',
                ]"
              >
                <slot :name="`cell-${column.key}`" :row="row">
                  <NuxtLink
                    v-if="index === 0 && rowTo"
                    :to="rowTo(row)"
                    class="font-medium no-underline hover:underline"
                    >{{ cellValue(row, column) }}</NuxtLink
                  >
                  <template v-else>{{ cellValue(row, column) }}</template>
                </slot>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Mobile row list -->
    <ul class="m-0 list-none border-t border-ink p-0 md:hidden">
      <template v-if="loading">
        <li v-for="index in 5" :key="index" class="grid gap-2 border-b border-rule py-3.5">
          <UiSkeleton class="h-4 w-2/3" /><UiSkeleton class="h-3 w-1/2" />
        </li>
      </template>
      <li v-else-if="error" class="grid gap-2 py-4 text-base">
        Couldn't load {{ noun }}. Check your connection and try again.
        <UiButton size="sm" variant="secondary" class="justify-self-start" @click="emit('retry')"
          >Try again</UiButton
        >
      </li>
      <li v-else-if="!rows?.length">
        <EmptyState
          :title="empty?.title ?? `No ${noun} yet`"
          :description="empty?.description"
          compact
        />
      </li>
      <li v-for="row in rows ?? []" v-else :key="row.id" class="border-b border-rule">
        <component
          :is="rowTo ? NuxtLink : 'div'"
          :to="rowTo?.(row)"
          class="flex items-center gap-3 py-3.5 text-ink no-underline"
        >
          <div class="grid min-w-0 flex-1 gap-1">
            <div class="flex items-start justify-between gap-2">
              <span class="min-w-0 font-semibold">
                <slot
                  v-if="titleColumn && slots[`cell-${titleColumn.key}`]"
                  :name="`cell-${titleColumn.key}`"
                  :row="row"
                />
                <template v-else-if="titleColumn">{{ cellValue(row, titleColumn) }}</template>
              </span>
              <slot v-if="statusColumn" :name="`cell-${statusColumn.key}`" :row="row">{{
                cellValue(row, statusColumn)
              }}</slot>
            </div>
            <p v-if="metaColumns.length" class="truncate text-sm text-ink-muted">
              <template v-for="(column, index) in metaColumns" :key="column.key">
                <span v-if="index > 0" aria-hidden="true"> · </span>{{ cellValue(row, column) }}
              </template>
            </p>
          </div>
          <ChevronRight v-if="rowTo" class="size-4 flex-none text-ink-subtle" aria-hidden="true" />
        </component>
      </li>
    </ul>

    <!-- Pagination -->
    <div v-if="meta && range" class="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
      <span
        ><span class="num">{{ range.start }}</span
        >–<span class="num">{{ range.end }}</span> of
        <span class="num">{{ range.total }}</span></span
      >
      <UiSelect
        v-if="list"
        :model-value="list.state.value.perPage"
        :options="perPageOptions"
        size="sm"
        aria-label="Rows per page"
        class="w-[140px]"
        @update:model-value="(value) => value && list?.setPerPage(Number(value))"
      />
      <div class="ml-auto flex items-center gap-1">
        <UiButton
          variant="secondary"
          size="sm"
          :icon="ChevronLeft"
          :disabled="meta.page <= 1"
          aria-label="Previous page"
          @click="list?.setPage(meta.page - 1)"
          >Previous</UiButton
        >
        <span class="px-2"
          >Page <span class="num">{{ meta.page }}</span> of
          <span class="num">{{ meta.totalPages }}</span></span
        >
        <UiButton
          variant="secondary"
          size="sm"
          :icon-right="ChevronRight"
          :disabled="meta.page >= meta.totalPages"
          aria-label="Next page"
          @click="list?.setPage(meta.page + 1)"
          >Next</UiButton
        >
      </div>
    </div>
  </div>
</template>
