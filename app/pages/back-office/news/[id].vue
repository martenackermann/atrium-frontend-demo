<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'
import { isApiError } from '~/lib/api'
import { useNewsPost } from '~/modules/news/api'

/** `/back-office/news/[id]` (SCREENS §8, owned by A4): edit a post and run its lifecycle. */
definePageMeta({ title: 'Edit post', access: ['news_editor', 'it_admin'] })

const route = useRoute()
const id = computed(() => String(route.params.id))
const post = useNewsPost(id)
useBreadcrumbTail(() => post.data.value?.title)

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
    <div v-if="post.isPending.value" class="grid gap-4" aria-busy="true">
      <UiSkeleton class="h-10 w-2/3" /><UiSkeleton class="h-64" />
    </div>
    <ProblemAlert v-else-if="post.error.value" :error="post.error.value" />
    <template v-else-if="post.data.value">
      <PageHeader :title="post.data.value.title">
        <template #meta>
          <span>Last edited {{ formatAge(post.data.value.updatedAt) }}</span>
          <span aria-hidden="true">·</span>
          <span>by {{ post.data.value.author.displayName }}</span>
        </template>
        <template #actions>
          <UiButton
            v-if="post.data.value.status === 'published'"
            variant="ghost"
            :icon-right="ArrowUpRight"
            :to="`/news/${post.data.value.id}`"
            >View in News</UiButton
          >
        </template>
      </PageHeader>
      <div class="mt-8">
        <NewsPostEditor :post="post.data.value" />
      </div>
    </template>
  </PageBody>
</template>
