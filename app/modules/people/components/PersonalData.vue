<script setup lang="ts">
import { Lock } from '@lucide/vue'
import type { FactItem } from '~/types/ui'
import type { PeopleRequestDetail } from '../api/types'

/**
 * Personal data (SCREENS §7.3, SPEC_RESOLUTIONS #24/#25): birth date, place of birth, nationality,
 * private address, phone and email — or the redacted notice for everyone else (it_admin, the
 * manager's deputy).
 */
const props = defineProps<{ request: PeopleRequestDetail }>()

const facts = computed<FactItem[]>(() => {
  const data = props.request.personalData
  if (!data) return []
  const address = data.privateAddress
  return [
    {
      label: 'Birth date',
      value: data.birthDate ? formatDate(data.birthDate, { weekday: false, year: 'always' }) : null,
    },
    { label: 'Place of birth', value: data.placeOfBirth },
    { label: 'Nationality', value: data.nationality, mono: true },
    {
      label: 'Private address',
      value: address ? `${address.street} ${address.houseNumber}` : null,
      detail: address ? `${address.postalCode} ${address.city}, ${address.countryCode}` : null,
    },
    { label: 'Private phone', value: data.privatePhone },
    { label: 'Private email', value: data.privateEmail },
  ]
})
</script>

<template>
  <section aria-labelledby="personal-heading" class="grid gap-3">
    <h2 id="personal-heading" class="flex items-center gap-2 text-lg font-[650] tracking-heading">
      Personal data
      <Lock class="size-4 text-ink-subtle" aria-hidden="true" />
    </h2>
    <p
      v-if="request.personalDataRedacted"
      class="flex gap-3 rounded-lg border border-rule bg-well px-4 py-3 text-base text-ink-muted"
      data-testid="personal-data-redacted"
    >
      <Lock class="mt-0.5 size-4 flex-none" aria-hidden="true" />
      Personal data is hidden. Only the requester, the manager and People Ops can see it.
    </p>
    <template v-else>
      <p class="text-sm text-ink-muted">
        Visible only to the requester, the manager and People Ops.
      </p>
      <FactGrid :items="facts" data-testid="personal-data" />
    </template>
  </section>
</template>
