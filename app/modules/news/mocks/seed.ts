import { defineMockSeed } from '~/mocks/define'

/**
 * News demo data (owned by slice A4). Declare this module's collections by augmenting
 * MockCollections, then insert records via ctx.db:
 *
 *   declare module '~/mocks/db' {
 *     interface MockCollections { newsExample: NewsExampleRecord }
 *   }
 *
 * Use only ctx.faker / ctx.uuid / ctx.refDate (no Math.random, no Date.now) to stay deterministic,
 * and import nothing at runtime from ~/mocks/db or ~/mocks/http here (import cycle).
 */
export default defineMockSeed({
  order: 100,
  run() {},
})
