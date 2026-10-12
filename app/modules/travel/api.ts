import { createQueryKeys } from '~/lib/query/keys'

/**
 * Travel API layer (owned by slice A2): query keys + Vue Query composables.
 * See CONVENTIONS.md "API client & Vue Query".
 */
export const travelKeys = createQueryKeys('travel', 'requests')
