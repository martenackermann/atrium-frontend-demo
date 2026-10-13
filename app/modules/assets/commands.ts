import { Laptop } from '@lucide/vue'
import { BACK_OFFICE } from '~/lib/access'
import { defineCommands } from '~/lib/registry'

/** ⌘K commands (SCREENS §1.3), owned by slice A3. */
export default defineCommands([
  {
    id: 'assets.new',
    group: 'create',
    label: 'New asset',
    icon: Laptop,
    to: '/back-office/assets/inventory/new',
    keywords: ['device', 'laptop', 'inventory'],
    access: BACK_OFFICE.assets,
    order: 70,
  },
])
