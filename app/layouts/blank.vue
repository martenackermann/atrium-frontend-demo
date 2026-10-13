<script setup lang="ts">
/** Public pages (sign-in): desk ground, demo ribbon, no navigation. */
const demo = useDemoMode()
</script>

<template>
  <div class="min-h-dvh bg-desk">
    <AppDemoRibbon v-if="demo.enabled.value" />
    <slot />
  </div>
</template>
