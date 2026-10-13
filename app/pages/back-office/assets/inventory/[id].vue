<script setup lang="ts">
/**
 * `/back-office/assets/inventory/[id]` — placeholder from the foundation (SCREENS §6.6). Owned by slice A3, which
 * replaces this file; keep the route and its access rule.
 */
definePageMeta({ title: 'Asset', access: ['asset_admin', 'it_admin'] })
</script>

<template>
  <PagePlaceholder title="Asset" slice="A3 · Assets" screen="SCREENS §6.6" />
</template>
