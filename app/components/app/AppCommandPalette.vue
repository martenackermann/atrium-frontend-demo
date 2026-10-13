<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  Keyboard,
  Mail,
  Monitor,
  Moon,
  RotateCcw,
  Search,
  Sun,
  UserRound,
  UsersRound,
  X,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { inboxIcon } from '~/lib/inbox'
import { coreKeys } from '~/lib/query/core'
import type { InboxResponse, Persona, PersonaKey, SearchHit } from '~/types/api'

/**
 * Command palette (DESIGN §9, SCREENS §1.3): ⌘K / Ctrl+K or the search trigger. Sections:
 * Inbox (first 5) · Create (module commands) · Jump to (visible navigation) · Search (≥ 2 chars,
 * `GET /search`, debounced) · Demo (switch persona, mailbox, reset) · Preferences (theme, shortcuts).
 * Arrow keys move, Enter opens, Esc closes.
 */
interface PaletteItem {
  id: string
  group: string
  label: string
  icon?: Component
  hint?: string
  mono?: boolean
  keywords?: string
  to?: RouteLocationRaw
  run?: () => void | Promise<void>
}

const { paletteOpen, shortcutsOpen } = useShell()
const api = useApi()
const auth = useAuthStore()
const demo = useDemoMode()
const theme = useTheme()
const toast = useToast()
const { flat } = useNavigation()
const { createCommands } = useCommands()

const query = ref('')
const active = ref(0)
const listId = useId()
const debounced = refDebounced(query, 250)
watch(paletteOpen, (open) => {
  if (open) {
    query.value = ''
    active.value = 0
  }
})

const inbox = useQuery({
  queryKey: coreKeys.inbox(),
  queryFn: ({ signal }) => api.get<InboxResponse>('/me/inbox', undefined, { signal }),
  enabled: computed(() => paletteOpen.value && auth.isAuthenticated),
})
const personas = useQuery({
  queryKey: coreKeys.personas,
  queryFn: ({ signal }) => api.get<Persona[]>('/auth/personas', undefined, { signal }),
  enabled: computed(() => paletteOpen.value && demo.enabled.value),
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
})
const search = useQuery({
  queryKey: computed(() => coreKeys.search(debounced.value.trim())),
  queryFn: ({ signal }) =>
    api.get<{ data: SearchHit[] }>('/search', { q: debounced.value.trim() }, { signal }),
  enabled: computed(() => paletteOpen.value && debounced.value.trim().length >= 2),
  retry: false,
})

const matches = (item: PaletteItem) => {
  const terms = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const text = `${item.label} ${item.keywords ?? ''} ${item.hint ?? ''}`.toLowerCase()
  return terms.every((term) => text.includes(term))
}

