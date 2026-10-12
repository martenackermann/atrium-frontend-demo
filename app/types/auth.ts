import type { Schema } from '~/lib/api/types'

/**
 * Auth/session types. They are aliases of the generated OpenAPI schema (app/lib/api/schema.d.ts),
 * so the API contract stays the single source of truth.
 *
 * TODO(2b): re-point the aliases at the final schema names from _spec/atrium/API.md.
 */
export type Role = Schema<'Role'>
export type CurrentUser = Schema<'CurrentUser'>
/** Demo personas offered on the login screen (demo password: demo1234). */
export type Persona = Schema<'Persona'>
export type LoginCredentials = Schema<'LoginRequest'>
export type LoginResult = Schema<'LoginResponse'>

/** Runtime list of roles (mocks, pickers). Must match the Role enum of the API. */
export const ROLES = [
  'employee',
  'manager',
  'executive',
  'it_admin',
  'training_admin',
  'travel_admin',
  'asset_admin',
  'people_admin',
  'news_editor',
] as const satisfies readonly Role[]
