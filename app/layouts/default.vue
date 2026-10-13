<script setup lang="ts">
/**
 * The app shell (DESIGN §7, SCREENS §1.1): demo ribbon · sidebar on the desk (rail at 768–1023px)
 * · inset main sheet with the top bar, scrolling inside · mobile top bar + tab bar. Overlays: ⌘K
 * palette, Inbox drawer, mobile menu, "New" sheet, shortcuts.
 */
const demo = useDemoMode()
const { mobileDetail } = useShell()
const { title } = useBreadcrumbs()

useGlobalShortcuts()
useHead({ title: computed(() => `${title.value} · Atrium`) })
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-desk md:h-dvh">
    <a href="#main" class="skip-link">Skip to content</a>
    <AppDemoRibbon v-if="demo.enabled.value" />
    <div
      class="flex flex-1 flex-col md:grid md:min-h-0 md:grid-cols-[var(--rail-w)_minmax(0,1fr)] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]"
    >
      <AppSidebar class="max-md:hidden" />
      <main
        id="main"
        tabindex="-1"
        class="flex min-w-0 outline-none flex-1 flex-col bg-sheet md:m-2 md:ml-0 md:min-h-0 md:overflow-hidden md:rounded-xl md:border md:border-rule md:shadow-sheet"
      >
        <AppMobileTopbar v-if="!mobileDetail" class="md:hidden" />
        <AppTopbar class="max-md:hidden" />
        <div class="flex min-h-0 flex-1 flex-col md:overflow-y-auto" data-testid="page">
          <slot />
        </div>
      </main>
    </div>
    <AppMobileTabbar class="md:hidden" />
    <AppCommandPalette />
    <AppInboxDrawer />
    <AppMobileMenu />
    <AppNewSheet />
    <AppShortcutsDialog />
  </div>
</template>
