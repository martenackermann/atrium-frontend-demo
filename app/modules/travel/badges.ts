import { defineNavBadges } from '~/lib/registry'
import { useTravelCounts } from './api'

/** Nav badges (SCREENS §1.2 "Badge (source)"), owned by slice A2. */
export default defineNavBadges({
  'travel.approvals': () => {
    const counts = useTravelCounts()
    return computed(() => {
      const approvals = counts.data.value?.approvals
      const count = (approvals?.mine ?? 0) + (approvals?.deputy ?? 0)
      return { count, label: `${count} to approve` }
    })
  },
  'back-office.travel': () => {
    const counts = useTravelCounts()
    return computed(() => {
      const desk = counts.data.value?.desk
      const count = (desk?.toBook ?? 0) + (desk?.cancellationRequested ?? 0)
      const urgent = (desk?.toBookHighPriority ?? 0) > 0
      return {
        count,
        tone: urgent ? 'urgent' : 'plain',
        label: urgent ? `${count} to handle, ${desk?.toBookHighPriority} high priority` : undefined,
      }
    })
  },
})
