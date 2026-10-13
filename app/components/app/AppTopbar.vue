<script setup lang="ts">
import { Inbox, Moon, Search, Sun } from '@lucide/vue'

/**
 * Top bar (DESIGN §7): breadcrumbs left; "Search or jump to… ⌘K" (Ctrl K off Mac); the Inbox
 * button with the marker count (opens the drawer); theme toggle.
 */
const { crumbs } = useBreadcrumbs()
const { paletteOpen, inboxOpen } = useShell()
const theme = useTheme()
const { data: inboxCounts } = useInboxCounts()
const isMac = computed(() => import.meta.client && /Mac|iPhone|iPad/.test(navigator.platform))
</script>

<template>
  <header class="flex h-(--topbar-h) flex-none items-center gap-2 border-b border-rule pr-4 pl-7">
    <Breadcrumbs :crumbs="crumbs" />
    <button
      type="button"
      class="ml-auto flex h-[34px] w-[300px] items-center gap-2 rounded-md border border-rule-strong bg-well pr-1.5 pl-2.5 text-sm text-ink-subtle transition-colors duration-(--dur-1) hover:border-field max-lg:w-[220px]"
      data-testid="search-trigger"
      @click="paletteOpen = true"
    >
      <Search class="size-4" aria-hidden="true" />
      Search or jump to…
      <UiKbd class="ml-auto">{{ isMac ? '⌘ K' : 'Ctrl K' }}</UiKbd>
    </button>
    <UiIconButton
      :icon="Inbox"
      label="Inbox"
      :pip="inboxCounts?.total || null"
      data-testid="inbox-button"
      @click="inboxOpen = true"
    />
    <UiIconButton
      :icon="theme.resolved.value === 'dark' ? Moon : Sun"
      :label="theme.resolved.value === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
      data-testid="theme-toggle"
      @click="theme.toggle()"
    />
  </header>
</template>
