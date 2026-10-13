<script setup lang="ts">
import { ChevronsUpDown, LogOut, RotateCcw, UserRound, UsersRound } from '@lucide/vue'
import { coreKeys } from '~/lib/query/core'
import type { Persona, PersonaKey } from '~/types/api'

/**
 * PersonaSwitcher (DESIGN §9, SCREENS §1.5): the account pill — avatar · name · job title — opening
 * Profile · Deputies · "Switch persona (demo)" (the 9 personas, current ticked) · Sign out.
 * Switching calls demo-login, clears the cache, goes Home and toasts "You're now Max Manager".
 */
defineProps<{ rail?: boolean; inline?: boolean }>()

const auth = useAuthStore()
const api = useApi()
const demo = useDemoMode()
const toast = useToast()

const personas = useQuery({
  queryKey: coreKeys.personas,
  queryFn: ({ signal }) => api.get<Persona[]>('/auth/personas', undefined, { signal }),
  enabled: demo.enabled,
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
})

const current = computed({
  get: () => auth.me?.personaKey ?? '',
  set: (key) => {
    if (key && key !== auth.me?.personaKey) void auth.switchPersona(key as PersonaKey)
  },
})

async function reset() {
  await demo.reset()
  toast.success('Demo data reset.')
}
</script>

<template>
  <UiMenu side="top" align="start" class="max-h-[min(560px,calc(100dvh-120px))] min-w-[300px]">
    <template #trigger>
      <button
        type="button"
        class="flex items-center gap-2.5 rounded-pill border border-rule-strong bg-sheet text-left transition-colors duration-(--dur-1) hover:border-field"
        :class="rail ? 'size-11 justify-center p-1' : 'w-full py-1.5 pr-2.5 pl-1.5'"
        :aria-label="`${auth.me?.displayName}, account and demo persona menu`"
        data-testid="account-menu"
      >
        <UiAvatar :initials="auth.me?.initials" :name="auth.me?.displayName" me />
        <template v-if="!rail">
          <span class="grid min-w-0 flex-1 leading-4">
            <b class="truncate text-sm font-semibold" data-testid="current-user">{{
              auth.me?.displayName
            }}</b>
            <span class="truncate text-meta text-ink-subtle">{{ auth.me?.jobTitle }}</span>
          </span>
          <ChevronsUpDown class="size-4 text-ink-subtle" aria-hidden="true" />
        </template>
      </button>
    </template>
    <UiMenuItem :icon="UserRound" to="/settings/profile">Profile</UiMenuItem>
    <UiMenuItem :icon="UsersRound" to="/settings/deputies">Deputies</UiMenuItem>
    <template v-if="demo.enabled.value && personas.data.value?.length">
      <UiMenuSeparator />
      <UiMenuLabel>Switch persona (demo)</UiMenuLabel>
      <UiMenuRadioGroup v-model="current">
        <UiMenuRadioItem
          v-for="persona in personas.data.value"
          :key="persona.key"
          :value="persona.key"
          :meta="persona.jobTitle"
          >{{ persona.displayName }}</UiMenuRadioItem
        >
      </UiMenuRadioGroup>
      <UiMenuItem v-if="demo.isMsw.value" :icon="RotateCcw" @select="reset"
        >Reset demo data</UiMenuItem
      >
    </template>
    <UiMenuSeparator />
    <UiMenuItem :icon="LogOut" destructive @select="auth.logout()">Sign out</UiMenuItem>
  </UiMenu>
</template>
