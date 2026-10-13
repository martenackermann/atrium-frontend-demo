<script setup lang="ts">
/** Focus mode for request steppers (DESIGN §7): no app navigation; StepperPage draws its own top bar. */
const demo = useDemoMode()
const route = useRoute()
useHead({ title: computed(() => `${route.meta.title ?? 'New request'} · Atrium`) })
</script>

<template>
  <div class="min-h-dvh bg-desk">
    <AppDemoRibbon v-if="demo.enabled.value" />
    <slot />
  </div>
</template>
