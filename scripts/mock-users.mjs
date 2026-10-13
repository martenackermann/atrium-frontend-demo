#!/usr/bin/env node
/**
 * Writes app/mocks/core/users.json — the core org (4 sites, 6 departments, 9 cost centres and the
 * 52 demo users with fixed UUIDs; SPEC §2, §10.1, SPEC_RESOLUTIONS #5) — from the backend's export.
 *
 *   pnpm mocks:users            # reads ../_spec/atrium/users.json (backend `pnpm seed:export-users`)
 *   pnpm mocks:users -- <path>  # a specific export
 *
 * The mock DB then uses exactly the backend's ids, handles, names and reporting lines, so a link
 * or id copied between the MSW demo and the real API points at the same person.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'app/mocks/core/users.json')
const source =
  process.argv.slice(2).find((arg) => arg !== '--') ?? resolve(root, '../_spec/atrium/users.json')

if (!existsSync(source)) {
  console.error(`[mocks:users] export not found: ${source}`)
  process.exit(1)
}

const raw = JSON.parse(readFileSync(source, 'utf8'))
const code = (value) => (typeof value === 'object' && value ? value.code : value) ?? null

const org = {
  description:
    'Core demo org, copied from the backend export by `pnpm mocks:users`. Do not edit by hand.',
  sites: raw.sites.map(({ id, code: siteCode, name }) => ({ id, code: siteCode, name })),
  departments: raw.departments.map(({ id, code: deptCode, name, headId }) => ({
    id,
    code: deptCode,
    name,
    headId: headId ?? null,
  })),
  costCenters: raw.costCenters.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    departmentId: row.departmentId ?? null,
    active: row.active !== false,
  })),
  users: raw.users.map((user) => ({
    id: user.id,
    handle: user.handle,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    jobTitle: user.jobTitle ?? null,
    employeeNumber: user.employeeNumber,
    phone: user.phone ?? null,
    departmentCode: user.departmentCode ?? code(user.department),
    siteCode: user.siteCode ?? code(user.site),
    costCenterCode: user.costCenterCode ?? code(user.costCenter),
    managerId: user.managerId ?? null,
    isSiteManager: Boolean(user.isSiteManager),
    active: user.active !== false,
    roles:
      user.assignedRoles ??
      (user.roles ?? []).filter((role) => role !== 'employee' && role !== 'manager'),
    personaKey: user.personaKey ?? null,
  })),
}

const problems = []
if (org.users.length !== 52) problems.push(`expected 52 users, got ${org.users.length}`)
for (const user of org.users) {
  if (!user.email.endsWith('@example.com'))
    problems.push(`${user.handle}: email must use example.com`)
  if (!user.handle) problems.push(`${user.id}: missing handle`)
}
if (problems.length) {
  console.error(`[mocks:users] ${problems.join('; ')}`)
  process.exit(1)
}

writeFileSync(output, `${JSON.stringify(org, null, 2)}\n`)
console.log(
  `[mocks:users] wrote ${org.users.length} users to app/mocks/core/users.json from ${source}`,
)
