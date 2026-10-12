import { createQueryKeys } from '~/lib/query/keys'

/**
 * People API layer (owned by slice A4): query keys + Vue Query composables.
 * See CONVENTIONS.md "API client & Vue Query".
 */
export const peopleKeys = createQueryKeys('people', 'requests')
