import { createQueryKeys } from '~/lib/query/keys'

/**
 * News + links API layer (owned by slice A4): query keys + Vue Query composables.
 * See CONVENTIONS.md "How to build a slice" → API.
 */
export const newsKeys = {
  posts: createQueryKeys('news', 'posts'),
  links: createQueryKeys('news', 'links'),
}
