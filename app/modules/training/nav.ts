import { GraduationCap } from '@lucide/vue'
import { defineNavEntries } from '~/lib/navigation'

/**
 * Training navigation (owned by slice A1). Entries without roles are visible to every
 * signed-in user; admin entries use section: 'admin' and roles: [...].
 */
export default defineNavEntries([
  {
    id: 'training',
    label: 'Training',
    to: '/training',
    icon: GraduationCap,
    order: 20,
  },
])
