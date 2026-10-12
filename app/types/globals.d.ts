import type { DemoDbSnapshot, MockDb, ResetOptions } from '~/mocks/db'

declare global {
  interface Window {
    /** Present in demo mode only (debugging and e2e tests). */
    __atriumDemo?: {
      db: MockDb
      reset: (options?: ResetOptions) => DemoDbSnapshot
      export: () => DemoDbSnapshot
    }
  }
}

export {}
