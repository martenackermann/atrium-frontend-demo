import { GraduationCap } from '@lucide/vue'
import { defineCommands } from '~/lib/registry'

/** ⌘K + "New request" commands (SCREENS §1.3), owned by slice A1. */
export default defineCommands([
  {
    id: 'training.new',
    group: 'create',
    label: 'New training request',
    icon: GraduationCap,
    to: '/training/new',
    keywords: ['course', 'learning', 'seminar'],
    newRequest: true,
    order: 40,
  },
])
