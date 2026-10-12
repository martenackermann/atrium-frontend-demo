import { createQueryKeys } from '~/lib/query/keys'

/**
 * News API layer (owned by slice A4): query keys + Vue Query composables.
 * See CONVENTIONS.md "API client & Vue Query".
 */
export const newsKeys = createQueryKeys('news', 'articles')
