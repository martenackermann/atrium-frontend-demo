<script setup lang="ts">
import { ArrowLeft, Pencil, Pin } from '@lucide/vue'
import { isApiError } from '~/lib/api'
import { useNewsPost } from '~/modules/news/api'
import { NEWS_TYPE_META } from '~/modules/news/constants'

/**
 * `/news/[id]` (SCREENS §8, owned by A4): cover, title, author, date and the body — sanitised on
 * the server and rendered through DOMPurify as defence in depth.
 */
definePageMeta({ title: 'News post' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const post = useNewsPost(id)
const detail = computed(() => post.data.value)
useBreadcrumbTail(() => detail.value?.title)

watch(
  () => post.error.value,
  (error) => {
    if (isApiError(error) && error.status === 404) {
      showError(createError({ statusCode: 404, statusMessage: 'Not found', fatal: false }))
    }
  },
)
</script>

<template>
  <PageBody>
    <UiButton variant="ghost" size="sm" :icon="ArrowLeft" to="/news">Back to news</UiButton>
    <div v-if="post.isPending.value" class="mt-6 grid max-w-[68ch] gap-4" aria-busy="true">
      <UiSkeleton class="h-52" /><UiSkeleton class="h-10 w-3/4" /><UiSkeleton class="h-24" />
    </div>
    <ProblemAlert v-else-if="post.error.value" :error="post.error.value" class="mt-6" />
    <article v-else-if="detail" class="mt-6 grid max-w-[760px] gap-6">
      <NewsCover
        v-if="detail.coverImage"
        :image="detail.coverImage"
        class="aspect-[2/1] w-full rounded-xl border border-rule object-cover"
      />
      <header class="grid gap-3">
        <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-subtle">
          <span
            v-if="detail.pinned"
            class="inline-flex items-center gap-1 font-semibold text-ink-muted"
            ><Pin class="size-3.5" aria-hidden="true" />Pinned</span
          >
          <span class="inline-flex items-center gap-1">
            <component :is="NEWS_TYPE_META[detail.type].icon" class="size-3.5" aria-hidden="true" />
            {{ NEWS_TYPE_META[detail.type].label }}
          </span>
          <StatusBadge
            v-if="detail.status !== 'published'"
            enum="newsStatus"
            :value="detail.status"
          />
        </p>
        <h1
          class="font-display text-[30px] leading-9 font-normal tracking-display text-balance md:text-display-md"
        >
          {{ detail.title }}
        </h1>
        <p class="text-[13.5px] text-ink-muted">
          {{ detail.author.displayName }}
          <template v-if="detail.publishedAt">
            · <time :datetime="detail.publishedAt">{{ formatLongDate(detail.publishedAt) }}</time>
          </template>
        </p>
        <p class="max-w-[62ch] text-base leading-[23px] text-ink-muted">{{ detail.summary }}</p>
      </header>
      <div class="border-t border-ink pt-6">
        <NewsBody :html="detail.bodyHtml" />
      </div>
      <div v-if="detail.availableActions.includes('edit')">
        <UiButton :icon="Pencil" :to="`/back-office/news/${detail.id}`">Edit post</UiButton>
      </div>
    </article>
  </PageBody>
</template>
