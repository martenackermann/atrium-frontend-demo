<script setup lang="ts">
/** `/back-office/news/new` (SCREENS §8, owned by A4): a new draft post in the news editor. */
definePageMeta({ title: 'New post', access: ['news_editor', 'it_admin'] })
</script>

<template>
  <PageBody>
    <PageHeader title="New post" subtitle="Saved as a draft. Publish now or schedule it later." />
    <div class="mt-8">
      <NewsPostEditor />
    </div>
  </PageBody>
</template>
