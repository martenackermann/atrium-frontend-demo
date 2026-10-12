import { isApiError, unwrap } from '~/lib/api'
import type { CurrentUser, LoginCredentials, Role } from '~/types/auth'

export const AUTH_TOKEN_STORAGE_KEY = 'atrium.auth.token'

/**
 * Session state: bearer token (persisted in localStorage) + current user (/me).
 * PLACEHOLDER-COMPLETE (phase 2a): phase 2b adapts it to the final auth contract in API.md.
 */
export const useAuthStore = defineStore('auth', () => {
  const nuxtApp = useNuxtApp()

  const token = useLocalStorage(AUTH_TOKEN_STORAGE_KEY, '')
  const user = ref<CurrentUser | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value && user.value))
  const roles = computed<Role[]>(() => user.value?.roles ?? [])

  function hasRole(role: Role): boolean {
    return roles.value.includes(role)
  }

  /** True when `required` is empty/undefined or the user has ANY of the roles. */
  function hasAnyRole(required: readonly Role[] | undefined): boolean {
    return !required?.length || required.some((role) => roles.value.includes(role))
  }

  function clearSession(): void {
    token.value = ''
    user.value = null
  }

  let pending: Promise<boolean> | null = null

  /** Resolve the session from the stored token (loads /me once). Never throws. */
  function ensureSession(): Promise<boolean> {
    if (!token.value) return Promise.resolve(false)
    if (user.value) return Promise.resolve(true)
    pending ??= (async () => {
      try {
        user.value = await unwrap(nuxtApp.$api.GET('/me'))
        return true
      } catch (error) {
        if (isApiError(error) && error.status === 401) clearSession()
        return false
      } finally {
        pending = null
      }
    })()
    return pending
  }

  async function login(credentials: LoginCredentials): Promise<CurrentUser> {
    const result = await unwrap(nuxtApp.$api.POST('/auth/login', { body: credentials }))
    token.value = result.accessToken
    user.value = result.user
    return result.user
  }

  async function logout(): Promise<void> {
    clearSession()
    nuxtApp.$queryClient.clear()
    await nuxtApp.runWithContext(() => navigateTo('/login'))
  }

  return {
    token,
    user,
    isAuthenticated,
    roles,
    hasRole,
    hasAnyRole,
    ensureSession,
    login,
    logout,
    clearSession,
  }
})
