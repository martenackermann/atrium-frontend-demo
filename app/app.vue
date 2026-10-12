<script setup lang="ts">
// Vue Query devtools in development only (tree-shaken from production builds).
const VueQueryDevtools = import.meta.dev
  ? defineAsyncComponent(() =>
      import('@tanstack/vue-query-devtools').then((module) => module.VueQueryDevtools),
    )
  : null
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <component :is="VueQueryDevtools" v-if="VueQueryDevtools" />
</template>
