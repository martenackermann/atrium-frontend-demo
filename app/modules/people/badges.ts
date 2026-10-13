import { defineNavBadges } from '~/lib/registry'
import { usePeopleCounts } from './api'

/** Nav badges (SCREENS §1.2 "Badge (source)"), owned by slice A4. */
export default defineNavBadges({
  people: () => {
    const counts = usePeopleCounts()
    return computed(() => {
      const count = counts.data.value?.mine.waitingOnMe ?? 0
      return { count, label: `${count} waiting for your reply` }
    })
  },
  'back-office.people': () => {
    const counts = usePeopleCounts()
    return computed(() => {
      const ops = counts.data.value?.ops
      return (ops?.open ?? 0) + (ops?.reopened ?? 0)
    })
  },
})
