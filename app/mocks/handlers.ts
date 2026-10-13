import { delay, http, type RequestHandler } from 'msw'
import coreHandlers, { coreFallbackHandlers } from './core/handlers'
import type { MockContext, MockHandlersFactory } from './define'
import { problem } from './http'

/** Every app/modules/<module>/mocks/handlers.ts (glob index — no per-slice edits). */
const moduleHandlerFiles = import.meta.glob<{ default: MockHandlersFactory }>(
  '~/modules/*/mocks/handlers.ts',
  { eager: true },
)

export function createMockContext(apiBase: string): MockContext {
  const base = apiBase.replace(/\/+$/, '')
  return { api: (path) => `${base}${path.startsWith('/') ? path : `/${path}`}` }
}

export interface BuildHandlersOptions {
  /** Simulated network latency. 'realistic' (default) = MSW's random 100-400 ms; 0 disables. */
  latency?: 'realistic' | number
}

/**
 * Handler order: latency passthrough → core → modules (alphabetical) → core fallbacks (zero queue
 * counts) → 501 catch-all. The catch-all turns any API call without a mock into a visible
 * problem response.
 */
export function buildMockHandlers(
  apiBase: string,
  options: BuildHandlersOptions = {},
): RequestHandler[] {
  const context = createMockContext(apiBase)
  const latency = options.latency ?? 'realistic'
  const moduleHandlers = Object.keys(moduleHandlerFiles)
    .sort()
    .flatMap((path) => moduleHandlerFiles[path]?.default?.(context) ?? [])

  return [
    ...(latency === 0
      ? []
      : [
          http.all(context.api('/*'), async () => {
            await delay(latency === 'realistic' ? undefined : latency)
          }),
        ]),
    ...coreHandlers(context),
    ...moduleHandlers,
    ...coreFallbackHandlers(context),
    http.all(context.api('/*'), ({ request }) =>
      problem(501, {
        code: 'internal_error',
        title: 'Not mocked',
        detail: `${request.method} ${new URL(request.url).pathname} has no mock handler yet.`,
      }),
    ),
  ]
}
