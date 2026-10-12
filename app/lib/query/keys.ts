/**
 * Query-key factory. Every key starts with the module name, so a module can invalidate everything
 * it owns with `queryClient.invalidateQueries({ queryKey: keys.module })`.
 *
 * @example
 * export const trainingRequestKeys = createQueryKeys('training', 'requests')
 * trainingRequestKeys.list({ page: 1 }) // ['training', 'requests', 'list', { page: 1 }]
 * trainingRequestKeys.detail(id)        // ['training', 'requests', 'detail', id]
 */
export function createQueryKeys<const M extends string, const R extends string>(
  module: M,
  resource: R,
) {
  const all = [module, resource] as const
  return {
    /** [module] — invalidates every query of the module. */
    module: [module] as const,
    /** [module, resource] — invalidates every query of this resource. */
    all,
    lists: () => [...all, 'list'] as const,
    list: <P extends object>(params?: P) => [...all, 'list', params ?? {}] as const,
    details: () => [...all, 'detail'] as const,
    detail: (id: string) => [...all, 'detail', id] as const,
    /** Free-form sub key: keys.scope('counts') -> [module, resource, 'counts']. */
    scope: <const S extends readonly unknown[]>(...parts: S) => [...all, ...parts] as const,
  }
}

/**
 * Cross-module aggregates (dashboard widgets, navigation badges, queue counts) use keys that
 * start with SUMMARY_KEY. They are invalidated automatically after ANY successful mutation
 * (see app/plugins/10.vue-query.ts), so slices never need to know about each other.
 */
export const SUMMARY_KEY = ['summary'] as const

export function summaryKey<const S extends readonly unknown[]>(...parts: S) {
  return [...SUMMARY_KEY, ...parts] as const
}
