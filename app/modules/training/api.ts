import { createQueryKeys } from '~/lib/query/keys'

/**
 * Training API layer (owned by slice A1): query keys + Vue Query composables.
 * See CONVENTIONS.md "API client & Vue Query".
 */
export const trainingKeys = createQueryKeys('training', 'requests')
