<script setup lang="ts">
import type { FactItem } from '~/types/ui'
import type { PeopleRequestDetail } from '../api/types'
import { PRIORITY_LABELS, TYPE_META } from '../constants'

/** "Person and organisation" facts of a people request (SCREENS §7.3). */
const props = defineProps<{ request: PeopleRequestDetail }>()

const SALUTATIONS = { mr: 'Mr', ms: 'Ms', mx: 'Mx' } as const

const facts = computed<FactItem[]>(() => {
  const r = props.request
  const meta = TYPE_META[r.type]
  return [
    {
      label: r.type === 'onboarding' ? 'New colleague' : 'Person',
      value: [r.salutation ? SALUTATIONS[r.salutation] : null, r.firstName, r.lastName]
        .filter(Boolean)
        .join(' '),
      detail: r.subjectUser?.jobTitle ?? null,
    },
    { label: meta.effectiveLabel, value: formatDate(r.effectiveDate) },
    {
      label: r.type === 'role_change' ? 'New job role' : 'Job role',
      value: r.jobRole?.name ?? null,
    },
    { label: 'Department', value: r.department?.name ?? null },
    { label: 'Site', value: r.site?.name ?? null },
    { label: 'Manager', value: r.manager?.displayName ?? null },
    { label: "Manager's deputy", value: r.managerDeputy?.displayName ?? null },
    { label: 'Requested by', value: r.requester.displayName, detail: formatDate(r.createdAt) },
    { label: 'Priority', value: PRIORITY_LABELS[r.priority] },
  ]
})

const texts = computed(() =>
  [
    { label: 'Reason', value: props.request.reason },
    { label: 'Further information', value: props.request.furtherInformation },
    { label: 'Equipment', value: props.request.equipmentNotes },
  ].filter((item) => item.value),
)
</script>

<template>
  <section aria-labelledby="facts-heading" class="grid gap-3">
    <h2 id="facts-heading" class="text-lg font-[650] tracking-heading">Person and organisation</h2>
    <FactGrid :items="facts" />
    <dl v-if="texts.length" class="m-0 grid gap-4 pt-2">
      <div v-for="item in texts" :key="item.label">
        <dt class="text-[12.5px] leading-[18px] text-ink-subtle">{{ item.label }}</dt>
        <dd
          class="m-0 mt-1 max-w-[65ch] whitespace-pre-line"
          :class="
            item.label === 'Reason'
              ? 'font-display text-[17px] leading-[25px] text-ink'
              : 'text-base text-ink'
          "
        >
          {{ item.value }}
        </dd>
      </div>
    </dl>
  </section>
</template>
