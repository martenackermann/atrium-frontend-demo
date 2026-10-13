export type DemoMode = 'msw' | 'api' | 'off'

/**
 * NUXT_PUBLIC_DEMO_MODE (SPEC §9): 'msw' = fully in-browser demo, 'api' = real backend in demo
 * mode, anything else = off. `true` (legacy) is treated as 'msw'.
 */
export function demoModeOf(value: unknown): DemoMode {
  if (value === true || value === 'true' || value === 'msw') return 'msw'
  if (value === 'api') return 'api'
  return 'off'
}
