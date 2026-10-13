import { CarFront, Plane, TrainFront } from '@lucide/vue'
import { defineCommands } from '~/lib/registry'

/** ⌘K + "New request" commands (SCREENS §1.3), owned by slice A2. */
export default defineCommands([
  {
    id: 'travel.new-car',
    group: 'create',
    label: 'New car or van rental',
    icon: CarFront,
    to: '/travel/new/car',
    keywords: ['rental', 'van', 'trip'],
    newRequest: true,
    order: 10,
  },
  {
    id: 'travel.new-train',
    group: 'create',
    label: 'New train journey',
    icon: TrainFront,
    to: '/travel/new/train',
    keywords: ['rail', 'ticket', 'trip'],
    newRequest: true,
    order: 20,
  },
  {
    id: 'travel.new-flight',
    group: 'create',
    label: 'New flight',
    icon: Plane,
    to: '/travel/new/flight',
    keywords: ['plane', 'trip'],
    newRequest: true,
    order: 30,
  },
])
