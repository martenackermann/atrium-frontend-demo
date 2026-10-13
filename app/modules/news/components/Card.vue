<script setup lang="ts">
import { Pin } from '@lucide/vue'
import type { NewsPostSummary } from '../api/types'
import { NEWS_TYPE_META } from '../constants'

/** A news card (SCREENS §8 /news): cover, type chip, serif title, summary, published date. */
const props = defineProps<{ post: NewsPostSummary; feature?: boolean }>()
const meta = computed(() => NEWS_TYPE_META[props.post.type])
</script>

<template>
  <article
    class="group grid content-start gap-3 border-b border-rule pb-6"
    :class="feature && 'md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-8'"
    :data-testid="`news-card-${post.id}`"
  >
    <NuxtLink
      v-if="post.coverImage"
      :to="`/news/${post.id}`"
      tabindex="-1"
      aria-hidden="true"
      class="block overflow-hidden rounded-lg border border-rule bg-well"
    >
      <img
        :src="post.coverImage.url"
        alt=""
        class="aspect-[2/1] w-full object-cover transition-transform duration-(--dur-3) ease-out group-hover:scale-[1.01]"
        loading="lazy"
      />
    </NuxtLink>
    <div class="grid content-start gap-2">
      <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-subtle">
        <span
          v-if="post.pinned"
          class="inline-flex items-center gap-1 font-semibold text-ink-muted"
        >
          <Pin class="size-3.5" aria-hidden="true" />Pinned
        </span>
        <span class="inline-flex items-center gap-1">
          <component :is="meta.icon" class="size-3.5" aria-hidden="true" />{{ meta.label }}
        </span>
        <time v-if="post.publishedAt" :datetime="post.publishedAt">{{
          formatDate(post.publishedAt, { weekday: false })
        }}</time>
      </p>
      <h2
        class="font-display font-normal tracking-[-0.01em] text-ink"
        :class="feature ? 'text-[26px] leading-8' : 'text-[19px] leading-[25px]'"
      >
        <NuxtLink
          :to="`/news/${post.id}`"
          class="no-underline hover:underline hover:decoration-rule-strong hover:decoration-1"
          >{{ post.title }}</NuxtLink
        >
      </h2>
      <p class="max-w-[62ch] text-[13.5px] leading-5 text-ink-muted">{{ post.summary }}</p>
    </div>
  </article>
</template>
