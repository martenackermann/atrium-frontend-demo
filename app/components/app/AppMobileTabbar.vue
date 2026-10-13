<script setup lang="ts">
import { Inbox, Menu, Plus, Sunrise } from '@lucide/vue'

/**
 * Mobile tab bar (DESIGN §7, SCREENS §9): Home · Inbox · New (ink button → action sheet of the
 * create commands) · Menu (sidebar as a drawer). Active tab: ink text + a 3px marker tab above.
 * Hidden while a pushed detail view is showing.
 */
const route = useRoute()
const { menuOpen, newSheetOpen, mobileDetail } = useShell()
const { data: counts } = useInboxCounts()
</script>

<template>
  <nav
    v-if="!mobileDetail"
    aria-label="Tabs"
    class="fixed inset-x-0 bottom-0 z-20 grid h-[calc(64px+env(safe-area-inset-bottom))] grid-cols-4 border-t border-rule bg-sheet px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))]"
  >
    <NuxtLink to="/" class="tab" :aria-current="route.path === '/' ? 'page' : undefined">
      <Sunrise class="size-5" aria-hidden="true" />Home
    </NuxtLink>
    <NuxtLink to="/inbox" class="tab" :aria-current="route.path === '/inbox' ? 'page' : undefined">
      <Inbox class="size-5" aria-hidden="true" />Inbox
      <span
        v-if="counts?.total"
        class="num absolute -top-0.5 left-[calc(50%+4px)] h-[17px] min-w-[17px] rounded-pill bg-marker px-1 text-center text-[11px] leading-[17px] font-semibold text-marker-ink shadow-[0_0_0_2px_var(--sheet)]"
        :aria-label="`${counts.total} to do`"
        >{{ counts.total }}</span
      >
    </NuxtLink>
    <button type="button" class="tab" aria-label="New request" @click="newSheetOpen = true">
      <span class="grid h-9 w-11 place-items-center rounded-[10px] bg-primary text-primary-ink">
        <Plus class="size-5" aria-hidden="true" />
      </span>
    </button>
    <button type="button" class="tab" @click="menuOpen = true">
      <Menu class="size-5" aria-hidden="true" />Menu
    </button>
  </nav>
</template>

<style scoped>
.tab {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 500;
  color: var(--ink-muted);
  text-decoration: none;
}
.tab[aria-current='page'] {
  color: var(--ink);
  font-weight: 600;
}
.tab[aria-current='page']::before {
  content: '';
  position: absolute;
  top: -6px;
  width: 28px;
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: var(--marker);
}
</style>
