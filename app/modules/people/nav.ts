import { UserPlus } from '@lucide/vue'
import { defineNavEntries } from '~/lib/navigation'

/**
 * People navigation (owned by slice A4). Entries without roles are visible to every
 * signed-in user; admin entries use section: 'admin' and roles: [...].
 */
export default defineNavEntries([
  {
    id: 'people',
    label: 'People requests',
    to: '/people',
    icon: UserPlus,
    order: 50,
  },
])
