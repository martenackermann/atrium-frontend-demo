<script setup lang="ts">
import { ChevronRight, Laptop } from '@lucide/vue'
import { useMyAssets } from '~/modules/assets/api'

/**
 * `/assets` — My devices (SCREENS §6.1). "Waiting for you": devices to accept (platform picker) or
 * decline (reason), in a needs-you region. "In use": what I use, with an "In repair" badge.
 */
definePageMeta({ title: 'My devices' })

const mine = useMyAssets()
const pending = computed(() => mine.data.value?.pending ?? [])
const active = computed(() => mine.data.value?.active ?? [])
const pendingTitle = computed(() =>
  pending.value.length === 1
    ? '1 device waits for you'
    : `${pending.value.length} devices wait for you`,
)
</script>

<template>
  <PageBody>
    <PageHeader
      title="My devices"
      subtitle="Equipment registered to you. Accept new devices so IT support knows they arrived."
    />

    <ProblemAlert
      v-if="mine.error.value"
      class="mt-6"
      :error="mine.error.value"
      :retry="() => mine.refetch()"
    />

    <div v-else-if="mine.isPending.value" class="mt-8 grid gap-3" aria-busy="true">
      <UiSkeleton v-for="n in 3" :key="n" class="h-24 w-full" />
    </div>

    <template v-else>
      <section
        v-if="pending.length"
        class="mt-8 grid gap-3 rounded-xl p-3 region-marker md:p-4"
        aria-labelledby="pending-heading"
      >
        <h2 id="pending-heading" class="px-1 text-lg font-[650] tracking-heading">
          <span class="hl">{{ pendingTitle }}</span>
        </h2>
        <AssetsPendingDeviceCard v-for="asset in pending" :key="asset.id" :asset="asset" />
      </section>

      <section class="mt-10 grid gap-3" aria-labelledby="active-heading">
        <h2 id="active-heading" class="text-lg font-[650] tracking-heading">In use</h2>
        <EmptyState
          v-if="!active.length"
          :icon="Laptop"
          title="No devices are assigned to you yet."
          description="When IT support hands you a laptop, phone or monitor, it shows up here for you to accept."
        />
        <ul v-else class="m-0 list-none border-t border-ink p-0">
          <li v-for="asset in active" :key="asset.id" class="border-b border-rule">
            <NuxtLink
              :to="`/assets/${asset.id}`"
              class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-3.5 text-ink no-underline hover:bg-hover md:px-2"
            >
              <AssetsDeviceGlyph :code="asset.deviceType.code" size="sm" />
              <span class="min-w-0">
                <span class="flex flex-wrap items-center gap-2">
                  <span class="text-md font-semibold">{{ asset.model.name }}</span>
                  <StatusBadge
                    v-if="asset.status === 'in_repair'"
                    enum="assetStatus"
                    :value="asset.status"
                  />
                </span>
                <span class="mt-0.5 flex flex-wrap gap-x-1.5 text-sm text-ink-muted">
                  <span class="mono">{{ asset.assetTag }}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    >Serial <span class="mono">{{ asset.serialNumber }}</span></span
                  >
                  <template v-if="asset.platform">
                    <span aria-hidden="true">·</span>
                    <span>{{ asset.platform.name }}</span>
                  </template>
                  <template v-if="asset.currentAssignment?.acceptedAt">
                    <span aria-hidden="true">·</span>
                    <span
                      >Since
                      <time :datetime="asset.currentAssignment.acceptedAt">{{
                        formatDate(asset.currentAssignment.acceptedAt)
                      }}</time></span
                    >
                  </template>
                </span>
              </span>
              <ChevronRight class="size-4 text-ink-subtle" aria-hidden="true" />
            </NuxtLink>
          </li>
        </ul>
      </section>

      <p class="mt-8 text-sm text-ink-muted">
        Something wrong with a device? Contact
        <a class="link" href="mailto:it-support@example.com">it-support@example.com</a>.
      </p>
    </template>
  </PageBody>
</template>
