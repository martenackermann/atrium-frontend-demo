/**
 * News body allowlist for the mock API (SPEC §4.6: `p h2 h3 ul ol li strong em a[href=https|mailto]
 * blockquote code pre br`, links get rel + target). The backend uses sanitize-html; the mock keeps
 * a small dependency-free equivalent so the offline demo stores what the API would store. Pages
 * still render through DOMPurify (defence in depth).
 */
const ALLOWED = new Set([
  'p',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'a',
  'blockquote',
  'code',
  'pre',
  'br',
])
const RENAME: Record<string, string> = {
  b: 'strong',
  i: 'em',
  h1: 'h2',
  h4: 'h3',
  h5: 'h3',
  h6: 'h3',
}
const DROP_WITH_CONTENT =
  /<(script|style|iframe|object|noscript|textarea|template)\b[\s\S]*?<\/\1\s*>/gi

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export function sanitizeNewsHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(DROP_WITH_CONTENT, '')
    .replace(
      /<\s*(\/?)\s*([a-zA-Z0-9]+)([^>]*)>/g,
      (_match, slash: string, rawName: string, attrs: string) => {
        const name = RENAME[rawName.toLowerCase()] ?? rawName.toLowerCase()
        if (!ALLOWED.has(name)) return ''
        if (slash) return name === 'br' ? '' : `</${name}>`
        if (name === 'br') return '<br />'
        if (name !== 'a') return `<${name}>`
        const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs)
        const value = (href?.[2] ?? href?.[3] ?? href?.[4] ?? '').trim()
        return /^(https:\/\/|mailto:)/i.test(value)
          ? `<a href="${escapeAttr(value)}" rel="noopener noreferrer" target="_blank">`
          : '<a>'
      },
    )
    .replace(/<a>([\s\S]*?)<\/a>/g, '$1')
    .trim()
}

export function hasText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim().length > 0
}
