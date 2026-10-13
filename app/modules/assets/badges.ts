import { defineNavBadges } from '~/lib/registry'
import { useAssetCounts } from './api'

/** Nav badges (SCREENS §1.2 "Badge (source)"), owned by slice A3. */
export default defineNavBadges({
  assets: () => {
    const counts = useAssetCounts()
    return computed(() => {
      const count = counts.data.value?.mine.pending ?? 0
      return { count, label: `${count} to accept` }
    })
  },
  'back-office.assets': () => {
    const counts = useAssetCounts()
    return computed(() => counts.data.value?.admin?.pendingAcceptance ?? 0)
  },
})
