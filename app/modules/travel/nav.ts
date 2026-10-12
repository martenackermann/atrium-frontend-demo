import { Plane } from '@lucide/vue'
import { defineNavEntries } from '~/lib/navigation'

/**
 * Travel navigation (owned by slice A2). Entries without roles are visible to every
 * signed-in user; admin entries use section: 'admin' and roles: [...].
 */
export default defineNavEntries([
  {
    id: 'travel',
    label: 'Travel',
    to: '/travel',
    icon: Plane,
    order: 30,
  },
])
