import type { EnumOption } from '~/types/api'
import { defineMockProviders } from '~/mocks/define'

/**
 * Training contributions to foundation endpoints (owned by slice A1). Add `workflows`
 * (defineMockWorkflow), `inbox`, `search`, `myDay` (upcoming) and `counts` as the slice is built.
 * Until `counts` exists, /training/queues/counts answers zeros.
 */
const o = (value: string | number, label: string, tone: EnumOption['tone'] = null): EnumOption => ({
  value,
  label,
  tone,
  description: null,
})

export default defineMockProviders({
  enums: {
    trainingFormat: [o('in_person', 'In person'), o('online', 'Online'), o('hybrid', 'Hybrid')],
    attendeeStatus: [
      o('pending_manager_approval', 'Awaiting manager', 'waiting'),
      o('pending_executive_approval', 'Awaiting executive', 'waiting'),
      o('to_book', 'To book', 'moving'),
      o('booked', 'Booked', 'positive'),
      o('declined', 'Declined', 'negative'),
      o('booking_impossible', 'Booking impossible', 'blocked'),
      o('cancellation_requested', 'Cancellation requested', 'waiting'),
      o('cancelled', 'Cancelled', 'neutral'),
      o('attended', 'Attended', 'positive'),
      o('not_attended', 'Did not attend', 'neutral'),
    ],
    billingStatus: [
      o('open', 'Open', 'waiting'),
      o('invoice_received', 'Invoice received', 'positive'),
      o('free_of_charge', 'Free of charge', 'neutral'),
    ],
    ratingState: [
      o('upcoming', 'Upcoming', 'neutral'),
      o('due', 'Due', 'waiting'),
      o('overdue', 'Overdue', 'negative'),
      o('submitted', 'Submitted', 'positive'),
    ],
    likert: [
      o('A', 'Fully agree'),
      o('B', 'Mostly agree'),
      o('C', 'Partly agree'),
      o('D', 'Disagree'),
    ],
    improvement: [
      o(1, 'Clearly visible'),
      o(2, 'Visible'),
      o(3, 'Barely visible'),
      o(4, 'Not visible'),
    ],
  },
  jobs: [
    {
      name: 'training.rating-reminders',
      description: 'Reminds raters whose feedback rounds are due, every 7 days up to 4 times.',
      slice: 'A1',
      cron: '15 7 * * *',
      // SPEC_RESOLUTIONS #10: off in demo mode; "Run now" demonstrates it.
      enabled: false,
      run: () => ({ loop1: 0, loop2: 0, loop3: 0, skippedMax: 0 }),
    },
    {
      name: 'training.goals-reminders',
      description: 'Reminds attendees to set learning goals a week before a booked training.',
      slice: 'A1',
      cron: '20 7 * * *',
      enabled: false,
      run: () => ({ reminded: 0 }),
    },
  ],
})
