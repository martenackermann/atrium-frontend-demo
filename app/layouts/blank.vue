<script setup lang="ts">
/** Public pages (sign-in): desk ground, demo ribbon, no navigation. */
const demo = useDemoMode()
const route = useRoute()
useHead({ title: computed(() => (route.meta.title ? `${route.meta.title} · Atrium` : 'Atrium')) })
</script>

<template>
  <div class="min-h-dvh bg-desk">
    <AppSkipLink />
    <AppDemoRibbon v-if="demo.enabled.value" />
    <slot />
  </div>
</template>
