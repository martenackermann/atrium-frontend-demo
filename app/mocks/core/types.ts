import type { Role } from '~/types/auth'

/** Employee record in the mock database (superset of what /me exposes). */
export interface MockUser {
  id: string
  email: string
  firstName: string
  lastName: string
  displayName: string
  jobTitle: string | null
  department: string | null
  costCenter: string | null
  location: string | null
  managerId: string | null
  roles: Role[]
  active: boolean
  /** Set for the demo personas listed on the login screen. */
  persona: { description: string; order: number } | null
}
