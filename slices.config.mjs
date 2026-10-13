// @ts-check
/**
 * Slice ownership (SPEC §12, SCREENS.md headings): the feature module and the page files each
 * slice owns. ESLint uses it for import isolation; CONVENTIONS.md lists the same mapping.
 * Paths are relative to the repository root; a folder means everything below it.
 *
 * @type {Record<string, { slice: string, pages: string[] }>}
 */
export const sliceModules = {
  training: { slice: 'A1', pages: ['app/pages/training', 'app/pages/back-office/training'] },
  travel: { slice: 'A2', pages: ['app/pages/travel', 'app/pages/back-office/travel'] },
  assets: { slice: 'A3', pages: ['app/pages/assets', 'app/pages/back-office/assets'] },
  people: { slice: 'A4', pages: ['app/pages/people-requests', 'app/pages/back-office/people'] },
  news: {
    slice: 'A4',
    pages: ['app/pages/news', 'app/pages/back-office/news', 'app/pages/back-office/links.vue'],
  },
  home: { slice: 'A4', pages: ['app/pages/index.vue'] },
}

/**
 * Glob(s) for a page entry: a `.vue` file stays as is, a folder becomes `<folder>/**`.
 * @param {string} path
 */
export const pageGlobs = (path) => (path.endsWith('.vue') ? [path] : [`${path}/**/*.{ts,vue}`])
