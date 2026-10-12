# Atrium frontend conventions

This is the rulebook for everyone working in this repo, including the parallel slice agents.
When this document and the code disagree, the code wins. Fix the document in the same change.

- [1. Ownership: what a slice may touch](#1-ownership-what-a-slice-may-touch)
- [2. Layout](#2-layout)
- [3. Module system](#3-module-system)
- [4. Navigation, auth and role guards](#4-navigation-auth-and-role-guards)
- [5. API client and Vue Query](#5-api-client-and-vue-query)
- [6. Forms (vee-validate + zod)](#6-forms-vee-validate--zod)
- [7. Mocks and demo mode](#7-mocks-and-demo-mode)
- [8. Testing](#8-testing)
- [9. UI, styling and content](#9-ui-styling-and-content)
- [10. Tooling and commits](#10-tooling-and-commits)
- [11. Decisions log](#11-decisions-log)

## 1. Ownership: what a slice may touch

A slice owns exactly these paths:

| Slice                   | Module folders                      | Pages                                                         |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------- |
| A1 Training             | `app/modules/training/**`           | `app/pages/training/**`                                       |
| A2 Travel               | `app/modules/travel/**`             | `app/pages/travel/**`                                         |
| A3 Assets               | `app/modules/assets/**`             | `app/pages/assets/**`                                         |
| A4 People / News / Home | `app/modules/{people,news,home}/**` | `app/pages/{people,news}/**` and `app/pages/index.vue` (home) |

Tests: `test/unit/<module>-*.spec.ts`, `test/nuxt/<module>-*.spec.ts` and `test/e2e/<module>*.spec.ts`.

**Everything else is foundation-owned:** `nuxt.config.ts`, `package.json`, the lockfile,
`app/lib/**`, `app/mocks/*.ts` and `app/mocks/core/**`, `app/types/**`, `app/components/**`
(UI kit), `app/layouts/**`, `app/middleware/**`, `app/plugins/**`, `app/stores/**` and
`app/composables/**`.

- **Never add dependencies.** The foundation already installed everything the spec needs (see
  `package.json`). If something is missing, it is a shared-file request.
- **Shared-file requests** (a new role, a shared type, a UI-kit component, a helper in `app/lib`)
  go into your final report. Never edit those files yourself.
- Modules must not import each other. ESLint enforces this, and it covers type imports too.
  Share through `~/lib`, `~/types`, the API schema, or global components.

## 2. Layout

```
app/
  app.vue, assets/css/main.css         root component, Tailwind entry (tokens in phase 2b)
  components/                          UI kit (phase 2b), auto-registered without prefix
  composables/                         useApi, useNavigation, useDemoMode (auto-imported)
  layouts/  middleware/  plugins/      shell, auth.global + roles.global, demo/vue-query/api
  lib/
    api/                               openapi-fetch client, unwrap(), ApiError, schema.d.ts (generated)
    query/keys.ts                      createQueryKeys(), SUMMARY_KEY
    navigation.ts, cn.ts               nav helpers, class merge helper
  mocks/                               MSW + in-browser mock database (demo mode, tests)
    core/                              users/personas seed + auth handlers
  modules/<module>/                    feature modules, one per slice (see section 3)
  pages/                               file-based routes; pages/<module>/** belong to the module
  stores/auth.ts                       session store (useAuthStore)
  types/                               shared types (auth, api envelope, navigation, page meta)
  utils/                               auto-imported helpers (safeRedirect)
scripts/                               api:types generator + placeholder OpenAPI document
test/unit  test/nuxt  test/e2e         Vitest (node), Vitest (Nuxt runtime), Playwright
```

Path aliases: `~/` and `@/` both point to `app/`.

## 3. Module system

Each feature is a folder in `app/modules/<module>/`. Everything in it is discovered with globs,
so adding or changing a module never touches shared files.

| File / folder                                                                                 | Purpose                                                                       | Discovered by                                              |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `nav.ts`                                                                                      | `export default defineNavEntries([...])`                                      | `useNavigation()` (glob)                                   |
| `api.ts`                                                                                      | Query keys and Vue Query composables for the module's endpoints               | imported by the module's pages/components                  |
| `components/`                                                                                 | Components, auto-registered with the module prefix                            | `nuxt.config.ts` (`components.dirs`, generated per module) |
| `mocks/handlers.ts`                                                                           | `export default defineMockHandlers(({ api }) => [...])`                       | `app/mocks/handlers.ts` (glob)                             |
| `mocks/seed.ts`                                                                               | `export default defineMockSeed({ run(ctx) {...} })` plus the collection types | `app/mocks/seeding.ts` (glob)                              |
| optional: `types.ts`, `schemas.ts` (zod, shared by forms and mocks), `composables/`, `utils/` | module-internal                                                               | explicit imports                                           |

**Component naming.** `app/modules/training/components/StatusChip.vue` becomes
`<TrainingStatusChip>`, and `components/request/Form.vue` becomes `<TrainingRequestForm>`.
Do not repeat the prefix in the file name.

**Pages.** Pages use Nuxt file routing under `app/pages/<module>/`, for example
`app/pages/training/requests/[id].vue`. Keep pages thin: they compose module components and the
composables from `api.ts`.

**Auto-imports.** Only foundation code is auto-imported: Vue, Nuxt, VueUse, Pinia stores,
`app/composables`, `app/utils`, plus `useQuery`, `useQueries`, `useMutation`, `useQueryClient`,
`keepPreviousData`, `useForm`, `useField`, `useFieldArray` and `toTypedSchema`. Module code is
not auto-imported. Import it explicitly, either as `~/modules/training/api` (allowed inside the
same module) or with a relative path.

## 4. Navigation, auth and role guards

```ts
// app/modules/training/nav.ts
import { ClipboardCheck, GraduationCap } from '@lucide/vue'
import { defineNavEntries } from '~/lib/navigation'

export default defineNavEntries([
  { id: 'training', label: 'Training', to: '/training', icon: GraduationCap, order: 20 },
  {
    id: 'training.back-office',
    label: 'Training office',
    to: '/training/back-office',
    icon: ClipboardCheck,
    section: 'admin',
    roles: ['training_admin'],
    badge: () => useTrainingQueueCount(), // optional; returns a ref/getter of a number
  },
])
```

- `roles` means the user needs any one of the listed roles. If `roles` is omitted, every
  signed-in user sees the entry. Children are filtered the same way.
- `order`: home is 0, then training 20, travel 30, assets 40, people 50, news 60. Use values
  within your module's band.
- `badge` runs inside the shell component's setup. Put the count query under `summaryKey(...)`
  (see section 5) so it refreshes after any mutation.

**Pages:**

```ts
definePageMeta({ roles: ['training_admin'] }) // users with any of these roles, else /forbidden
definePageMeta({ public: true }) // no sign-in required (login only)
```

- Every page is private by default. `auth.global.ts` redirects to `/login?redirect=<path>`.
- `roles.global.ts` runs after `auth.global.ts` (alphabetical order). Parent route meta is merged
  into child routes.
- Role guards exist only for the user experience. The API enforces authorization, and the UI
  shows actions according to `availableActions` (section 7), never according to roles.
- In components, use `useAuthStore()`: `user`, `roles`, `hasRole('manager')`,
  `hasAnyRole([...])`, `logout()`.

## 5. API client and Vue Query

**Client.** `useApi()` returns the openapi-fetch client typed from `app/lib/api/schema.d.ts`.
Wrap every call in `unwrap()`. It returns the data, or throws an `ApiError` normalised from
problem+json:

```ts
import { unwrap, isApiError, type Schema } from '~/lib/api'

const api = useApi() // call synchronously in setup or at the top of a composable
const me = await unwrap(api.GET('/me'))
const created = await unwrap(api.POST('/training/requests', { body }))
```

- `ApiError` has `status`, `title`, `detail`, `type`, `fieldErrors` and `body`, plus
  `isValidationError`, `isNetworkError` (status 0) and `fieldError(path)`. `fieldErrors` keys use
  vee-validate paths (`attendees[0].email`).
- The plugin injects the bearer token. On a 401 for an authenticated request, the session is
  cleared and the user is redirected to `/login?redirect=...`.
- Base URL: `runtimeConfig.public.apiBase` (`NUXT_PUBLIC_API_BASE`, default
  `http://localhost:3100/api/v1`). Demo mode uses `/api/v1`.
- Types: `pnpm api:types` regenerates `schema.d.ts` from `../atrium-backend-demo/openapi.json`
  by default, or from `pnpm api:types -- <path-or-url>`, or from `ATRIUM_OPENAPI`. Never edit
  `schema.d.ts` by hand. `Schema<'TrainingRequest'>` names a component schema.

**Query keys.** Create one factory per resource in the module's `api.ts`. Every key starts with
the module name:

```ts
// app/modules/training/api.ts
import { unwrap } from '~/lib/api'
import { createQueryKeys } from '~/lib/query/keys'
import type { ListQuery } from '~/types/api'

export const trainingRequestKeys = createQueryKeys('training', 'requests')
// .module ['training'] · .all ['training','requests'] · .list(params) · .detail(id) · .scope(...)

export function useTrainingRequests(params: MaybeRefOrGetter<ListQuery>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => trainingRequestKeys.list(toValue(params))),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/training/requests', { params: { query: toValue(params) }, signal })),
    placeholderData: keepPreviousData, // no flicker while paging
  })
}

export function useApproveAttendee() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; comment?: string }) =>
      unwrap(
        api.POST('/training/attendees/{id}/approve', {
          params: { path: { id: input.id } },
          body: { comment: input.comment },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trainingRequestKeys.module }),
  })
}
```

- **Invalidation:** after a mutation, invalidate the module root (`keys.module`) or a narrower
  key you know is affected. Use `setQueryData` only for the record you just received.
- **Cross-module data** (home dashboard widgets, nav badges, queue counts) uses
  `summaryKey('training', 'queues')`. Any successful mutation anywhere invalidates every
  `['summary', ...]` query automatically, so slices never invalidate each other's keys.
- **Defaults** (`app/plugins/10.vue-query.ts`): `staleTime` 30 s, no retry on 4xx (two retries
  otherwise), no refetch on window focus, mutations never retry.
- Show loading, empty and error states for every query. In phase 2b the UI kit provides
  components for them.

**List conventions** (placeholder until API.md is final, see section 11). Requests take
`?page=1&pageSize=20&sort=-createdAt,title&q=text&status=a,b`. Responses use
`Paginated<T> = { data: T[], meta: { page, pageSize, total, totalPages } }` (`~/types/api`).

## 6. Forms (vee-validate + zod)

- Use zod 4 schemas wrapped in `toTypedSchema()` (auto-imported) with `useForm`. Keep the schema
  in the module's `schemas.ts` so the mock handler validates with the same rules (section 7).
- Map server validation errors back onto the form:

```ts
const { handleSubmit, setErrors } = useForm({ validationSchema: toTypedSchema(requestSchema) })
const create = useCreateTrainingRequest()

const onSubmit = handleSubmit(async (values) => {
  try {
    await create.mutateAsync(values)
  } catch (error) {
    if (isApiError(error) && error.isValidationError) setErrors(error.fieldErrors)
    else throw error // let the page-level error UI / toast handle it
  }
})
```

- Multi-step wizards share one `useForm` across the steps. Validate a step with
  `validateField` or a per-step schema before moving on.
- Use `useFieldArray` for repeating groups (attendees, travellers).
- Labels, help text and error text are in English and written for users. Never show a raw
  `error.message`.
- `@vee-validate/zod` 4.15 declares a zod 3 peer dependency, but it works with zod 4 (verified,
  and the peer warning is silenced in `pnpm-workspace.yaml`). If `toTypedSchema` ever
  misbehaves, `useForm({ validationSchema: zodSchema })` also works, because vee-validate accepts
  Standard Schema.

## 7. Mocks and demo mode

With `NUXT_PUBLIC_DEMO_MODE=true` (`pnpm dev:demo`, `pnpm build:demo`), the client plugin
`00.demo-mode.client.ts` starts the MSW worker before the app mounts. MSW answers every API
request from an in-browser database (`app/mocks/db.ts`). The database is seeded
deterministically and persisted to `localStorage` (`atrium.demo-db.v<N>`). The mocks are code
behaviour: they emulate the real API's rules, status codes and problem responses, not just its
happy path.

**1. Declare your collections** in `mocks/seed.ts` by augmenting `MockCollections`. Prefix
collection names with the module name. Records must be JSON-serialisable, so store dates as ISO
strings.

```ts
// app/modules/training/mocks/seed.ts
import { addDays } from 'date-fns'
import { defineMockSeed } from '~/mocks/define'
import type { TrainingRequestRecord } from '../types'

declare module '~/mocks/db' {
  interface MockCollections {
    trainingRequests: TrainingRequestRecord
  }
}

export default defineMockSeed({
  order: 100,
  run({ db, faker, refDate, uuid }) {
    const employees = db.users.where((user) => user.roles.includes('employee'))
    for (let index = 0; index < 25; index++) {
      db.trainingRequests.insert({
        id: uuid(),
        title: faker.helpers.arrayElement(['Excel advanced', 'Project management basics']),
        createdById: faker.helpers.arrayElement(employees).id,
        startsAt: addDays(refDate, faker.number.int({ min: -60, max: 90 })).toISOString(),
        status: 'pending_manager_approval',
      })
    }
  },
})
```

Seed rules:

- Use only `faker`, `uuid()` and `refDate` from the context, never `Math.random()` or
  `Date.now()`. That keeps the data deterministic: the same seed and reference date always give
  the same data, and adding another module does not change yours.
- A seed may import only `~/mocks/define` at runtime (type imports are fine). Use `ctx.db`, not
  `import { db }`. ESLint enforces this to prevent an import cycle.
- Core users and personas are seeded first (`db.users`; personas have `persona !== null`). The
  persona ids are fixed (`00000000-0000-4000-8000-00000000000N`).
- Make the data tell a story. Each persona should find something in every relevant state:
  pending approvals, items to book, overdue ratings, and so on.

**2. Write handlers** in `mocks/handlers.ts`:

```ts
// app/modules/training/mocks/handlers.ts
import { http } from 'msw'
import { db } from '~/mocks/db'
import { defineMockHandlers } from '~/mocks/define'
import { created, findOr404, ok, readJson, requireRole, requireUser } from '~/mocks/http'
import { listResponse } from '~/mocks/list'
import { createRequestSchema } from '../schemas'
import { attendeeWorkflow } from './workflow'

export default defineMockHandlers(({ api }) => [
  http.get(api('/training/requests'), ({ request }) => {
    const user = requireUser(request) // 401 problem if not signed in
    const mine = db.trainingRequests.where((row) => row.createdById === user.id)
    return listResponse(mine, request, {
      search: ['title'],
      filters: { status: 'status' },
      sort: ['title', 'startsAt', 'createdAt'],
      defaultSort: '-createdAt',
    })
  }),

  http.post(api('/training/requests'), async ({ request }) => {
    const user = requireUser(request)
    const input = await readJson(request, createRequestSchema) // 422 problem with field errors
    return created(db.trainingRequests.insert({ ...input, createdById: user.id, status: 'open' }))
  }),

  http.post(api('/training/attendees/:id/approve'), ({ request, params }) => {
    const user = requireUser(request)
    const attendee = findOr404(db.trainingAttendees, params.id, 'Attendee') // 404 problem
    const status = attendeeWorkflow.transition(attendee, 'approve', user) // 409 / 403 problem
    const updated = db.trainingAttendees.update(attendee.id, { status })!
    return ok({ ...updated, availableActions: attendeeWorkflow.availableActions(updated, user) })
  }),

  http.get(api('/training/back-office/queue'), ({ request }) => {
    requireRole(request, 'training_admin') // 403 problem for everyone else
    // ...
  }),
])
```

Helpers (`~/mocks/http`, `~/mocks/list`, `~/mocks/workflow`):

| Helper                                                                                 | Behaviour                                                                                |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ok`, `created`, `noContent`                                                           | JSON 200 / 201, empty 204                                                                |
| `problem(status, { title, detail, type, errors })`                                     | RFC 9457 `application/problem+json`                                                      |
| `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `validationProblem` | Shortcuts that return a Response. `throw` them to stop a resolver early.                 |
| `readJson(request, zodSchema?)`                                                        | Parses the body and throws a 422 with field errors on invalid input                      |
| `requireUser(request)`, `requireRole(request, ...roles)`, `currentUser(request)`       | Demo bearer-token auth                                                                   |
| `findOr404(collection, id, label)`                                                     | Returns the record or throws a 404                                                       |
| `listResult` / `listResponse(items, request, options)`                                 | Filter, search, sort (an unknown sort field is a 400) and paginate into `Paginated<T>`   |
| `defineMockWorkflow<Entity>()({ action: { from, to, guard } })`                        | `availableActions(entity, user)`, `can(...)`, `transition(...)`, which throws 409 or 403 |

**`availableActions` and transitions.** The real API returns `availableActions: string[]` on
every workflow record, computed from status, role, ownership and deputies. The UI shows only
buttons for those actions. Mocks emulate this with `defineMockWorkflow`. Keep one workflow per
entity in `mocks/workflow.ts`, add `availableActions` to every detail and list item you return,
and run every action endpoint through `workflow.transition(...)`. When a transition has side
effects (audit trail entries, notifications, cascading status changes), write them to the mock
database too, so the UI shows the same follow-up state as the real backend.

Other behaviour to know about:

- **Latency:** every API request is delayed by 100–400 ms (MSW's "realistic" delay), so loading
  states are visible. Tests run without latency.
- **Unmocked endpoints** return a 501 problem titled "Not mocked", so gaps are obvious instead of
  silently going to the network.
- **Reset:** the shell calls `useDemoMode().reset()`. In the browser console, use
  `window.__atriumDemo.reset()`, `.db.users.all()` or `.export()`.
- Persisted data is reseeded automatically when the set of seed modules changes. Bump
  `DEMO_DB_VERSION` in `app/mocks/db.ts` (foundation) for incompatible shape changes. During
  development, clear the data with the reset action.

## 8. Testing

| Kind         | Where                 | Environment                                   | Use it for                                                            |
| ------------ | --------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| Unit         | `test/unit/*.spec.ts` | Node, `~` alias, no auto-imports              | Pure logic, mock handlers and workflows, the API client against mocks |
| Nuxt runtime | `test/nuxt/*.spec.ts` | `@nuxt/test-utils` + happy-dom                | Components (`mountSuspended`), composables, stores, plugins           |
| E2E          | `test/e2e/*.spec.ts`  | Playwright + Chromium against `pnpm dev:demo` | User journeys per persona                                             |

- **API against mocks** (`test/unit/api-client-mocks.spec.ts` is the reference): create a
  server with `createMockServer()` from `~/mocks/node`, which uses the same handlers as demo mode
  without latency. Call `resetDemoData({ refDate: new Date('2026-10-01T00:00:00Z') })` in
  `beforeEach` so results are deterministic.
- **Components:** use `mountSuspended(Component, { props })` from `@nuxt/test-utils/runtime`.
  Query elements by role or label text.
- **E2E:** sign in through the persona buttons on `/login`. Every Playwright test gets a fresh
  browser context, so the demo database is freshly seeded. Prefer `getByRole` and `getByLabel`.
  Use `data-testid` only where no accessible name exists. Name e2e files `<module>-<flow>.spec.ts`.
- To run e2e against a static build: `pnpm build:demo`, then
  `npx serve -s .output/public -l 4173`, then `PLAYWRIGHT_BASE_URL=http://localhost:4173 pnpm test:e2e`.
- `pnpm typecheck` also checks `test/unit`, `test/nuxt`, `test/e2e` and the tool configs.

## 9. UI, styling and content

- Tailwind CSS v4 (`@tailwindcss/vite`). Design tokens and fonts arrive in phase 2b in
  `app/assets/css/main.css` from `_spec/atrium/tokens.css`. Use the token-backed utilities, never
  hard-coded colours.
- Build screens from the UI kit in `app/components/` (phase 2b, built on Reka UI). Use raw
  `reka-ui` primitives in a module only when the kit has nothing that fits, and then also report
  it as a kit request.
- Variants: `cva` from `class-variance-authority`. Merge classes with `cn()` from `~/lib/cn`.
- Icons: `@lucide/vue` (named imports, `class="size-4"`, `aria-hidden="true"` when decorative).
- Dates: `date-fns`. Charts: `chart.js` + `vue-chartjs`. Rich text: `@tiptap/vue-3` for editing,
  and `dompurify` before rendering any HTML with `v-html`. Never render unsanitised HTML.
- Content: English UI. Use only the fictional universe from `_spec/WORKSPACE.md`. Emails and URLs
  use `example.com`. No real company, person or place names.
- Accessibility: every control has a label, and focus is visible and managed in dialogs. Do not
  use colour as the only signal for a status.

## 10. Tooling and commits

- pnpm only. Node 22.12 or newer (CI uses Node 24 from `.node-version`).
- `pnpm lint` runs ESLint (`@nuxt/eslint` flat config + `eslint-config-prettier`) and
  `prettier --check`. `pnpm lint:fix` fixes both.
- Before you hand off, run `pnpm lint && pnpm typecheck && pnpm test`, and run `pnpm test:e2e`
  for UI flows.
- Use Conventional Commits (`feat(training): ...`, `fix(mocks): ...`, `test(travel): ...`). End
  each commit message with the co-author line the orchestrator gives you.
- Line endings are LF (`.gitattributes`, `.editorconfig`).

## 11. Decisions log

| Date       | Decision                                                                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-13 | MSW pinned to **v2** (2.15) as specified. MSW 3.0 shipped two weeks earlier; evaluate it in a later phase.                                                                                                                         |
| 2026-10-13 | **TypeScript 5.9** instead of 7.0: `openapi-typescript` 7 requires TS 5, and the native TS 7 compiler is not yet a safe base for `vue-tsc`.                                                                                        |
| 2026-10-13 | Icons come from **`@lucide/vue`**. `lucide-vue-next` 1.0 is deprecated in favour of it, with the same icon names.                                                                                                                  |
| 2026-10-13 | **zod 4** with `@vee-validate/zod` 4.15 (it declares a zod 3 peer, but it works; verified). See section 6.                                                                                                                         |
| 2026-10-13 | `@tanstack/vue-query` is excluded from Vite pre-bundling. Nuxt's resolver otherwise loads `@vue/devtools-api` v6 as CommonJS in dev. Only `@tanstack/query-core` is pre-bundled.                                                   |
| 2026-10-13 | The list envelope (`Paginated<T>`), list query parameters, role names and auth endpoints are **placeholders** until `_spec/atrium/API.md` is final. Phase 2b aligns `~/types/*`, `scripts/openapi.placeholder.json` and the mocks. |
| 2026-10-13 | Global middleware is ordered alphabetically: `auth.global.ts`, then `roles.global.ts`.                                                                                                                                             |
| 2026-10-13 | Node 23 (local) prints an "unsupported" warning from the Nuxt CLI, but everything works. CI and Vercel use Node 24.                                                                                                                |
| 2026-10-13 | Vitest `fsModuleCache` is off for the `nuxt` project: Vitest 5's persistent transform cache breaks the virtual app entry of `@nuxt/test-utils` on warm runs.                                                                       |
