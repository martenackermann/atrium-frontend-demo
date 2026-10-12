import { setupWorker } from 'msw/browser'
import { buildMockHandlers } from './handlers'

export interface StartMockWorkerOptions {
  apiBase: string
  /** Nuxt app.baseURL (the worker script lives at `${baseURL}mockServiceWorker.js`). */
  baseURL?: string
}

/** Start the MSW service worker. Resolves once it controls the page (await before app mount). */
export async function startMockWorker({ apiBase, baseURL = '/' }: StartMockWorkerOptions) {
  const worker = setupWorker(...buildMockHandlers(apiBase))
  await worker.start({
    serviceWorker: { url: `${baseURL.replace(/\/?$/, '/')}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
    quiet: !import.meta.dev,
  })
  return worker
}
