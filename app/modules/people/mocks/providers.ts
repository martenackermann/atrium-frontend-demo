import type { EnumOption } from '~/types/api'
import { defineMockProviders } from '~/mocks/define'

/**
 * People-request contributions to foundation endpoints (owned by slice A4). Add `workflows`,
 * `inbox` (people.reply_required / people.triage_required), `search` and `counts`.
 */
const o = (value: string, label: string, tone: EnumOption['tone'] = null): EnumOption => ({
  value,
  label,
  tone,
  description: null,
})

export default defineMockProviders({
  enums: {
    peopleRequestType: [
      o('onboarding', 'Onboarding'),
      o('offboarding', 'Offboarding'),
      o('role_change', 'Role or access change'),
    ],
    peopleRequestStatus: [
      o('open', 'Open', 'waiting'),
      o('in_progress', 'In progress', 'moving'),
      o('waiting_internal', 'Waiting (internal)', 'waiting'),
      o('waiting_on_requester', 'Waiting on requester', 'waiting'),
      o('reopened', 'Reopened', 'moving'),
      o('completed', 'Completed', 'positive'),
      o('rejected', 'Rejected', 'negative'),
      o('cancelled', 'Cancelled', 'neutral'),
    ],
    priority: [
      o('critical', 'Critical', 'negative'),
      o('high', 'High', 'moving'),
      o('normal', 'Normal', 'neutral'),
      o('low', 'Low', 'neutral'),
    ],
    salutation: [o('mr', 'Mr'), o('ms', 'Ms'), o('mx', 'Mx')],
  },
})
