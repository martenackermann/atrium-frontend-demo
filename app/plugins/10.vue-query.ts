import { MutationCache, QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { isApiError } from '~/lib/api'
import { SUMMARY_KEY } from '~/lib/query/keys'

/** Never retry client errors (4xx); retry network/server errors up to twice. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false
  return failureCount < 2
}

export default defineNuxtPlugin({
  name: 'atrium:vue-query',
  setup(nuxtApp) {
    const queryClient: QueryClient = new QueryClient({
      mutationCache: new MutationCache({
        // Dashboard widgets, nav badges and queue counts live under ['summary', ...]; any
        // successful mutation may change them, so refresh them globally.
        onSuccess: () => queryClient.invalidateQueries({ queryKey: SUMMARY_KEY }),
      }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          gcTime: 5 * 60_000,
          retry: shouldRetry,
          refetchOnWindowFocus: false,
        },
        mutations: {
          retry: false,
        },
      },
    })

    nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })

    return { provide: { queryClient } }
  },
})
