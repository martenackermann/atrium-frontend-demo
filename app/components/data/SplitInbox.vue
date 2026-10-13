<script setup lang="ts" generic="T">
import { ArrowLeft, Inbox } from '@lucide/vue'
import type { TabItem } from '~/types/ui'

/**
 * SplitInbox (DESIGN §8.3, SCREENS §1.7): list pane (serif title + count, tabs with counts, a
 * segmented filter, sort note, rows) + detail pane (sticky header with title, meta and actions;
 * body). `?selected=<id>` lives in the URL. Keyboard (when not typing): J/K or ↓/↑ move,
 * A approve, D decline, Enter opens the full page, Esc closes the detail, ? lists shortcuts.
 * After an action removes the selected row, the next row is selected. Mobile: list → pushed
 * detail with a back bar ("← Approvals · 2 of 7") and the actions as a sticky bottom bar.
 *
 * Slots: #item="{ item, selected }", #detail="{ item }", #detail-title, #detail-meta,
 * #detail-actions="{ item }", #list-tools (extra controls), #empty.
 */
const props = withDefaults(
  defineProps<{
    title: string
    /** "7 to do" next to the title. */
    countLabel?: string
    items: readonly T[] | null | undefined
    itemKey: (item: T) => string
    itemLabel?: (item: T) => string
    loading?: boolean
    error?: unknown
    tabs?: readonly TabItem[]
    filters?: readonly { value: string; label: string }[]
    sortNote?: string
    /** Unread rows get a marker-text dot and a bolder name. */
    isUnread?: (item: T) => boolean
    /** A/D shortcuts apply only to items where this returns true (approvals). */
    canDecide?: (item: T) => boolean
    /** Full page for Enter / "Open full page". */
    itemTo?: (item: T) => string
    empty?: { title: string; description?: string }
    /** Query key for the selection in the URL. */
    selectedKey?: string
  }>(),
  { selectedKey: 'selected', empty: () => ({ title: 'All caught up' }) },
)
const tab = defineModel<string>('tab')
const filter = defineModel<string>('filter')
const emit = defineEmits<{ approve: [item: T]; decline: [item: T]; retry: [] }>()

const route = useRoute()
const router = useRouter()
const { mobileDetail, shortcutsOpen } = useShell()
const isMobile = useMediaQuery('(max-width: 767px)')
const listEl = ref<HTMLElement>()
const listPane = ref<HTMLElement>()
const listId = useId()

const selectedId = computed(() => {
  const raw = route.query[props.selectedKey]
  return typeof raw === 'string' ? raw : null
})
const list = computed(() => props.items ?? [])
const selectedIndex = computed(() =>
  list.value.findIndex((item) => props.itemKey(item) === selectedId.value),
)
const selected = computed(() =>
  selectedIndex.value >= 0 ? list.value[selectedIndex.value] : undefined,
)

function select(item: T | undefined, replace = true) {
  // patchQuery keeps a search/filter patch that is still being navigated to (debounced search
  // + auto-selection of the first row used to drop the search).
  void patchQuery(
    router,
    { [props.selectedKey]: item ? props.itemKey(item) : undefined },
    replace ? 'replace' : 'push',
  )
}

// Desktop: keep something selected; after an action the next row takes the removed row's place.
let lastIndex = -1
watch(
  [list, selectedId, isMobile],
  () => {
    if (selectedIndex.value >= 0) {
      lastIndex = selectedIndex.value
      return
    }
    if (isMobile.value && !selectedId.value) return
    if (list.value.length === 0) return
    const next = list.value[Math.min(Math.max(lastIndex, 0), list.value.length - 1)]
    if (!isMobile.value || selectedId.value) select(next)
  },
  { immediate: true },
)

watchEffect(() => {
  mobileDetail.value = isMobile.value && Boolean(selected.value)
})
onBeforeUnmount(() => {
  mobileDetail.value = false
})

