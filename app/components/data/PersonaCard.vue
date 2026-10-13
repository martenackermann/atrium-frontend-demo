<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import type { Persona } from '~/types/api'

/**
 * PersonaCard (SCREENS §2 /login): name, job title, role chips, tagline, highlights, and
 * "Sign in as {first name}". On mobile the highlights fold away (single-column list).
 */
const props = defineProps<{ persona: Persona; loading?: boolean; disabled?: boolean }>()
defineEmits<{ select: [persona: Persona] }>()

const enums = useEnums()
const ROLE_LABELS: Record<string, string> = {
  executive: 'Executive',
  training_office: 'Training office',
  travel_desk: 'Travel desk',
  asset_admin: 'Asset admin',
  people_ops: 'People ops',
  news_editor: 'News editor',
  it_admin: 'IT admin',
  manager: 'Manager',
}
const roles = computed(() =>
  props.persona.roles
    .filter((role) => role !== 'employee')
    .map((role) => enums.label('role', role) || ROLE_LABELS[role] || role),
)
const firstName = computed(() => props.persona.displayName.split(' ')[0])
</script>

<template>
  <article
    class="group grid content-start gap-3 rounded-lg border border-rule bg-sheet p-4 transition-colors duration-(--dur-1) hover:border-rule-strong"
    :data-testid="`persona-${persona.key}`"
  >
    <header class="flex items-start gap-3">
      <UiAvatar :name="persona.displayName" size="lg" />
      <div class="grid min-w-0">
        <h3 class="text-md leading-[22px] font-semibold">{{ persona.displayName }}</h3>
        <p class="truncate text-sm text-ink-muted">
          {{ persona.jobTitle }} · {{ persona.department }}
        </p>
      </div>
    </header>
    <p class="font-display text-[17px] leading-6">{{ persona.tagline }}</p>
    <ul v-if="roles.length" class="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Roles">
      <li v-for="role in roles" :key="role"><UiMiniChip :label="role" /></li>
    </ul>
    <details class="text-sm text-ink-muted md:open:block" open>
      <summary class="cursor-pointer list-none font-medium text-ink md:hidden">What to try</summary>
      <ul class="mt-1 grid list-disc gap-1 pl-4">
        <li v-for="highlight in persona.highlights" :key="highlight">{{ highlight }}</li>
      </ul>
    </details>
    <UiButton
      variant="secondary"
      :icon-right="ArrowRight"
      :loading="loading"
      :disabled="disabled"
      class="mt-auto justify-self-start"
      @click="$emit('select', persona)"
      >Sign in as {{ firstName }}</UiButton
    >
  </article>
</template>
