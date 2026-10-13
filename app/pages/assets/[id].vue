<script setup lang="ts">
import { isApiError } from '~/lib/api'
import { useAsset } from '~/modules/assets/api'
import type { FactItem } from '~/types/ui'

/**
 * `/assets/[id]` — My device detail (SCREENS §6.2): model, manufacturer, type, asset tag, serial,
 * platform, status, the current assignment, and Accept/Decline while it waits for me. No admin
 * notes and no earlier holders (SPEC §3.3, SPEC_RESOLUTIONS #24).
 */
definePageMeta({ title: 'Device' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const asset = useAsset(id)
useBreadcrumbTail(() => asset.data.value?.assetTag)

watch(
  () => asset.error.value,
  (error) => {
    if (isApiError(error) && error.status === 404) {
      showError({ statusCode: 404, statusMessage: 'Not found' })
    }
  },
)

const facts = computed<FactItem[]>(() => {
  const a = asset.data.value
  if (!a) return []
  const assignment = a.currentAssignment
  return [
    { label: 'Asset tag', value: a.assetTag, mono: true },
    { label: 'Serial number', value: a.serialNumber, mono: true },
    { label: 'Device type', value: a.deviceType.name },
    { label: 'Manufacturer', value: a.manufacturer.name },
    { label: 'Model', value: a.model.name },
    {
      label: 'Platform',
      value:
        a.platform?.name ??
        (a.deviceType.requiresPlatform ? 'Chosen when you accept' : 'Not applicable'),
    },
    {
      label: 'Assigned by',
      value: assignment?.assignedBy.displayName,
      detail: assignment ? formatDateTime(assignment.assignedAt) : null,
    },
    {
      label: 'Accepted',
      value: assignment?.acceptedAt ? formatDate(assignment.acceptedAt) : 'Not yet',
    },
    { label: 'Device name', value: a.name, mono: true },
  ]
})
</script>

<template>
  <PageBody>
    <ProblemAlert
      v-if="
        asset.error.value && !(isApiError(asset.error.value) && asset.error.value.status === 404)
      "
      :error="asset.error.value"
      :retry="() => asset.refetch()"
    />
    <div v-else-if="asset.isPending.value" class="grid gap-4" aria-busy="true">
      <UiSkeleton class="h-10 w-2/3" />
      <UiSkeleton class="h-40 w-full" />
    </div>
    <template v-else-if="asset.data.value">
      <PageHeader :title="asset.data.value.model.name">
        <template #meta>
          <span>{{ asset.data.value.deviceType.name }}</span>
          <span aria-hidden="true">·</span>
          <span class="mono">{{ asset.data.value.assetTag }}</span>
        </template>
        <template #status>
          <StatusBadge
            enum="assetStatus"
            :value="asset.data.value.status"
            :available-actions="asset.data.value.availableActions"
          />
        </template>
        <template #actions>
          <AssetsAcceptanceActions :asset="asset.data.value" />
        </template>
      </PageHeader>

      <div
        v-if="asset.data.value.status === 'pending_acceptance'"
        class="mt-6 rounded-xl p-4 text-base region-marker"
      >
        {{ asset.data.value.currentAssignment?.assignedBy.displayName }} assigned this
        {{ asset.data.value.deviceType.name.toLowerCase() }} to you. Accept it when you have it in
        hand, or decline it with a reason if something is wrong.
        <blockquote
          v-if="asset.data.value.currentAssignment?.note"
          class="mt-3 border-l border-rule-strong pl-3 font-display text-[17px] leading-[25px]"
        >
          {{ asset.data.value.currentAssignment.note }}
        </blockquote>
      </div>
      <p
        v-else-if="asset.data.value.status === 'in_repair'"
        class="mt-6 rounded-lg border border-rule bg-well px-4 py-3 text-base"
      >
        This device is being repaired. It comes back to you when the repair is done.
      </p>

      <section class="mt-8" aria-labelledby="facts-heading">
        <h2 id="facts-heading" class="mb-3 text-lg font-[650] tracking-heading">Details</h2>
        <FactGrid :items="facts" />
      </section>

      <p class="mt-8 text-sm text-ink-muted">
        Something wrong with this device? Contact
        <a class="link" href="mailto:it-support@example.com">it-support@example.com</a> and quote
        <span class="mono">{{ asset.data.value.assetTag }}</span
        >.
      </p>
    </template>
  </PageBody>
</template>
