<script setup lang="ts">
import { Inbox, Moon, Search, Sun } from '@lucide/vue'

/**
 * Mobile top bar (DESIGN §7 < 768px): sticky translucent sheet — mark, page title in serif (or the
 * wordmark on pages with their own serif h1, R1), search, Inbox (count), theme.
 */
const route = useRoute()
const { title } = useBreadcrumbs()
const { paletteOpen, inboxOpen } = useShell()
const theme = useTheme()
const { data: counts } = useInboxCounts()
const showWordmark = computed(() => route.meta.hideMobileTitle || route.path === '/')
</script>

<template>
  <header
    class="sticky top-0 z-20 flex h-14 items-center gap-1 border-b border-rule bg-[color-mix(in_srgb,var(--sheet)_92%,transparent)] py-2.5 pr-2 pl-4 backdrop-blur-[8px]"
  >
    <NuxtLink to="/" aria-label="Atrium, Home" class="mr-2.5"
      ><AppBrandMark class="size-[22px]"
    /></NuxtLink>
    <span class="mr-auto truncate font-display text-[21px] leading-[26px] tracking-[-0.01em]">
      {{ showWordmark ? 'Atrium' : title }}
    </span>
    <UiIconButton :icon="Search" label="Search" :tooltip="false" @click="paletteOpen = true" />
    <UiIconButton
      :icon="Inbox"
      label="Inbox"
      :pip="counts?.total || null"
      :tooltip="false"
      @click="inboxOpen = true"
    />
    <UiIconButton
      :icon="theme.resolved.value === 'dark' ? Moon : Sun"
      label="Switch theme"
      :tooltip="false"
      @click="theme.toggle()"
    />
  </header>
</template>
