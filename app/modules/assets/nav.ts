import { Laptop } from '@lucide/vue'
import { defineNavEntries } from '~/lib/navigation'

/**
 * Assets navigation (owned by slice A3). Entries without roles are visible to every
 * signed-in user; admin entries use section: 'admin' and roles: [...].
 */
export default defineNavEntries([
  {
    id: 'assets',
    label: 'My devices',
    to: '/assets',
    icon: Laptop,
    order: 40,
  },
])
