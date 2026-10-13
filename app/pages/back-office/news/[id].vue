<script setup lang="ts">
/**
 * `/back-office/news/[id]` — placeholder from the foundation (SCREENS §8). Owned by slice A4, which
 * replaces this file; keep the route and its access rule.
 */
definePageMeta({ title: 'Edit post', access: ['news_editor', 'it_admin'] })
</script>

<template>
  <PagePlaceholder title="Edit post" slice="A4 · Home, people and news" screen="SCREENS §8" />
</template>
