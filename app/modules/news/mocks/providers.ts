import type { EnumOption } from '~/types/api'
import { defineMockProviders } from '~/mocks/define'

/**
 * News contributions to foundation endpoints (owned by slice A4). Add `workflows`, `search` and
 * `myDay` (news, links) as the slice is built.
 */
const o = (value: string, label: string, tone: EnumOption['tone'] = null): EnumOption => ({
  value,
  label,
  tone,
  description: null,
})

export default defineMockProviders({
  enums: {
    newsType: [o('changelog', 'Changelog'), o('update', 'Update'), o('information', 'Information')],
    newsStatus: [
      o('draft', 'Draft', 'neutral'),
      o('scheduled', 'Scheduled', 'moving'),
      o('published', 'Published', 'positive'),
      o('archived', 'Archived', 'neutral'),
    ],
  },
  jobs: [
    {
      name: 'news.publish-and-expire',
      description: 'Publishes scheduled posts and archives expired ones.',
      slice: 'A4',
      cron: '*/5 * * * *',
      run: () => ({ published: 0, archived: 0 }),
    },
  ],
})
