<script setup lang="ts">
/**
 * Sidebar (DESIGN §7): 248px on the desk ground (≥ 1024px), a 64px icon rail at 768–1023px.
 * Wordmark · New request · navigation · account pill pinned to the bottom.
 */
const isRail = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
</script>

<template>
  <aside
    aria-label="Main"
    class="flex min-h-0 flex-col overflow-y-auto px-3 pt-3.5 pb-3 max-lg:items-center max-lg:px-2"
  >
    <NuxtLink
      to="/"
      class="flex items-center gap-2.5 px-2.5 pt-1.5 pb-5 text-ink no-underline max-lg:px-0"
      aria-label="Atrium, Home"
    >
      <AppBrandMark class="size-6" />
      <span class="font-display text-[23px] leading-none tracking-[-0.01em] max-lg:hidden"
        >Atrium</span
      >
    </NuxtLink>
    <AppNewRequestMenu :rail="isRail" />
    <AppNav :rail="isRail" class="w-full" />
    <div class="mt-auto w-full pt-4" :class="isRail && 'flex justify-center'">
      <PersonaSwitcher :rail="isRail" />
    </div>
  </aside>
</template>
