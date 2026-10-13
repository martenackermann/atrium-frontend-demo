<script setup lang="ts">
/** Public pages (sign-in): desk ground, demo ribbon, no navigation. */
const demo = useDemoMode()
const route = useRoute()
useHead({ title: computed(() => (route.meta.title ? `${route.meta.title} · Atrium` : 'Atrium')) })
</script>

<template>
  <div class="min-h-dvh bg-desk">
    <a href="#main" class="skip-link">Skip to content</a>
    <AppDemoRibbon v-if="demo.enabled.value" />
    <slot />
  </div>
</template>
