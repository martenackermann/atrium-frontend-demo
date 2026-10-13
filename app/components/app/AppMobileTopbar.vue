<script setup lang="ts">
import { Inbox, Moon, Search, Sun } from '@lucide/vue'

/**
 * Mobile top bar (DESIGN §7 < 768px): sticky translucent sheet — mark, page title in serif, search,
 * Inbox (count), theme. Pages render their own serif h1, so the bar shows the wordmark while that
 * h1 is on screen and the page title once it has scrolled away (DESIGN §14 R1).
 */
const route = useRoute()
const { title } = useBreadcrumbs()
const { paletteOpen, inboxOpen } = useShell()
const theme = useTheme()
const { data: counts } = useInboxCounts()

const heading = ref<HTMLElement | null>(null)
const headingVisible = ref(true)

function findHeading() {
  heading.value = document.querySelector<HTMLElement>('#main h1')
  headingVisible.value = Boolean(heading.value)
}
watch(
  () => route.fullPath,
  () => nextTick(() => setTimeout(findHeading, 50)),
  { immediate: true },
)
// Pages that load their data first render the h1 a moment later.
useMutationObserver(
  () => (import.meta.client ? document.getElementById('main') : null),
  () => {
    if (!heading.value?.isConnected) findHeading()
  },
  { childList: true, subtree: true },
)
useIntersectionObserver(
  heading,
  ([entry]) => {
    headingVisible.value = entry?.isIntersecting ?? false
  },
  { rootMargin: '-56px 0px 0px 0px' },
)

const showTitle = computed(
  () => !route.meta.hideMobileTitle && route.path !== '/' && !headingVisible.value,
)
</script>

<template>
  <header
    class="sticky top-0 z-20 flex h-14 items-center gap-0.5 border-b border-rule bg-[color-mix(in_srgb,var(--sheet)_92%,transparent)] py-2 pr-1.5 pl-2 backdrop-blur-[8px]"
  >
    <NuxtLink
      to="/"
      aria-label="Atrium, Home"
      class="grid size-10 flex-none place-items-center rounded-md"
      ><AppBrandMark class="size-[22px]"
    /></NuxtLink>
    <span
      class="mr-auto ml-1 truncate font-display text-[21px] leading-[26px] tracking-[-0.01em]"
      :aria-hidden="showTitle ? undefined : 'true'"
    >
      {{ showTitle ? title : 'Atrium' }}
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
      :label="theme.resolved.value === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
      :tooltip="false"
      @click="theme.toggle()"
    />
  </header>
</template>
