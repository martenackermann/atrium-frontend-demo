<script setup lang="ts">
import { Newspaper, Pin, Plus } from '@lucide/vue'
import { useNewsList } from '~/modules/news/api'
import type { NewsPostSummary } from '~/modules/news/api/types'
import { NEWS_TYPE_META, NEWS_TYPE_OPTIONS } from '~/modules/news/constants'
import type { DataTableColumn } from '~/types/ui'

/**
 * `/back-office/news` (SCREENS §8, owned by A4): every post for editors — title, type, status,
 * publish at / published at, expires, author, updated — filtered by status, type and search.
 */
definePageMeta({ title: 'News posts', access: ['news_editor', 'it_admin'] })

const enums = useEnums()
const list = useListQuery({
  filters: ['status', 'type'],
  multi: ['status'],
  defaultSort: '-updatedAt',
})
const posts = useNewsList(() => list.apiQuery.value)

const ANY = 'any'
const typeFilter = computed({
  get: () => (list.state.value.filters.type as string) || ANY,
  set: (value: string) => list.setFilter('type', value === ANY ? '' : value),
})
const statusFilter = computed({
  get: () => ((list.state.value.filters.status as string[] | undefined) ?? [])[0] ?? ANY,
  set: (value: string) => list.setFilter('status', value === ANY ? [] : [value]),
})
const typeOptions = [{ value: ANY, label: 'All types' }, ...NEWS_TYPE_OPTIONS]
const statusOptions = computed(() => [
  { value: ANY, label: 'All statuses' },
  ...enums
    .options('newsStatus')
    .map((option) => ({ value: String(option.value), label: option.label })),
])

const when = (row: NewsPostSummary) =>
  row.status === 'scheduled' && row.publishAt
    ? `Goes live ${formatDate(row.publishAt)}, ${formatTime(row.publishAt)}`
    : row.publishedAt
      ? formatDate(row.publishedAt)
      : '—'

const columns: DataTableColumn<NewsPostSummary>[] = [
  { key: 'title', label: 'Title', required: true, mobile: 'title' },
  { key: 'type', label: 'Type', width: '140px', mobile: 'hidden' },
  { key: 'status', label: 'Status', width: '140px', mobile: 'status' },
  {
    key: 'when',
    label: 'Publish at / published',
    value: when,
    sort: 'publishedAt',
    mobile: 'meta',
  },
  {
    key: 'expireAt',
    label: 'Expires',
    value: (row) => (row.expireAt ? formatDate(row.expireAt) : '—'),
    width: '120px',
    mobile: 'hidden',
  },
  { key: 'author', label: 'Author', value: (row) => row.author.displayName, mobile: 'hidden' },
  {
    key: 'updatedAt',
    label: 'Updated',
    sort: 'updatedAt',
    value: (row) => formatAge(row.updatedAt),
    width: '110px',
    mobile: 'meta',
  },
]
</script>

<template>
  <PageBody wide>
    <PageHeader title="News posts" subtitle="Drafts, scheduled posts and everything published.">
      <template #actions>
        <UiButton variant="primary" :icon="Plus" to="/back-office/news/new">New post</UiButton>
      </template>
    </PageHeader>
    <DataTable
      class="mt-6"
      :columns="columns"
      :rows="posts.data.value?.data"
      :meta="posts.data.value?.meta"
      :loading="posts.isPending.value"
      :error="posts.error.value"
      :list="list"
      noun="posts"
      storage-key="news-posts"
      caption="News posts"
      search-placeholder="Search title or summary"
      :row-to="(row) => `/back-office/news/${row.id}`"
      @retry="posts.refetch()"
    >
      <template #filters>
        <UiSelect
          v-model="typeFilter"
          :options="typeOptions"
          size="sm"
          aria-label="Type"
          class="w-44"
        />
        <UiSelect
          v-model="statusFilter"
          :options="statusOptions"
          size="sm"
          aria-label="Status"
          class="w-44"
        />
      </template>
      <template #cell-title="{ row }">
        <NuxtLink
          :to="`/back-office/news/${row.id}`"
          class="inline-flex items-center gap-1.5 font-semibold text-ink no-underline hover:underline"
        >
          <Pin v-if="row.pinned" class="size-3.5 text-ink-muted" aria-label="Pinned" />{{
            row.title
          }}
        </NuxtLink>
      </template>
      <template #cell-type="{ row }">
        <span class="inline-flex items-center gap-1.5 text-sm text-ink-muted">
          <component :is="NEWS_TYPE_META[row.type].icon" class="size-3.5" aria-hidden="true" />
          {{ NEWS_TYPE_META[row.type].label }}
        </span>
      </template>
      <template #cell-status="{ row }">
        <StatusBadge enum="newsStatus" :value="row.status" />
      </template>
      <template #empty>
        <EmptyState :icon="Newspaper" title="No posts" description="Write the first one.">
          <UiButton variant="secondary" :icon="Plus" to="/back-office/news/new">New post</UiButton>
        </EmptyState>
      </template>
    </DataTable>
  </PageBody>
</template>
