/** A same-app path ("/inbox?x=1"), never "//host", "/\host" or "javascript:…". */
export function isInternalPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\')
  )
}

/** Only allow same-app paths as post-login redirect targets (no open redirects). */
export function safeRedirect(value: unknown, fallback = '/'): string {
  const target = Array.isArray(value) ? value[0] : value
  if (!isInternalPath(target)) return fallback
  if (target.startsWith('/login')) return fallback
  return target
}

/**
 * Links that come from the API (inbox items, notifications, search hits) are frontend routes;
 * anything else falls back to `fallback` so API data can never navigate off-site.
 */
export function internalLink(value: unknown, fallback = '/'): string {
  return isInternalPath(value) ? value : fallback
}
