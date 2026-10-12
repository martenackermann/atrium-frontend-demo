import { House } from '@lucide/vue'
import { defineNavEntries } from '~/lib/navigation'

/**
 * Home navigation (owned by slice A4). Entries without roles are visible to every
 * signed-in user; admin entries use section: 'admin' and roles: [...].
 */
export default defineNavEntries([
  {
    id: 'home',
    label: 'Home',
    to: '/',
    icon: House,
    order: 0,
  },
])
