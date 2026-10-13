import type { EnumOption } from '~/types/api'
import { defineMockProviders } from '~/mocks/define'

/**
 * Travel contributions to foundation endpoints (owned by slice A2). Add `workflows`, `inbox`,
 * `search`, `myDay` (upcoming) and `counts` as the slice is built.
 */
const o = (value: string, label: string, tone: EnumOption['tone'] = null): EnumOption => ({
  value,
  label,
  tone,
  description: null,
})

export default defineMockProviders({
  enums: {
    travelKind: [o('car', 'Car or van'), o('train', 'Train'), o('flight', 'Flight')],
    travelStatus: [
      o('pending_approval', 'Awaiting approval', 'waiting'),
      o('to_book', 'To book', 'moving'),
      o('booked', 'Booked', 'positive'),
      o('declined', 'Declined', 'negative'),
      o('booking_impossible', 'Booking impossible', 'blocked'),
      o('cancellation_requested', 'Cancellation requested', 'waiting'),
      o('cancelled', 'Cancelled', 'neutral'),
    ],
    // SPEC §6.3 labels
    approvalReason: [
      o('vehicle_class_upgrade', 'Vehicle class above standard'),
      o('car_estate', 'Estate car'),
      o('car_automatic_preferred', 'Automatic transmission (preferred)'),
      o('car_automatic_required', 'Automatic transmission (guaranteed)'),
      o('car_diesel', 'Diesel engine'),
      o('car_foreign_travel', 'Foreign travel'),
      o('car_delivery', 'Delivery to an address'),
      o('car_collection', 'Collection from an address'),
      o('train_saver_fare', 'Saver fare (non-refundable)'),
      o('train_separate_tickets', 'Separate tickets per traveller'),
      o('flight', 'Flights always need approval'),
    ],
    approvalExemption: [o('executive_traveller', 'Executive travellers approve their own trips')],
    vehicleType: [o('car', 'Car'), o('van', 'Van')],
    handoverMode: [o('branch', 'At a branch'), o('delivery', 'Delivered to an address')],
    dropOffMode: [o('branch', 'At a branch'), o('collection', 'Collected from an address')],
    tripType: [o('one_way', 'One way'), o('return', 'Return')],
    fareType: [o('flex', 'Flex fare'), o('saver', 'Saver fare')],
  },
  jobs: [
    {
      name: 'travel.high-priority-digest',
      description: 'Emails the travel desk a digest of trips that start within 3 days.',
      slice: 'A2',
      cron: '30 7 * * 1-5',
      run: () => ({ requests: 0 }),
    },
  ],
})
