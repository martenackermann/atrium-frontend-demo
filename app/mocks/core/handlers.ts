/**
 * Core auth handlers: login, personas, current user.
 * PLACEHOLDER (phase 2a) — phase 2b completes them against _spec/atrium/API.md.
 */
import { http } from 'msw'
import { z } from 'zod'
import type { CurrentUser, LoginResult, Persona } from '~/types/auth'
import { defineMockHandlers } from '../define'
import { db } from '../db'
import {
  DEMO_PASSWORD,
  issueDemoToken,
  noContent,
  ok,
  problem,
  readJson,
  requireUser,
} from '../http'
import type { MockUser } from './types'

const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

export function toCurrentUser(user: MockUser): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    jobTitle: user.jobTitle,
    department: user.department,
    costCenter: user.costCenter,
    managerId: user.managerId,
    roles: user.roles,
  }
}

export default defineMockHandlers(({ api }) => [
  http.get(api('/auth/personas'), () => {
    const personas: Persona[] = db.users
      .where((user) => user.persona !== null && user.active)
      .sort((a, b) => (a.persona?.order ?? 0) - (b.persona?.order ?? 0))
      .map((user) => ({
        email: user.email,
        displayName: user.displayName,
        description: user.persona?.description ?? '',
        roles: user.roles,
      }))
    return ok(personas)
  }),

  http.post(api('/auth/login'), async ({ request }) => {
    const credentials = await readJson(request, loginSchema)
    const user = db.users.first(
      (candidate) => candidate.email.toLowerCase() === credentials.email.toLowerCase(),
    )
    if (!user || !user.active || credentials.password !== DEMO_PASSWORD) {
      return problem(401, {
        title: 'Sign-in failed',
        detail: 'Email or password is incorrect.',
        type: 'invalid-credentials',
      })
    }
    const result: LoginResult = { accessToken: issueDemoToken(user), user: toCurrentUser(user) }
    return ok(result)
  }),

  http.post(api('/auth/logout'), () => noContent()),

  http.get(api('/me'), ({ request }) => ok(toCurrentUser(requireUser(request)))),
])
