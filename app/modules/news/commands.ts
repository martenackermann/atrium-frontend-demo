import { Newspaper } from '@lucide/vue'
import { BACK_OFFICE } from '~/lib/access'
import { defineCommands } from '~/lib/registry'

/** ⌘K commands (SCREENS §1.3), owned by slice A4. */
export default defineCommands([
  {
    id: 'news.new',
    group: 'create',
    label: 'New news post',
    icon: Newspaper,
    to: '/back-office/news/new',
    keywords: ['announcement', 'post', 'changelog'],
    access: BACK_OFFICE.news,
    order: 80,
  },
])
