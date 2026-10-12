/** Demo-mode status and the "reset demo data" action (for the shell / settings UI). */
export function useDemoMode() {
  const config = useRuntimeConfig()
  const queryClient = useQueryClient()
  const enabled = computed(() => Boolean(config.public.demoMode))

  async function reset(): Promise<void> {
    if (!enabled.value) return
    const { resetDemoData } = await import('~/mocks/db')
    resetDemoData()
    await queryClient.resetQueries()
  }

  return { enabled, reset }
}
