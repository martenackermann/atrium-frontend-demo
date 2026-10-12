import type { Pinia } from 'pinia'
import { createApiClient } from '~/lib/api'

/** Provides the typed API client as `$api` (use the useApi() composable). */
export default defineNuxtPlugin({
  name: 'atrium:api',
  dependsOn: ['atrium:vue-query'],
  setup(nuxtApp) {
    const config = useRuntimeConfig()
    const router = useRouter()
    // Instantiate the store here (inside the Nuxt context); its actions use $api lazily.
    const auth = useAuthStore(nuxtApp.$pinia as Pinia)

    const api = createApiClient({
      baseUrl: config.public.apiBase,
      getToken: () => auth.token,
      onUnauthorized: () => {
        auth.clearSession()
        const current = router.currentRoute.value
        if (current.meta.public) return
        void nuxtApp.runWithContext(() =>
          navigateTo({ path: '/login', query: { redirect: current.fullPath } }),
        )
      },
    })

    return { provide: { api } }
  },
})
