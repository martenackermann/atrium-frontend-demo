import { demoModeOf } from '~/lib/demo'

/**
 * Demo mode "msw" (NUXT_PUBLIC_DEMO_MODE=msw): start the MSW service worker BEFORE the app mounts,
 * so every API call — including the initial session check — is answered by the in-browser mocks.
 * The mock code is dynamically imported, so it is not in the bundle when demo mode is off.
 */
export default defineNuxtPlugin({
  name: 'atrium:demo-mode',
  enforce: 'pre',
  async setup() {
    const config = useRuntimeConfig()
    if (demoModeOf(config.public.demoMode) !== 'msw') return

    const [{ startMockWorker }, mockDb] = await Promise.all([
      import('~/mocks/browser'),
      import('~/mocks/db'),
    ])
    await startMockWorker({ apiBase: String(config.public.apiBase), baseURL: config.app.baseURL })

    // Debug/e2e hook: window.__atriumDemo.reset()
    window.__atriumDemo = {
      db: mockDb.db,
      reset: mockDb.resetDemoData,
      export: mockDb.exportDemoData,
    }
  },
})
