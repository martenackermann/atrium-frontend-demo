import type { EnumOption } from '~/types/api'
import { defineMockProviders } from '~/mocks/define'

/**
 * Asset contributions to foundation endpoints (owned by slice A3). Add `workflows`, `inbox`
 * (assets.acceptance_required), `search`, `myDay` (assets) and `counts` as the slice is built.
 */
const o = (value: string, label: string, tone: EnumOption['tone'] = null): EnumOption => ({
  value,
  label,
  tone,
  description: null,
})

export default defineMockProviders({
  enums: {
    assetStatus: [
      o('in_stock', 'In stock', 'neutral'),
      o('pending_acceptance', 'Awaiting acceptance', 'waiting'),
      o('in_use', 'In use', 'positive'),
      o('in_repair', 'In repair', 'blocked'),
      o('scrapped', 'Scrapped', 'neutral'),
    ],
    returnCondition: [o('ok', 'OK'), o('damaged', 'Damaged')],
  },
  jobs: [
    {
      name: 'assets.cost-center-sync',
      description: "Copies each assigned user's cost centre onto their devices.",
      slice: 'A3',
      cron: '0 2 * * *',
      run: () => ({ updated: 0 }),
    },
    {
      name: 'assets.acceptance-reminders',
      description: 'Reminds users who have not accepted an assigned device.',
      slice: 'A3',
      cron: '40 7 * * 1-5',
      run: () => ({ reminded: 0 }),
    },
  ],
})
