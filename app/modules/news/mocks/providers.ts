import type { EnumOption, SearchHit } from '~/types/api'
import { db } from '~/mocks/db'
import { defineMockProviders } from '~/mocks/define'
import { toLink, toSummary } from './dto'
import { newsWorkflow, publishAndExpire } from './workflow'

/**
 * News contributions to foundation endpoints (slice A4): the workflow diagram, enums, ⌘K search
 * (published posts by title), the Home "My day" fragments (3 latest published posts, pinned
 * first, and the active links) and the `news.publish-and-expire` job.
 */
const o = (value: string, label: string, tone: EnumOption['tone'] = null): EnumOption => ({
  value,
  label,
  tone,
  description: null,
})
const TYPE_LABELS = { changelog: 'Changelog', update: 'Update', information: 'Information' }

export default defineMockProviders({
  workflows: [newsWorkflow],
  enums: {
    newsType: [o('changelog', 'Changelog'), o('update', 'Update'), o('information', 'Information')],
    newsStatus: [
      o('draft', 'Draft', 'neutral'),
      o('scheduled', 'Scheduled', 'moving'),
      o('published', 'Published', 'positive'),
      o('archived', 'Archived', 'neutral'),
    ],
  },

  search: (_user, q) => {
    const term = q.trim().toLowerCase()
    return db.newsPosts
      .where(
        (row) =>
          !row.deletedAt && row.status === 'published' && row.title.toLowerCase().includes(term),
      )
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      .slice(0, 5)
      .map((row): SearchHit => ({
        module: 'news',
        type: 'news_post',
        id: row.id,
        reference: null,
        title: row.title,
        subtitle: `${TYPE_LABELS[row.type]} · ${row.summary.slice(0, 80)}`,
        link: `/news/${row.id}`,
      }))
  },

  myDay: (user) => ({
    news: db.newsPosts
      .where((row) => !row.deletedAt && row.status === 'published')
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
      )
      .slice(0, 3)
      .map((row) => toSummary(row, user)),
    links: db.usefulLinks
      .where((row) => row.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toLink),
  }),

  jobs: [
    {
      name: 'news.publish-and-expire',
      description: 'Publishes scheduled news posts that are due and archives expired ones.',
      slice: 'A4',
      cron: '*/5 * * * *',
      run: ({ now }) => publishAndExpire(now),
    },
  ],
})
