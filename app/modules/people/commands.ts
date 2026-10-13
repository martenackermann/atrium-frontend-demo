import { UserPlus } from '@lucide/vue'
import { defineCommands } from '~/lib/registry'

/** ⌘K + "New request" commands (SCREENS §1.3), owned by slice A4. */
export default defineCommands([
  {
    id: 'people.new',
    group: 'create',
    label: 'New people request',
    icon: UserPlus,
    to: '/people-requests/new',
    keywords: ['onboarding', 'offboarding', 'role change', 'access'],
    newRequest: true,
    order: 50,
  },
])
