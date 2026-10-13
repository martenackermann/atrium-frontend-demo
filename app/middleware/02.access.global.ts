/**
 * Access guard: definePageMeta({ access: ['training_office', 'it_admin'] }) lets in users matching
 * ANY rule (roles, 'deputy', 'approver' — see ~/lib/access). Failing it renders the 403 view
 * (SCREENS §1.1). Route meta is merged parent → child. UX only: the API enforces permissions.
 */
export default defineNuxtRouteMiddleware((to) => {
  const rules = to.meta.access
  if (!rules?.length || to.meta.public) return

  const auth = useAuthStore()
  if (!auth.can(rules)) {
    return abortNavigation(
      createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: "You don't have access to this page.",
        fatal: false,
      }),
    )
  }
})
