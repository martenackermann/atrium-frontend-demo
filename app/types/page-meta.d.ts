import type { Role } from './auth'

/**
 * definePageMeta({ roles: ['training_admin'] }) -> the global roles middleware only lets users
 * with ANY of these roles in. definePageMeta({ public: true }) -> no sign-in required.
 */
declare module '#app' {
  interface PageMeta {
    roles?: Role[]
    public?: boolean
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    roles?: Role[]
    public?: boolean
  }
}

export {}
