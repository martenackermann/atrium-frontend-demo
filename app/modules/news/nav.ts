import { Newspaper } from '@lucide/vue'
import { defineNavEntries } from '~/lib/navigation'

/**
 * News navigation (owned by slice A4). Entries without roles are visible to every
 * signed-in user; admin entries use section: 'admin' and roles: [...].
 */
export default defineNavEntries([
  {
    id: 'news',
    label: 'News',
    to: '/news',
    icon: Newspaper,
    order: 60,
  },
])
