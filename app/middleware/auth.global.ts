/**
 * Runs first (global middleware run alphabetically: auth -> roles).
 * Pages are private unless they declare definePageMeta({ public: true }).
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
