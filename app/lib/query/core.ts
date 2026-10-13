import { summaryKey } from './keys'

/**
 * Query keys for foundation (core) endpoints. Keys under ['summary', …] are refreshed after every
 * successful mutation (inbox, counts, notifications — SCREENS.md §10).
 */
export const coreKeys = {
  all: ['core'] as const,
  me: ['core', 'me'] as const,
  personas: ['core', 'personas'] as const,
  users: (params: object = {}) => ['core', 'users', 'list', params] as const,
  user: (id: string) => ['core', 'users', 'detail', id] as const,
  approvers: (userId: string) => ['core', 'users', 'approvers', userId] as const,
  departments: ['core', 'org', 'departments'] as const,
  sites: ['core', 'org', 'sites'] as const,
  costCenters: ['core', 'org', 'cost-centers'] as const,
  enums: ['core', 'meta', 'enums'] as const,
  config: ['core', 'meta', 'config'] as const,
  workflows: ['core', 'meta', 'workflows'] as const,
  workflow: (name: string) => ['core', 'meta', 'workflows', name] as const,
  deputies: ['core', 'deputies'] as const,
  search: (q: string) => ['core', 'search', q] as const,
  attachment: (id: string) => ['core', 'attachments', id] as const,
  audit: (params: object = {}) => ['core', 'audit', params] as const,
  adminUsers: (params: object = {}) => ['core', 'admin', 'users', 'list', params] as const,
  adminUser: (id: string) => ['core', 'admin', 'users', 'detail', id] as const,
  jobs: ['core', 'admin', 'jobs'] as const,
  jobRuns: (name: string, params: object = {}) => ['core', 'admin', 'jobs', name, params] as const,
  // refreshed after any mutation:
  inbox: (params: object = {}) => summaryKey('inbox', 'list', params),
  inboxCounts: summaryKey('inbox', 'counts'),
  notifications: (params: object = {}) => summaryKey('notifications', params),
}
