<script setup lang="ts">
import DOMPurify from 'dompurify'
import { NEWS_ALLOWED_TAGS } from '../constants'

/**
 * Renders a news body. The API stores it sanitised (allowlist SPEC §4.6); the page sanitises
 * again with DOMPurify as defence in depth (SPEC §12) — never raw HTML.
 */
const props = defineProps<{ html: string }>()

const safe = computed(() => {
  const clean = DOMPurify.sanitize(props.html, {
    ALLOWED_TAGS: NEWS_ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:https:|mailto:)/i,
  })
  // Every remaining link opens in a new tab without an opener.
  return clean.replace(/<a (?![^>]*target=)/g, '<a target="_blank" rel="noopener noreferrer" ')
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitised twice: server allowlist + DOMPurify -->
  <div class="news-prose" v-html="safe" />
</template>

<style scoped>
.news-prose {
  max-width: 68ch;
  font-size: 15px;
  line-height: 24px;
  color: var(--ink);
}
.news-prose :deep(p) {
  margin: 0 0 14px;
  text-wrap: pretty;
}
.news-prose :deep(h2) {
  margin: 28px 0 10px;
  font-size: 17px;
  line-height: 24px;
  font-weight: 650;
  letter-spacing: -0.008em;
}
.news-prose :deep(h3) {
  margin: 22px 0 8px;
  font-size: 15px;
  line-height: 22px;
  font-weight: 650;
}
.news-prose :deep(ul),
.news-prose :deep(ol) {
  margin: 0 0 14px;
  padding-left: 22px;
}
.news-prose :deep(ul) {
  list-style: disc;
}
.news-prose :deep(ol) {
  list-style: decimal;
}
.news-prose :deep(li) {
  margin: 4px 0;
}
.news-prose :deep(a) {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--rule-strong);
  text-underline-offset: 3px;
}
.news-prose :deep(a:hover) {
  text-decoration-color: currentColor;
}
.news-prose :deep(blockquote) {
  margin: 0 0 14px;
  padding: 2px 0 2px 16px;
  border-left: 1px solid var(--ink);
  font-family: var(--face-display);
  font-size: 17px;
  line-height: 25px;
}
.news-prose :deep(code) {
  font-family: var(--face-mono);
  font-size: 0.93em;
}
.news-prose :deep(pre) {
  margin: 0 0 14px;
  padding: 12px 14px;
  border-radius: var(--round-md);
  background: var(--well);
  overflow-x: auto;
}
.news-prose > :deep(:first-child) {
  margin-top: 0;
}
</style>