function move(delta: number) {
  if (!list.value.length) return
  const index = selectedIndex.value < 0 ? 0 : selectedIndex.value + delta
  const item = list.value[Math.min(Math.max(index, 0), list.value.length - 1)]
  select(item)
  nextTick(() => {
    document
      .getElementById(`${listId}-${props.itemKey(item!)}`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

/** Arrow keys (and Enter) act on the list only from the list (or nowhere in particular), so they
 * still scroll the detail pane and work inside menus, tabs, segmented controls and buttons. */
function fromList(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (!target || target === document.body) return true
  if (!listPane.value?.contains(target)) return false
  return !target.closest('[role="tablist"],[role="radiogroup"],[role="menu"],[role="combobox"]')
}

useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
  if (isTypingContext(event)) return
  const key = event.key
  const arrow = key === 'ArrowDown' || key === 'ArrowUp'
  if (arrow && !fromList(event)) return
  if (key === 'j' || key === 'J' || key === 'ArrowDown') {
    event.preventDefault()
    move(1)
  } else if (key === 'k' || key === 'K' || key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
  } else if ((key === 'a' || key === 'A') && selected.value && props.canDecide?.(selected.value)) {
    event.preventDefault()
    emit('approve', selected.value)
  } else if ((key === 'd' || key === 'D') && selected.value && props.canDecide?.(selected.value)) {
    event.preventDefault()
    emit('decline', selected.value)
  } else if (
    key === 'Enter' &&
    selected.value &&
    props.itemTo &&
    fromList(event) &&
    !(event.target as HTMLElement | null)?.closest('a,button,[role="button"],summary')
  ) {
    // Only from the list (or nowhere): Enter on a focused link or button keeps its own job.
    event.preventDefault()
    void navigateTo(props.itemTo(selected.value))
  } else if (key === 'Escape' && selected.value) {
    select(undefined)
  } else if (key === '?') {
    shortcutsOpen.value = true
  }
})

const position = computed(() =>
  selectedIndex.value >= 0 ? `${selectedIndex.value + 1} of ${list.value.length}` : '',
)
</script>

<template>
  <div
    class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] md:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[var(--inbox-list-w)_minmax(0,1fr)]"
  >
    <!-- List pane -->
    <section
      ref="listPane"
      class="flex min-h-0 min-w-0 flex-col md:rounded-bl-xl md:border-r md:border-rule md:bg-well"
      :class="isMobile && selected && 'hidden'"
      :aria-label="title"
    >
      <header class="border-b border-rule px-4 pt-5 md:px-5 md:pt-[22px]">
        <div class="flex items-baseline gap-3">
          <h1
            class="font-display text-[26px] leading-8 font-normal tracking-display md:text-[28px] md:leading-[34px]"
          >
            {{ title }}
          </h1>
          <span v-if="countLabel" class="text-sm text-ink-muted">{{ countLabel }}</span>
        </div>
        <UiTabs
          v-if="tabs?.length"
          v-model="tab"
          :tabs="tabs"
          class="mt-3.5"
          list-class="gap-4"
          :aria-label="`${title} tabs`"
        />
        <FilterBar
          v-if="filters?.length || sortNote || $slots['list-tools']"
          class="items-center gap-x-3 gap-y-2 py-3"
        >
          <UiSegmented
            v-if="filters?.length"
            v-model="filter"
            :options="filters"
            size="sm"
            label="Filter"
          />
          <slot name="list-tools" />
          <span
            v-if="sortNote"
            class="ml-auto text-[12.5px] whitespace-nowrap text-ink-subtle max-md:hidden"
            >{{ sortNote }}</span
          >
        </FilterBar>
      </header>

      <div v-if="loading" class="grid">
        <div v-for="index in 5" :key="index" class="grid gap-2 border-b border-rule px-5 py-3.5">
          <UiSkeleton class="h-3 w-1/3" /><UiSkeleton class="h-4 w-3/4" /><UiSkeleton
            class="h-3 w-1/2"
          />
        </div>
      </div>
      <div v-else-if="error" class="grid gap-3 p-5 text-base">
        Couldn't load this list. Check your connection and try again.
        <UiButton size="sm" variant="secondary" class="justify-self-start" @click="emit('retry')"
          >Try again</UiButton
        >
      </div>
      <div v-else-if="!list.length" class="flex-1 px-4">
        <slot name="empty">
          <EmptyState
            tone="positive"
            :icon="Inbox"
            :title="empty.title"
            :description="empty.description"
          />
        </slot>
      </div>
      <ul
        v-else
        ref="listEl"
        role="listbox"
        :aria-label="title"
        :aria-activedescendant="selected ? `${listId}-${itemKey(selected)}` : undefined"
        tabindex="0"
        class="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0 outline-none max-md:pb-[72px]"
      >
        <li
          v-for="item in list"
          :id="`${listId}-${itemKey(item)}`"
          :key="itemKey(item)"
          role="option"
          :aria-selected="itemKey(item) === selectedId"
          :aria-label="itemLabel?.(item)"
          class="relative grid cursor-pointer gap-1 border-b border-rule py-3.5 pr-5 pl-[22px] transition-colors duration-(--dur-1) hover:bg-hover aria-selected:bg-marker-tint aria-selected:shadow-[inset_0_1px_0_color-mix(in_srgb,var(--marker-strong)_40%,transparent),inset_0_-1px_0_color-mix(in_srgb,var(--marker-strong)_40%,transparent)] max-md:pl-5"
          :class="
            isUnread?.(item) &&
            'before:absolute before:top-[21px] before:left-[9px] before:size-[7px] before:rounded-full before:bg-marker-text'
          "
          @click="select(item, !isMobile)"
        >
          <slot
            name="item"
            :item="item"
            :selected="itemKey(item) === selectedId"
            :unread="isUnread?.(item) ?? false"
          />
        </li>
      </ul>

      <footer
        v-if="canDecide && list.length"
        class="flex gap-3.5 border-t border-rule px-5 py-2.5 text-meta text-ink-subtle max-md:hidden"
      >
        <span class="inline-flex items-center gap-1"><UiKbd>J</UiKbd><UiKbd>K</UiKbd> move</span>
        <span class="inline-flex items-center gap-1"><UiKbd>A</UiKbd> approve</span>
        <span class="inline-flex items-center gap-1"><UiKbd>D</UiKbd> decline</span>
        <span v-if="itemTo" class="inline-flex items-center gap-1 max-xl:hidden"
          ><UiKbd>Enter</UiKbd> full page</span
        >
      </footer>
    </section>

    <!-- Detail pane -->
    <section
      class="min-h-0 overflow-y-auto"
      :class="isMobile && !selected && 'hidden'"
      :aria-label="selected ? 'Details' : undefined"
    >
      <template v-if="selected">
        <div class="flex items-center justify-between px-1 pt-2 md:hidden">
          <UiButton
            variant="ghost"
            :icon="ArrowLeft"
            :aria-label="`Back to ${title}`"
            @click="select(undefined, false)"
            >{{ title }}</UiButton
          >
          <span class="pr-3 text-[12.5px] text-ink-subtle">{{ position }}</span>
        </div>
        <header
          class="flex flex-wrap items-start gap-x-6 gap-y-3.5 border-rule bg-sheet px-4 pt-2 pb-4 md:sticky md:top-0 md:z-[2] md:border-b md:px-8 md:pt-6 md:pb-[18px] xl:pl-9"
        >
          <!-- Announces the newly selected item (J/K) without reading the whole detail. -->
          <div class="min-w-0 flex-[1_1_320px]" aria-live="polite" aria-atomic="true">
            <!-- On phones the list (and its h1) is hidden behind the pushed detail: the title is the h1. -->
            <component
              :is="isMobile ? 'h1' : 'h2'"
              class="font-display text-[26px] leading-8 font-normal tracking-display md:text-[30px] md:leading-9"
            >
              <slot name="detail-title" :item="selected" />
            </component>
            <p class="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[13.5px] text-ink-muted">
              <slot name="detail-meta" :item="selected" />
            </p>
          </div>
          <div
            v-if="$slots['detail-actions']"
            class="flex items-center gap-2 pt-0.5 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:grid max-md:grid-flow-col max-md:auto-cols-fr max-md:border-t max-md:border-rule max-md:bg-sheet max-md:px-4 max-md:pt-2.5 max-md:pb-[calc(10px+env(safe-area-inset-bottom))] max-md:[&_button]:h-11"
          >
            <slot name="detail-actions" :item="selected" />
          </div>
        </header>
        <div class="max-w-[1000px] px-4 pt-0 pb-24 md:px-8 md:pt-[22px] md:pb-12 xl:pl-9">
          <slot name="detail" :item="selected" />
        </div>
      </template>
      <div v-else class="grid h-full place-items-center p-8 text-base text-ink-muted max-md:hidden">
        <slot name="detail-empty">Select an item to see the details.</slot>
      </div>
    </section>
  </div>
</template>
