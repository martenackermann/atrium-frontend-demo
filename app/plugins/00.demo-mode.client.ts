/**
 * Demo mode (NUXT_PUBLIC_DEMO_MODE=true): start the MSW service worker BEFORE the app mounts, so
 * every API call — including the initial session check — is answered by the in-browser mocks.
 * The mock code is dynamically imported, so it is not part of the bundle when demo mode is off.
 */
export default defineNuxtPlugin({
  name: 'atrium:demo-mode',
  enforce: 'pre',
  async setup() {
    const config = useRuntimeConfig()
    if (!config.public.demoMode) return

    const [{ startMockWorker }, mockDb] = await Promise.all([
      import('~/mocks/browser'),
      import('~/mocks/db'),
    ])
    await startMockWorker({ apiBase: config.public.apiBase, baseURL: config.app.baseURL })

    // Debug/e2e hook: window.__atriumDemo.reset()
    window.__atriumDemo = {
      db: mockDb.db,
      reset: mockDb.resetDemoData,
      export: mockDb.exportDemoData,
    }
  },
})