const groups = computed(() => {
  const sections: Array<{ label: string; items: PaletteItem[] }> = []
  const inboxItems: PaletteItem[] = (inbox.data.value?.data ?? []).slice(0, 5).map((item) => ({
    id: `inbox:${item.id}`,
    group: 'Inbox',
    label: item.title,
    icon: inboxIcon(item),
    hint: item.reference ?? undefined,
    mono: Boolean(item.reference),
    to: internalLink(item.link, '/inbox'),
  }))
  const create: PaletteItem[] = [
    ...createCommands.value.map((command) => ({
      id: command.id,
      group: 'Create',
      label: command.label,
      icon: command.icon,
      keywords: command.keywords?.join(' '),
      to: command.to,
      run: command.run,
    })),
    ...(auth.can(['manager', 'executive'])
      ? [
          {
            id: 'core.add-deputy',
            group: 'Create',
            label: 'Add a deputy',
            icon: UsersRound,
            keywords: 'leave holiday',
            to: '/settings/deputies?add=1',
          },
        ]
      : []),
  ]
  const jump: PaletteItem[] = flat.value.map(({ item, parent }) => ({
    id: `nav:${item.id}`,
    group: 'Jump to',
    label: parent ? `${parent.label} · ${item.label}` : item.label,
    icon: item.icon ?? parent?.icon,
    hint: item.shortcut?.join(' ').toUpperCase(),
    keywords: `go to ${item.label}`,
    to: item.to,
  }))
  const searchItems: PaletteItem[] = (search.data.value?.data ?? []).map((hit) => ({
    id: `search:${hit.type}:${hit.id}`,
    group: 'Search',
    label: hit.title,
    hint: hit.reference ?? hit.subtitle ?? undefined,
    mono: Boolean(hit.reference),
    to: internalLink(hit.link),
  }))
  const demoItems: PaletteItem[] = demo.enabled.value
    ? [
        ...(personas.data.value ?? [])
          .filter((persona) => persona.key !== auth.me?.personaKey)
          .map((persona) => ({
            id: `persona:${persona.key}`,
            group: 'Demo',
            label: `Switch to ${persona.displayName}`,
            icon: UserRound,
            hint: persona.jobTitle,
            keywords: persona.tagline,
            run: () => auth.switchPersona(persona.key as PersonaKey),
          })),
        ...(demo.mailpitUrl.value
          ? [
              {
                id: 'demo.mailbox',
                group: 'Demo',
                label: 'Open demo mailbox',
                icon: Mail,
                run: () => void window.open(demo.mailpitUrl.value, '_blank', 'noopener'),
              },
            ]
          : []),
        ...(demo.isMsw.value
          ? [
              {
                id: 'demo.reset',
                group: 'Demo',
                label: 'Reset demo data',
                icon: RotateCcw,
                run: async () => {
                  await demo.reset()
                  toast.success('Demo data reset.')
                },
              },
            ]
          : []),
      ]
    : []
  const preferences: PaletteItem[] = [
    {
      id: 'theme.light',
      group: 'Preferences',
      label: 'Theme: light',
      icon: Sun,
      run: () => theme.set('light'),
    },
    {
      id: 'theme.dark',
      group: 'Preferences',
      label: 'Theme: dark',
      icon: Moon,
      run: () => theme.set('dark'),
    },
    {
      id: 'theme.system',
      group: 'Preferences',
      label: 'Theme: system',
      icon: Monitor,
      run: () => theme.set('system'),
    },
    {
      id: 'shortcuts',
      group: 'Preferences',
      label: 'Keyboard shortcuts',
      icon: Keyboard,
      keywords: 'keys help ?',
      run: () => void (shortcutsOpen.value = true),
    },
  ]

  for (const [label, items, filter] of [
    ['Inbox', inboxItems, true],
    ['Create', create, true],
    ['Jump to', jump, true],
    ['Search', searchItems, false],
    ['Demo', demoItems, true],
    ['Preferences', preferences, true],
  ] as const) {
    const visible = filter ? items.filter(matches) : items
    if (visible.length)
      sections.push({
        label,
        items: visible.slice(0, label === 'Jump to' && !query.value ? 8 : 20),
      })
  }
  return sections
})

const flatItems = computed(() => groups.value.flatMap((group) => group.items))
watch(flatItems, () => {
  active.value = Math.min(active.value, Math.max(flatItems.value.length - 1, 0))
})
watch(query, () => (active.value = 0))

