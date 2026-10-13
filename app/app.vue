<script setup lang="ts">
import { setLucideProps } from '@lucide/vue'
import { TooltipProvider } from 'reka-ui'

// Icons (DESIGN §6): outline, 16px, stroke 1.75 by default; size-* classes override.
setLucideProps({ size: 16, strokeWidth: 1.75 })

const theme = useTheme()
onMounted(() => theme.apply())
watch(theme.resolved, () => theme.apply())

// Vue Query devtools in development only (tree-shaken from production builds).
const VueQueryDevtools = import.meta.dev
  ? defineAsyncComponent(() =>
      import('@tanstack/vue-query-devtools').then((module) => module.VueQueryDevtools),
    )
  : null
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <UiToaster />
    <UiConfirmDialog />
  </TooltipProvider>
  <component :is="VueQueryDevtools" v-if="VueQueryDevtools" button-position="bottom-left" />
</template>
