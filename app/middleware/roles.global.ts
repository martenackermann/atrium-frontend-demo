/**
 * Role guard: definePageMeta({ roles: ['training_admin'] }) lets in users with ANY listed role.
 * Route meta is merged parent -> child, so a parent route's roles also protect its children.
 * This is UX only — the API enforces authorization server-side.
 */
export default defineNuxtRouteMiddleware((to) => {
  const required = to.meta.roles
  if (!required?.length || to.meta.public) return

  const auth = useAuthStore()
  if (!auth.hasAnyRole(required)) {
    return navigateTo({ path: '/forbidden', query: { from: to.fullPath } }, { replace: true })
  }
})