async function choose(item: PaletteItem | undefined) {
  if (!item) return
  paletteOpen.value = false
  if (item.run) await item.run()
  else if (item.to) await navigateTo(item.to)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    active.value = (active.value + 1) % Math.max(flatItems.value.length, 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    active.value = (active.value - 1 + flatItems.value.length) % Math.max(flatItems.value.length, 1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    void choose(flatItems.value[active.value])
  }
}

const optionId = (item: PaletteItem) => `${listId}-${item.id.replace(/[^a-z0-9-]/gi, '-')}`
const activeItem = computed(() => flatItems.value[active.value])
watch(activeItem, (item) => {
  if (item)
    nextTick(() => document.getElementById(optionId(item))?.scrollIntoView({ block: 'nearest' }))
})
const searching = computed(() => query.value.trim().length >= 2 && search.isFetching.value)
// Screen readers hear how many results the query left (debounced with the search).
const resultsAnnouncement = computed(() => {
  if (!debounced.value.trim() || searching.value) return ''
  const count = flatItems.value.length
  return count === 0 ? `No results for ${debounced.value.trim()}` : `${count} results`
})
</script>

<template>
  <DialogRoot v-model:open="paletteOpen">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-[atrium-fade_var(--dur-2)_var(--curve-standard)]"
      />
      <DialogContent
        class="fixed inset-0 z-50 flex flex-col overflow-hidden bg-raised shadow-dialog outline-none md:inset-auto md:top-[14vh] md:left-1/2 md:max-h-[min(560px,80dvh)] md:w-[min(640px,calc(100vw-32px))] md:-translate-x-1/2 md:rounded-xl md:data-[state=open]:animate-[atrium-pop_var(--dur-2)_var(--curve-out)]"
        data-testid="command-palette"
        @open-auto-focus.prevent="($event.target as HTMLElement)?.querySelector('input')?.focus()"
      >
        <DialogTitle class="sr">Search or jump to</DialogTitle>
        <DialogDescription class="sr"
          >Type to search requests, jump to a page or run a command.</DialogDescription
        >
        <div class="flex h-[54px] flex-none items-center gap-2.5 border-b border-rule px-4">
          <Search class="size-4 text-ink-subtle" aria-hidden="true" />
          <input
            v-model="query"
            type="text"
            role="combobox"
            aria-expanded="true"
            :aria-controls="listId"
            :aria-activedescendant="activeItem ? optionId(activeItem) : undefined"
            aria-autocomplete="list"
            aria-label="Search or jump to"
            placeholder="Search, or type a reference like TRV-000031"
            class="min-w-0 flex-1 border-0 bg-transparent text-[16px] outline-none placeholder:text-ink-subtle"
            @keydown="onKeydown"
          />
          <UiSpinner v-if="searching" class="size-4 text-ink-subtle" />
          <UiKbd class="max-md:hidden">Esc</UiKbd>
          <DialogClose
            class="grid size-10 flex-none place-items-center rounded-md text-ink-muted hover:bg-hover hover:text-ink md:hidden"
            aria-label="Close"
          >
            <X class="size-4" aria-hidden="true" />
          </DialogClose>
        </div>
        <div
          :id="listId"
          role="listbox"
          aria-label="Results"
          class="min-h-0 flex-1 overflow-y-auto p-1.5 md:max-h-[380px]"
        >
          <div
            v-for="group in groups"
            :key="group.label"
            role="group"
            :aria-labelledby="`${listId}-group-${group.label.replace(/\s/g, '-')}`"
          >
            <div
              :id="`${listId}-group-${group.label.replace(/\s/g, '-')}`"
              class="px-2.5 pt-2.5 pb-1 text-meta font-semibold text-ink-subtle"
              role="presentation"
            >
              {{ group.label }}
            </div>
            <div
              v-for="item in group.items"
              :id="optionId(item)"
              :key="item.id"
              role="option"
              :aria-selected="activeItem?.id === item.id"
              class="flex h-[38px] cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-base text-ink aria-selected:bg-marker-tint max-md:h-11"
              @mousemove="active = flatItems.indexOf(item)"
              @click="choose(item)"
            >
              <component
                :is="item.icon"
                v-if="item.icon"
                class="size-4 text-ink-subtle"
                aria-hidden="true"
              />
              <span class="min-w-0 truncate">{{ item.label }}</span>
              <span
                v-if="item.hint"
                class="ml-auto flex-none truncate pl-2 text-meta text-ink-subtle"
                :class="item.mono && 'font-mono'"
                >{{ item.hint }}</span
              >
            </div>
          </div>
          <p
            v-if="!flatItems.length && !searching"
            class="px-3 py-6 text-center text-sm text-ink-muted"
          >
            No results for “{{ query }}”. Try a request ID like TRV-000031.
          </p>
        </div>
        <p class="sr" aria-live="polite">{{ resultsAnnouncement }}</p>
        <div
          class="flex flex-none gap-4 border-t border-rule bg-well px-4 py-2.5 text-meta text-ink-subtle max-md:hidden"
        >
          <span class="inline-flex items-center gap-1.5"
            ><UiKbd><ArrowUp class="size-3" /></UiKbd
            ><UiKbd><ArrowDown class="size-3" /></UiKbd> Move</span
          >
          <span class="inline-flex items-center gap-1.5"
            ><UiKbd><CornerDownLeft class="size-3" /></UiKbd> Open</span
          >
          <span class="inline-flex items-center gap-1.5"><UiKbd>Esc</UiKbd> Close</span>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
