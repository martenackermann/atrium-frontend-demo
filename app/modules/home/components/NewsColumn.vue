<script setup lang="ts">
import {
  ArrowRight,
  BedDouble,
  BookOpen,
  Calendar,
  ExternalLink,
  Heart,
  Info,
  LifeBuoy,
  Link,
  Network,
  Palette,
  Pin,
  Receipt,
  RefreshCcw,
  Shield,
  Sparkles,
  Utensils,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { HomeLink, HomeNewsPost } from '../api/types'

/**
 * The Home aside (DESIGN §8.1): News — serif headlines, a two-line excerpt, meta below
 * (pin · type · date) — then Useful links opening in a new tab.
 */
defineProps<{ news: readonly HomeNewsPost[]; links: readonly HomeLink[]; loading?: boolean }>()

const TYPES: Record<HomeNewsPost['type'], { label: string; icon: Component }> = {
  changelog: { label: 'Changelog', icon: Sparkles },
  update: { label: 'Update', icon: RefreshCcw },
  information: { label: 'Information', icon: Info },
}
const ICONS: Record<string, Component> = {
  book: BookOpen,
  utensils: Utensils,
  receipt: Receipt,
  bed: BedDouble,
  'life-buoy': LifeBuoy,
  calendar: Calendar,
  network: Network,
  palette: Palette,
  shield: Shield,
  heart: Heart,
  link: Link,
}
</script>

<template>
  <aside class="home-aside" aria-label="News and links">
    <section aria-labelledby="news-heading" data-testid="home-news">
      <header class="flex items-center gap-3 border-b border-ink pb-2.5">
        <h2 id="news-heading" class="text-lg font-[650] tracking-heading">News</h2>
        <NuxtLink
          to="/news"
          class="ml-auto inline-flex items-center gap-1 text-sm font-medium text-ink-muted no-underline hover:text-ink"
          >All news<ArrowRight class="size-3.5" aria-hidden="true"
        /></NuxtLink>
      </header>
      <div v-if="loading" class="grid gap-3 py-4" aria-busy="true">
        <UiSkeleton v-for="index in 3" :key="index" class="h-20" />
      </div>
      <p v-else-if="!news.length" class="py-5 text-sm text-ink-muted">No news yet.</p>
      <article v-for="post in news" :key="post.id" class="border-b border-rule py-[18px]">
        <h3 class="font-display text-[19px] leading-[25px] font-normal tracking-[-0.01em]">
          <NuxtLink
            :to="`/news/${post.id}`"
            class="no-underline hover:underline hover:decoration-rule-strong hover:decoration-1"
            >{{ post.title }}</NuxtLink
          >
        </h3>
        <p class="mt-1.5 line-clamp-2 text-[13.5px] leading-5 text-ink-muted">{{ post.summary }}</p>
        <p class="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-subtle">
          <template v-if="post.pinned">
            <Pin class="size-3.5" aria-hidden="true" />Pinned<span aria-hidden="true">·</span>
          </template>
          <component :is="TYPES[post.type].icon" class="size-3.5" aria-hidden="true" />{{
            TYPES[post.type].label
          }}
          <template v-if="post.publishedAt">
            <span aria-hidden="true">·</span>
            <time :datetime="post.publishedAt">{{
              formatDate(post.publishedAt, { weekday: false })
            }}</time>
          </template>
        </p>
      </article>
    </section>

    <section v-if="links.length" aria-labelledby="links-heading" data-testid="home-links">
      <h2 id="links-heading" class="border-b border-ink pb-2 text-[13px] font-[650]">
        Useful links
      </h2>
      <ul class="m-0 list-none p-0">
        <li v-for="link in links" :key="link.id">
          <a
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="group flex items-center gap-2.5 border-b border-rule py-[9px] text-base font-medium text-ink no-underline hover:underline hover:decoration-rule-strong"
            :title="link.description ?? undefined"
          >
            <component
              :is="ICONS[link.icon ?? 'link'] ?? Link"
              class="size-4 text-ink-subtle"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate">{{ link.title }}</span>
            <ExternalLink
              class="size-3.5 text-ink-subtle group-hover:text-ink"
              aria-hidden="true"
            />
            <span class="sr">(opens in a new tab)</span>
          </a>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
.home-aside {
  display: grid;
  gap: 40px;
  align-content: start;
}
@media (min-width: 768px) and (max-width: 1279px) {
  .home-aside {
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  }
}
</style>
