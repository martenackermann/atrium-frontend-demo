import { defineNavBadges } from '~/lib/registry'
import { useTrainingCounts } from './api'

/** Nav badges (SCREENS §1.2 "Badge (source)"), owned by slice A1. */
export default defineNavBadges({
  training: () => {
    const counts = useTrainingCounts()
    return computed(() => {
      const mine = counts.data.value?.mine
      const count = (mine?.ratingsDue ?? 0) + (mine?.goalsMissing ?? 0)
      return { count, label: `${count} to rate or prepare` }
    })
  },
  'training.approvals': () => {
    const counts = useTrainingCounts()
    return computed(() => {
      const approvals = counts.data.value?.approvals
      const count =
        (approvals?.manager ?? 0) + (approvals?.executive ?? 0) + (approvals?.deputy ?? 0)
      return { count, label: `${count} to approve` }
    })
  },
  'training.ratings': () => {
    const counts = useTrainingCounts()
    return computed(() => counts.data.value?.mine.ratingsDue ?? 0)
  },
  'back-office.training': () => {
    const counts = useTrainingCounts()
    return computed(() => {
      const office = counts.data.value?.office
      return (office?.toBook ?? 0) + (office?.cancellationRequested ?? 0)
    })
  },
})
