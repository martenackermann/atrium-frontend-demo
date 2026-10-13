<script setup lang="ts">
import { useQueueCounts } from '../api'
import type {
  AssetAdminCounts,
  PeopleOpsCounts,
  TrainingOfficeCounts,
  TravelDeskCounts,
} from '../api/types'

/**
 * "Your queues" (SCREENS §3, DESIGN §8.1): StatCards for the back-office roles — number, label
 * below, the whole card links to its queue. Counts come from each module's `/queues/counts`; a
 * module that is not built yet answers zeros or 404 (no tile).
 */
const auth = useAuthStore()
const has = (role: 'training_office' | 'travel_desk' | 'asset_admin' | 'people_ops') =>
  auth.is(role) || auth.is('it_admin')

const training = useQueueCounts<TrainingOfficeCounts>('/training/queues/counts', () =>
  has('training_office'),
)
const travel = useQueueCounts<TravelDeskCounts>('/travel/queues/counts', () => has('travel_desk'))
const assets = useQueueCounts<AssetAdminCounts>('/assets/queues/counts', () => has('asset_admin'))
const people = useQueueCounts<PeopleOpsCounts>('/people/queues/counts', () => has('people_ops'))

interface Tile {
  value: number | null | undefined
  label: string
  to: string
}
interface Group {
  title: string
  tiles: Tile[]
}

const groups = computed<Group[]>(() => {
  const result: Group[] = []
  const office = training.data.value?.office
  if (has('training_office') && office) {
    result.push({
      title: 'Training office',
      tiles: [
        { value: office.toBook, label: 'to book', to: '/back-office/training?queue=to_book' },
        {
          value: office.cancellationRequested,
          label: 'cancellations',
          to: '/back-office/training?queue=cancellations',
        },
        {
          value: office.bookingImpossible,
          label: 'booking impossible',
          to: '/back-office/training?queue=booking_impossible',
        },
      ],
    })
  }
  const desk = travel.data.value?.desk
  if (has('travel_desk') && desk) {
    result.push({
      title: 'Travel desk',
      tiles: [
        { value: desk.toBook, label: 'to book', to: '/back-office/travel?queue=to_book' },
        {
          value: desk.toBookHighPriority,
          label: 'of them high priority',
          to: '/back-office/travel?queue=to_book',
        },
        {
          value: desk.cancellationRequested,
          label: 'cancellations',
          to: '/back-office/travel?queue=cancellations',
        },
      ],
    })
  }
  const admin = assets.data.value?.admin
  if (has('asset_admin') && admin) {
    result.push({
      title: 'Asset admin',
      tiles: [
        {
          value: admin.pendingAcceptance,
          label: 'awaiting acceptance',
          to: '/back-office/assets/inventory?status=pending_acceptance',
        },
        {
          value: admin.inRepair,
          label: 'in repair',
          to: '/back-office/assets/inventory?status=in_repair',
        },
      ],
    })
  }
  const ops = people.data.value?.ops
  if (has('people_ops') && ops) {
    result.push({
      title: 'People ops',
      tiles: [
        { value: ops.open, label: 'open', to: '/back-office/people?queue=open' },
        { value: ops.reopened, label: 'reopened', to: '/back-office/people?queue=open' },
        {
          value: ops.unassigned,
          label: 'unassigned',
          to: '/back-office/people?queue=all&assignee=none',
        },
      ],
    })
  }
  return result
})
</script>

<template>
  <section v-if="groups.length" aria-labelledby="queues-heading" data-testid="your-queues">
    <h2 id="queues-heading" class="pb-3 text-lg font-[650] tracking-heading">Your queues</h2>
    <div class="grid gap-6">
      <div v-for="group in groups" :key="group.title" class="grid gap-2">
        <h3 class="text-[12px] font-semibold text-ink-subtle">{{ group.title }}</h3>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            v-for="tile in group.tiles"
            :key="tile.label"
            :value="tile.value"
            :label="tile.label"
            :to="tile.to"
          />
        </div>
      </div>
    </div>
  </section>
</template>
