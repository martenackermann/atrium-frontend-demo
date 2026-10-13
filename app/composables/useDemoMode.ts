import { demoModeOf } from '~/lib/demo'

/**
 * Demo mode: 'msw' (fully in-browser), 'api' (backend in demo mode) or 'off'.
 * `reset()` reseeds the in-browser data (MSW only) and refetches everything.
 */
export function useDemoMode() {
  const config = useRuntimeConfig()
  const queryClient = useQueryClient()
  const mode = computed(() => demoModeOf(config.public.demoMode))
  const enabled = computed(() => mode.value !== 'off')
  const isMsw = computed(() => mode.value === 'msw')
  const mailpitUrl = computed(() => (isMsw.value ? '' : String(config.public.mailpitUrl ?? '')))

  async function reset(): Promise<void> {
    if (!isMsw.value) return
    const { resetDemoData } = await import('~/mocks/db')
    resetDemoData()
    await queryClient.resetQueries()
  }

  return { mode, enabled, isMsw, mailpitUrl, reset }
}
