/**
 * Global middleware run in file-name order: 01.auth → 02.access.
 *
 * Pages are private unless they declare definePageMeta({ public: true }).
 * No token (or an expired one) → /login?redirect=<path> (SCREENS §1.1).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  const signedIn = await auth.ensureSession()

  if (to.meta.public) {
    if (signedIn && to.path === '/login') return navigateTo(safeRedirect(to.query.redirect))
    return
  }

  if (!signedIn) {
    return navigateTo({
      path: '/login',
      query: to.fullPath === '/' ? {} : { redirect: to.fullPath },
    })
  }
})
