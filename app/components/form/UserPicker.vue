<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ChevronDown, X } from '@lucide/vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui'
import { coreKeys } from '~/lib/query/core'
import { useControlSize, useFieldContext } from '~/lib/field'
import { cn } from '~/lib/cn'
import type { Page, RoleName, UserRef, UserSummary } from '~/types/api'

/**
 * UserPicker (DESIGN §9 Combobox): searches `/users?q=` by name or email (debounced), options show
 * avatar · name · department · email. `multiple` renders chips with remove buttons (train
 * travellers). Pass `options` to restrict the choice (approver pickers: the management chain).
 * Height: 38px like Input (36px as a list filter: inside DataTable `#filters`, or `size="filter"`);
 * 40px on phones. Outside a UiField, name it with `aria-label` (it lands on the input).
 */
const props = withDefaults(
  defineProps<{
    multiple?: boolean
    /** team = my reporting tree (SCREENS: `scope=team` unless back office). */
    scope?: 'all' | 'team'
    role?: RoleName
    /** Fixed candidates instead of a server search. */
    options?: readonly UserRef[]
    /** Ids that can't be picked (e.g. the traveller among companions). */
    exclude?: readonly string[]
    placeholder?: string
    invalid?: boolean
    disabled?: boolean
    id?: string
    /** `filter` = 36px, to sit next to toolbar Selects (automatic inside DataTable filters). */
    size?: 'md' | 'filter'
    ariaLabel?: string
    class?: HTMLAttributes['class']
  }>(),
  // `invalid` stays undefined when absent so the field context decides (Vue casts to false).
  { scope: 'all', placeholder: 'Search by name or email', invalid: undefined, size: undefined },
)
const model = defineModel<UserRef | UserRef[] | null>({ default: null })
const field = useFieldContext()
const toolbar = useControlSize()
const isFilter = computed(() => (props.size ?? toolbar) === 'filter')
const api = useApi()
const isInvalid = computed(() => props.invalid ?? field?.invalid.value ?? false)

const open = ref(false)
const term = ref('')
const debounced = refDebounced(term, 250)

const search = useQuery({
  queryKey: computed(() =>
    coreKeys.users({ q: debounced.value, scope: props.scope, role: props.role, perPage: 10 }),
  ),
  queryFn: ({ signal }) =>
    api.get<Page<UserSummary>>(
      '/users',
      { q: debounced.value || undefined, scope: props.scope, role: props.role, perPage: 10 },
      { signal },
    ),
  enabled: computed(() => open.value && !props.options),
  placeholderData: keepPreviousData,
})

const results = computed<Array<UserRef | UserSummary>>(() => {
  const excluded = new Set(props.exclude ?? [])
  const selectedIds = new Set(
    (Array.isArray(model.value) ? model.value : []).map((user) => user.id),
  )
  const list = props.options
    ? props.options.filter((user) =>
        `${user.displayName} ${user.email}`.toLowerCase().includes(term.value.toLowerCase()),
      )
    : (search.data.value?.data ?? [])
  return list.filter((user) => !excluded.has(user.id) && !selectedIds.has(user.id))
})

const selectedList = computed(() => (Array.isArray(model.value) ? model.value : []))
const single = computed(() => (Array.isArray(model.value) ? null : model.value))

function remove(id: string) {
  model.value = selectedList.value.filter((user) => user.id !== id)
}

const emptyText = computed(() =>
  term.value
    ? `No one matches “${term.value}”. Check the spelling or search by email.`
    : 'Type a name or email.',
)

const toRef = (user: UserRef | UserSummary): UserRef => ({
  id: user.id,
  displayName: user.displayName,
  email: user.email,
  jobTitle: user.jobTitle,
  initials: user.initials,
})
const departmentOf = (user: UserRef | UserSummary) =>
  'department' in user ? user.department?.name : null
</script>

<template>
  <ComboboxRoot
    v-model="model as never"
    v-model:open="open"
    :multiple="multiple"
    :disabled="disabled"
    ignore-filter
    :reset-search-term-on-blur="!multiple"
    reset-search-term-on-select
    :by="(a: UserRef | null, b: UserRef | null) => a?.id === b?.id"
  >
    <ComboboxAnchor
      :class="
        cn(
          'flex w-full items-center gap-1.5 rounded-md border bg-sheet pr-1 pl-2 text-base max-md:min-h-10',
          isFilter ? 'h-9 flex-nowrap py-0 text-sm' : 'min-h-[38px] flex-wrap py-1',
          'transition-[border-color,box-shadow] duration-(--dur-1) ease-standard hover:border-ink-muted',
          'focus-within:border-ink focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--focus)_28%,transparent)]',
          isInvalid ? 'border-st-negative' : 'border-field',
          disabled && 'bg-well',
          props.class,
        )
      "
    >
      <template v-if="multiple">
        <span
          v-for="user in selectedList"
          :key="user.id"
          class="inline-flex h-7 items-center gap-1 rounded-sm bg-well pr-0.5 pl-1.5 text-sm font-medium shadow-[inset_0_0_0_1px_var(--rule-strong)]"
        >
          <UiAvatar :initials="user.initials" size="sm" class="size-5 text-[10px]" />
          {{ user.displayName }}
          <button
            type="button"
            class="grid size-6 place-items-center rounded-[5px] text-ink-muted hover:bg-hover hover:text-ink"
            :aria-label="`Remove ${user.displayName}`"
            @click="remove(user.id)"
          >
            <X class="size-3.5" aria-hidden="true" />
          </button>
        </span>
      </template>
      <UiAvatar v-else-if="single" :initials="single.initials" size="sm" />
      <ComboboxInput
        :id="id ?? field?.id"
        v-model="term"
        :display-value="(user: UserRef | null) => (multiple ? '' : (user?.displayName ?? ''))"
        :placeholder="selectedList.length ? '' : placeholder"
        :aria-label="ariaLabel"
        :aria-invalid="isInvalid || undefined"
        :aria-describedby="field?.describedBy.value"
        class="h-7 min-w-0 flex-1 truncate bg-transparent px-1 outline-none placeholder:text-ink-subtle"
        :class="!isFilter && 'min-w-[120px]'"
        @focus="open = true"
      />
      <ComboboxTrigger
        class="grid size-7 place-items-center rounded-md text-ink-subtle hover:bg-hover hover:text-ink"
        aria-label="Show people"
      >
        <ChevronDown class="size-4" aria-hidden="true" />
      </ComboboxTrigger>
    </ComboboxAnchor>
    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        :side-offset="4"
        class="z-[60] max-h-80 w-(--reka-combobox-trigger-width) min-w-72 overflow-hidden rounded-lg border border-rule bg-raised p-1.5 shadow-pop"
      >
        <ComboboxViewport>
          <ComboboxEmpty class="px-2.5 py-3 text-sm text-ink-muted">{{ emptyText }}</ComboboxEmpty>
          <ComboboxItem
            v-for="user in results"
            :key="user.id"
            :value="toRef(user)"
            class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 outline-none data-highlighted:bg-marker-tint max-md:min-h-11"
          >
            <UiAvatar :initials="user.initials" size="md" />
            <span class="grid min-w-0 leading-[18px]">
              <span class="truncate text-base font-medium">{{ user.displayName }}</span>
              <span class="truncate text-sm text-ink-muted">
                <template v-if="departmentOf(user)">{{ departmentOf(user) }} · </template
                >{{ user.email }}
              </span>
            </span>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
