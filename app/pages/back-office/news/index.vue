<script setup lang="ts">
/**
 * `/back-office/news` — placeholder from the foundation (SCREENS §8). Owned by slice A4, which
 * replaces this file; keep the route and its access rule.
 */
definePageMeta({ title: 'News posts', access: ['news_editor', 'it_admin'] })
</script>

<template>
  <PagePlaceholder title="News posts" slice="A4 · Home, people and news" screen="SCREENS §8" />
</template>
