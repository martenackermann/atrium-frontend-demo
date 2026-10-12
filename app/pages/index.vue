<script setup lang="ts">
// Placeholder (phase 2a). The home slice (A4) owns this page.
const auth = useAuthStore()
</script>

<template>
  <section class="space-y-2">
    <h1 class="text-2xl font-semibold">Welcome, {{ auth.user?.firstName }}</h1>
    <p class="text-neutral-600 dark:text-neutral-400">Your Atrium home dashboard is coming soon.</p>
  </section>
</template>
