import { describeError, isApiError } from '~/lib/api'
import { hasAccess, hasRole, type AccessRule } from '~/lib/access'
import type { LoginRequest, LoginResponse, Me, PersonaKey, RoleName } from '~/types/api'

export const AUTH_TOKEN_STORAGE_KEY = 'atrium.auth.token'
export const AUTH_EXPIRES_STORAGE_KEY = 'atrium.auth.expires'

/**
 * Session: bearer token (localStorage) + the current user (`GET /me`).
 * There is no refresh token (SPEC §13.4): an expired token or any 401 ends the session.
 */
export const useAuthStore = defineStore('auth', () => {
  const nuxtApp = useNuxtApp()

  const token = useLocalStorage(AUTH_TOKEN_STORAGE_KEY, '')
  const expiresAt = useLocalStorage(AUTH_EXPIRES_STORAGE_KEY, '')
  const me = ref<Me | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value && me.value))
  const roles = computed<RoleName[]>(() => me.value?.roles ?? [])

  function is(role: RoleName): boolean {
    return me.value ? hasRole(me.value, role) : false
  }

  /** ANY-of access rules (roles, 'deputy', 'approver'). */
  function can(rules?: readonly AccessRule[] | null): boolean {
    return hasAccess(me.value, rules)
  }

  function setSession(response: LoginResponse) {
    token.value = response.accessToken
    expiresAt.value = response.expiresAt
    me.value = response.user
  }

  function clearSession() {
    token.value = ''
    expiresAt.value = ''
    me.value = null
  }

  function isExpired() {
    if (!expiresAt.value) return false
    const time = Date.parse(expiresAt.value)
    return Number.isFinite(time) && time <= Date.now()
  }

  let pending: Promise<boolean> | null = null

  /** Resolve the session from the stored token (loads /me once). Never throws. */
  function ensureSession(): Promise<boolean> {
    if (!token.value) return Promise.resolve(false)
    if (isExpired()) {
      clearSession()
      return Promise.resolve(false)
    }
    if (me.value) return Promise.resolve(true)
    pending ??= (async () => {
      try {
        me.value = await nuxtApp.$api.get<Me>('/me')
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

  async function refreshMe(): Promise<void> {
    me.value = await nuxtApp.$api.get<Me>('/me')
  }

  async function login(credentials: LoginRequest): Promise<Me> {
    const response = await nuxtApp.$api.post<LoginResponse>('/auth/login', credentials)
    nuxtApp.$queryClient.clear()
    setSession(response)
    return response.user
  }

  async function demoLogin(personaKey: PersonaKey): Promise<Me> {
    const response = await nuxtApp.$api.post<LoginResponse>('/auth/demo-login', { personaKey })
    nuxtApp.$queryClient.clear()
    setSession(response)
    return response.user
  }

  /** Persona switcher (SCREENS §1.5): new token, cleared cache, Home, toast. */
  async function switchPersona(personaKey: PersonaKey): Promise<void> {
    const toast = useToast()
    try {
      const user = await demoLogin(personaKey)
      await nuxtApp.runWithContext(() => navigateTo('/'))
      toast.success(`You're now ${user.displayName}`)
    } catch (error) {
      toast.error(describeError(error))
    }
  }

  async function logout(): Promise<void> {
    if (token.value) {
      await nuxtApp.$api.post('/auth/logout').catch(() => undefined)
    }
    clearSession()
    nuxtApp.$queryClient.clear()
    await nuxtApp.runWithContext(() => navigateTo('/login'))
  }

  return {
    token,
    expiresAt,
    me,
    isAuthenticated,
    roles,
    is,
    can,
    setSession,
    clearSession,
    ensureSession,
    refreshMe,
    login,
    demoLogin,
    switchPersona,
    logout,
  }
})
