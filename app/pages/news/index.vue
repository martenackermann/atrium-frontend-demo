<script setup lang="ts">
import { Newspaper } from '@lucide/vue'
import { useNewsList } from '~/modules/news/api'
import { NEWS_TYPE_OPTIONS } from '~/modules/news/constants'

/**
 * `/news` (SCREENS §8, owned by A4): published posts as cards — pinned first, then newest —
 * with a type filter (Changelog / Update / Information).
 */
definePageMeta({ title: 'News' })

const route = useRoute()
const router = useRouter()
const type = computed({
  get: () => (typeof route.query.type === 'string' ? route.query.type : 'all'),
  set: (value: string) =>
    router.replace({
      query: { ...route.query, type: value === 'all' ? undefined : value, page: undefined },
    }),
})
const page = computed(() => Number(route.query.page ?? 1) || 1)
const params = computed(() => ({
  type: type.value === 'all' ? undefined : type.value,
  page: page.value,
  perPage: 12,
}))
const news = useNewsList(params)
const posts = computed(() => news.data.value?.data ?? [])
const filterOptions = [{ value: 'all', label: 'All' }, ...NEWS_TYPE_OPTIONS]
const goTo = (target: number) =>
  router.replace({ query: { ...route.query, page: target > 1 ? String(target) : undefined } })
</script>

<template>
  <PageBody>
    <PageHeader
      title="News"
      subtitle="Changes to Atrium, updates from the desks and news from the sites."
    />
    <div class="mt-6">
      <UiSegmented v-model="type" :options="filterOptions" label="Type" size="sm" />
    </div>

    <div
      v-if="news.isPending.value"
      class="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
    >
      <div v-for="index in 6" :key="index" class="grid gap-3">
        <UiSkeleton class="h-36" /><UiSkeleton class="h-5 w-3/4" /><UiSkeleton class="h-4" />
      </div>
    </div>
    <ProblemAlert v-else-if="news.error.value" :error="news.error.value" class="mt-8" />
    <EmptyState
      v-else-if="!posts.length"
      class="mt-10"
      :icon="Newspaper"
      title="No news yet"
      description="When People Ops or IT publish something, it appears here and on Home."
    />
    <template v-else>
      <div class="mt-8 border-t border-ink pt-6">
        <NewsCard v-if="page === 1 && posts[0]?.pinned" :post="posts[0]" feature />
      </div>
      <div class="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
        <NewsCard
          v-for="post in page === 1 && posts[0]?.pinned ? posts.slice(1) : posts"
          :key="post.id"
          :post="post"
        />
      </div>
      <nav
        v-if="(news.data.value?.meta.totalPages ?? 1) > 1"
        class="mt-8 flex items-center justify-between"
        aria-label="Pages"
      >
        <UiButton size="sm" :disabled="page <= 1" @click="goTo(page - 1)">Newer posts</UiButton>
        <span class="text-sm text-ink-muted"
          >Page {{ page }} of {{ news.data.value?.meta.totalPages }}</span
        >
        <UiButton
          size="sm"
          :disabled="page >= (news.data.value?.meta.totalPages ?? 1)"
          @click="goTo(page + 1)"
          >Older posts</UiButton
        >
      </nav>
    </template>
  </PageBody>
</template>
