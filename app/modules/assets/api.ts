import { createQueryKeys } from '~/lib/query/keys'

/**
 * Assets API layer (owned by slice A3): query keys + Vue Query composables.
 * See CONVENTIONS.md "API client & Vue Query".
 */
export const assetsKeys = createQueryKeys('assets', 'assets')
