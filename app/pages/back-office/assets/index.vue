<script setup lang="ts">
import { Boxes, ChevronRight, Plus } from '@lucide/vue'
import { useAssetDashboard } from '~/modules/assets/api'
import type { AssetStatus } from '~/modules/assets/api/types'
import { ASSET_STATUS_ORDER } from '~/modules/assets/constants'

/**
 * `/back-office/assets` — Asset dashboard (SCREENS §6.3): a StatCard per status, the status
 * distribution, "By device type" (in use vs in stock), "By manufacturer", "Waiting for acceptance"
 * (overdue count + 5 oldest) and "Recent activity" (10 timeline entries with the asset tag).
 */
definePageMeta({ title: 'Asset dashboard', access: ['asset_admin', 'it_admin'] })

const dashboard = useAssetDashboard()
const enums = useEnums()
const d = computed(() => dashboard.data.value)

const inventory = (status: AssetStatus) => ({
  path: '/back-office/assets/inventory',
  query: { status },
})
const cards = computed(() =>
  ASSET_STATUS_ORDER.map((status) => ({
    status,
    label: enums.label('assetStatus', status),
    value: d.value?.totals.byStatus[status],
    delta:
      status === 'pending_acceptance' && d.value?.pendingAcceptance.overdue
        ? `${d.value.pendingAcceptance.overdue} overdue`
        : undefined,
  })),
)
const manufacturers = computed(() =>
  (d.value?.byManufacturer ?? []).map((row) => ({
    id: row.manufacturer.id,
    label: row.manufacturer.name,
    value: row.total,
    to: { path: '/back-office/assets/inventory', query: { manufacturerId: row.manufacturer.id } },
  })),
)
const isMobile = useMediaQuery('(max-width: 767px)')
const activity = computed(() => (d.value?.recentActivity ?? []).slice(0, isMobile.value ? 5 : 10))
</script>

<template>
  <PageBody>
    <PageHeader
      title="Asset dashboard"
      subtitle="Where every device is, and what waits for people."
    >
      <template #actions>
        <UiButton variant="secondary" :icon="Boxes" to="/back-office/assets/inventory"
          >Open inventory</UiButton
        >
        <UiButton variant="primary" :icon="Plus" to="/back-office/assets/inventory/new"
          >New asset</UiButton
        >
      </template>
    </PageHeader>

    <ProblemAlert
      v-if="dashboard.error.value"
      class="mt-6"
      :error="dashboard.error.value"
      :retry="() => dashboard.refetch()"
    />

    <template v-else>
      <section class="mt-8 grid gap-4" aria-labelledby="status-heading">
        <h2 id="status-heading" class="sr">Assets by status</h2>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard
            v-for="card in cards"
            :key="card.status"
            :value="card.value"
            :label="card.label"
            :delta="card.delta"
            :loading="dashboard.isPending.value"
            :to="inventory(card.status)"
          />
        </div>
        <UiSkeleton v-if="dashboard.isPending.value" class="h-10 w-full" />
        <div v-else-if="d" class="grid gap-1">
          <p class="text-sm text-ink-muted">
            <span class="num font-semibold text-ink">{{ d.totals.all }}</span> assets, not counting
            deleted ones
          </p>
          <AssetsStatusDistribution :counts="d.totals.byStatus" />
        </div>
      </section>

      <div class="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <section aria-labelledby="types-heading">
          <h2 id="types-heading" class="mb-3 text-lg font-[650] tracking-heading">
            By device type
          </h2>
          <div class="border-t border-ink pt-4">
            <UiSkeleton v-if="dashboard.isPending.value" class="h-60 w-full" />
            <AssetsDeviceTypeChart v-else-if="d" :rows="d.byDeviceType" />
          </div>
        </section>
        <section aria-labelledby="manufacturers-heading">
          <h2 id="manufacturers-heading" class="mb-3 text-lg font-[650] tracking-heading">
            By manufacturer
          </h2>
          <div class="border-t border-ink pt-4">
            <UiSkeleton v-if="dashboard.isPending.value" class="h-60 w-full" />
            <AssetsRankedBars v-else :items="manufacturers" list-label="Assets by manufacturer" />
          </div>
        </section>
      </div>

      <div class="mt-12 grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="pending-heading">
          <h2 id="pending-heading" class="mb-1 text-lg font-[650] tracking-heading">
            Waiting for acceptance
          </h2>
          <p v-if="d" class="mb-3 text-sm text-ink-muted">
            {{ d.pendingAcceptance.total }} in total<template v-if="d.pendingAcceptance.overdue"
              >,
              <span class="font-semibold text-st-negative"
                >{{ d.pendingAcceptance.overdue }} overdue</span
              ></template
            >. Users get a reminder every few days.
          </p>
          <UiSkeleton v-if="dashboard.isPending.value" class="h-40 w-full" />
          <EmptyState
            v-else-if="d && !d.pendingAcceptance.oldest.length"
            compact
            tone="positive"
            title="Nothing waits for acceptance"
            description="Assigned devices show up here until their new owner accepts them."
          />
          <ul v-else-if="d" class="m-0 list-none border-t border-ink p-0">
            <li
              v-for="asset in d.pendingAcceptance.oldest"
              :key="asset.id"
              class="border-b border-rule"
            >
              <NuxtLink
                :to="`/back-office/assets/inventory/${asset.id}`"
                class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 text-ink no-underline hover:bg-hover md:px-2"
              >
                <AssetsDeviceGlyph :code="asset.deviceType.code" size="sm" />
                <span class="min-w-0">
                  <span class="block truncate text-md font-semibold">{{
                    asset.assignedUser?.displayName ?? '—'
                  }}</span>
                  <span class="block truncate text-sm text-ink-muted"
                    >{{ asset.model.name }} · <span class="mono">{{ asset.assetTag }}</span> · since
                    {{ formatDate(asset.updatedAt) }}</span
                  >
                </span>
                <ChevronRight class="size-4 text-ink-subtle" aria-hidden="true" />
              </NuxtLink>
            </li>
          </ul>
        </section>

        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" class="mb-3 text-lg font-[650] tracking-heading">
            Recent activity
          </h2>
          <UiSkeleton v-if="dashboard.isPending.value" class="h-40 w-full" />
          <ol v-else class="m-0 list-none border-t border-ink p-0">
            <li
              v-for="entry in activity"
              :key="entry.id"
              class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-rule py-2.5 text-sm"
            >
              <span class="min-w-0">
                <NuxtLink
                  :to="`/back-office/assets/inventory/${entry.asset.id}`"
                  class="link mono"
                  >{{ entry.asset.assetTag }}</NuxtLink
                >
                <span class="text-ink-muted"> · {{ entry.asset.model }}</span>
                <span class="block text-ink">{{ entry.summary }}</span>
              </span>
              <time
                :datetime="entry.occurredAt"
                class="text-meta whitespace-nowrap text-ink-subtle"
                >{{ formatAge(entry.occurredAt) }}</time
              >
            </li>
          </ol>
        </section>
      </div>
    </template>
  </PageBody>
</template>
