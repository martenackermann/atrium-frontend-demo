import { defineMockSeed } from '~/mocks/define'

/**
 * Assets demo data (owned by slice A3) — SPEC §10 story records first, then filler.
 * Declare this module's collections by augmenting MockCollections, then insert via ctx.db:
 *
 *   declare module '~/mocks/db' {
 *     interface MockCollections { assetsExample: AssetsExampleRecord }
 *   }
 *
 * Dates: ctx.d(n) / ctx.at(n, hh, mm) / ctx.weekday(n) (relative to today). Randomness: ctx.faker /
 * ctx.uuid only. Users: USER_IDS + SEED_USERS from ~/mocks/core/seed; approvers via
 * resolveApprover(ctx.db, …) from ~/mocks/core/org; audit rows via recordAudit(ctx.db, …).
 * Never import ~/mocks/db or ~/mocks/http at runtime here (import cycle; ESLint enforces it).
 */
export default defineMockSeed({
  order: 100,
  run() {},
})
