/**
 * Signed download URLs come from our own API (API.md §1 "Downloads"). Only follow http(s) URLs on
 * the API's origin or the app's own origin (MSW demo) — never `javascript:` or a foreign host.
 */
export function isSafeDownloadUrl(url: string, apiBase: string, appOrigin: string): boolean {
  try {
    const target = new URL(url, appOrigin)
    if (target.protocol !== 'https:' && target.protocol !== 'http:') return false
    const apiOrigin = new URL(apiBase, appOrigin).origin
    return target.origin === apiOrigin || target.origin === new URL(appOrigin).origin
  } catch {
    return false
  }
}
