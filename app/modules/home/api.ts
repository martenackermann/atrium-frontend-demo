import { createQueryKeys } from '~/lib/query/keys'

/**
 * Home API layer (owned by slice A4): query keys + Vue Query composables.
 * See CONVENTIONS.md "API client & Vue Query".
 */
export const homeKeys = createQueryKeys('home', 'dashboard')
