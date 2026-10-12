/** Only allow same-app paths as post-login redirect targets (no open redirects). */
export function safeRedirect(value: unknown, fallback = '/'): string {
  const target = Array.isArray(value) ? value[0] : value
  if (typeof target !== 'string') return fallback
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\'))
    return fallback
  if (target.startsWith('/login')) return fallback
  return target
}
