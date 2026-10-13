# Atrium frontend conventions

The rulebook for everyone working in this repo, including the parallel slice agents (A1 training,
A2 travel, A3 assets, A4 home/people/news). When this document and the code disagree, the code
wins: fix the document in the same change.

**Spec precedence.** The spec lives in `../_spec/atrium/`: `SPEC.md`, `API.md`, `SCREENS.md`,
`DESIGN.md` (+ `tokens.css`, comps). **`SPEC_RESOLUTIONS.md` overrides SPEC/API/SCREENS where they
conflict** — read it first. DESIGN wins on appearance, SCREENS on behaviour.

1. [How to build a slice (recipe)](#1-how-to-build-a-slice-recipe)
2. [What a slice must never touch](#2-what-a-slice-must-never-touch)
3. [Layout of the repo](#3-layout-of-the-repo)
4. [API client, types and Vue Query](#4-api-client-types-and-vue-query)
5. [Pages: list, detail, approvals, stepper](#5-pages-list-detail-approvals-stepper)
6. [Forms (vee-validate + zod, 422 mapping)](#6-forms-vee-validate--zod-422-mapping)
7. [Status, workflow and routing components](#7-status-workflow-and-routing-components)
8. [Mocks and demo mode](#8-mocks-and-demo-mode)
9. [Navigation, access and the shell](#9-navigation-access-and-the-shell)
10. [UI kit reference](#10-ui-kit-reference)
11. [Styling and content](#11-styling-and-content)
12. [Testing](#12-testing)
13. [Tooling and commits](#13-tooling-and-commits)
14. [Decisions log](#14-decisions-log)

---

## 1. How to build a slice (recipe)

A slice owns one or more **modules** (`app/modules/<m>/`) and the **page files** listed in
`slices.config.mjs`. The foundation already created every file below as a stub or placeholder;
a slice **replaces their content** and adds files inside its own folders. It never edits foundation
files to plug in: badges, commands, mocks, seeds and providers are collected by glob.

| Slice | Modules                  | Pages                                                                                                                                                     |
| ----- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1    | `training`               | `pages/training/**`, `pages/back-office/training/**`                                                                                                      |
| A2    | `travel`                 | `pages/travel/**`, `pages/back-office/travel/**`                                                                                                          |
| A3    | `assets`                 | `pages/assets/**`, `pages/back-office/assets/**`                                                                                                          |
| A4    | `people`, `news`, `home` | `pages/index.vue`, `pages/people-requests/**`, `pages/back-office/people/**`, `pages/news/**`, `pages/back-office/news/**`, `pages/back-office/links.vue` |

### Files of a module

```
app/modules/<m>/
  api/types.ts          DTOs of this module, hand-written from API.md (SPEC_RESOLUTIONS #6)
  api/index.ts          query keys (createQueryKeys) + composables (useXxxList, useXxxDetail, useXxxCounts)
  components/           module components → auto-registered with the module prefix:
                        modules/travel/components/RouteCard.vue → <TravelRouteCard>
  badges.ts             nav badge sources (defineNavBadges) — registry, no shared file
  commands.ts           ⌘K / "New request" commands (defineCommands)
  constants.ts          (optional) ACTION_CONFIG for ActionBar, labels, step lists
  mocks/types.ts        (optional) record types; augment MockCollections
  mocks/seed.ts         demo data (defineMockSeed) — SPEC §10 story records first
  mocks/handlers.ts     MSW handlers for this module's endpoints (defineMockHandlers)
  mocks/providers.ts    workflows, enums, inbox, search, myDay, counts, jobs (defineMockProviders)
```

### Step by step

1. **Types** – write `api/types.ts` from API.md §4–§7 (request bodies, list items, detail DTOs
   with `availableActions`, `timeline`, `route`). Shared shapes come from `~/types/api`
   (`UserRef`, `Money`, `Page<T>`, `TimelineEntry`, `AttachmentDto`, `Decision`, …).
2. **API layer** – in `api/index.ts`, keys via `createQueryKeys('<m>', '<resource>')`, one
   composable per query. Counts use `summaryKey('<m>', 'counts')` so every mutation refreshes them.
3. **Mocks** – seed (`mocks/seed.ts`), handlers (`mocks/handlers.ts`), state machine with
   `defineMockWorkflow` (§8.3), providers (`mocks/providers.ts`). The app works in `pnpm dev:demo`
   with no backend; the same handlers run in Vitest.
4. **Pages** – replace the placeholders. Keep each file's `definePageMeta({ title, access })`
   (adjust `access` only if SCREENS says otherwise). Patterns in §5.
5. **Badges and commands** – fill `badges.ts` from `/<m>/queues/counts`; add commands.
6. **Inbox** – contribute `inbox` items in `providers.ts` (API.md §8) with `actionsPath` and
   `quickActions` (SPEC_RESOLUTIONS #4). The drawer, `/inbox` and the badge pick them up.
7. **Tests** – Vitest for workflow rules and mock API behaviour (pattern:
   `test/unit/mock-api.spec.ts`), Playwright for the main flows in `test/e2e/<m>.spec.ts`.
8. **Verify** – `pnpm lint && pnpm typecheck && pnpm test && pnpm build:demo && pnpm test:e2e`.

## 2. What a slice must never touch

Slices change only their modules, their page files, their tests (`test/**/<m>*.spec.ts`,
`test/e2e/<m>*.spec.ts`) and docs about their module. Everything else is foundation:

- `app/components/**` (the UI kit), `app/layouts/**`, `app/app.vue`, `app/error.vue`
- `app/lib/**`, `app/composables/**`, `app/stores/**`, `app/plugins/**`, `app/middleware/**`,
  `app/utils/**`, `app/types/**`, `app/config/**`, `app/assets/**`
- `app/mocks/*.ts` and `app/mocks/core/**` (including `users.json`)
- `nuxt.config.ts`, `package.json`, the lockfile, `eslint.config.mjs`, `slices.config.mjs`,
  `vitest.config.ts`, `playwright.config.ts`, CI, `vercel.json`
- other modules' folders and pages: ESLint forbids importing another module (even types)

Need something from the foundation (a kit change, a new shared type, a package)? Don't patch it
locally: build it inside your module and list the request in your final report.

## 3. Layout of the repo

```
app/
  assets/css/        tokens.css (DESIGN tokens, verbatim) + main.css (Tailwind v4 theme, base, motion)
  components/        UI kit, registered WITHOUT path prefix: ui/ form/ data/ workflow/ stepper/ app/
  composables/       useApi, useAuthStore (stores/), useListQuery, useStepper, useStepperDraft,
                     useWorkflowAction, useEnums/usePublicConfig/useWorkflowDefinition (useMeta),
                     useOrg, useToast, useConfirm, useTheme, useNavigation, useBreadcrumbTail, …
  config/navigation.ts   the SCREENS §1.2 navigation (ids are badge ids)
  lib/               framework-free logic: api/ (http, errors, upload, download), access, status,
                     list-query, stepper, registry, query keys, workflow layout
  mocks/             MSW + in-browser mock DB (core) — modules add theirs under modules/<m>/mocks
  modules/<m>/       slice code (see §1)
  pages/             file routes; placeholders show who owns them
  types/api/         shared API types (shared.ts, core.ts); module types live in the modules
```

## 4. API client, types and Vue Query

- **Client:** `const api = useApi()` → `api.get<T>(path, query?)`, `post`, `put`, `patch`,
  `delete`, `action<T>(resourcePath, action, body?)`, `upload`, `downloadUrl`, `openAttachment`.
  Paths are relative to `/api/v1`. Lists in queries are comma-joined; empty values are dropped.
- **Idempotency:** every POST carries an `Idempotency-Key` (fresh UUID). For a retried submit
  of the same form, pass a stable key: `api.post(path, body, { idempotencyKey })`.
- **Errors:** everything non-2xx throws `ApiError` (`status`, `code`, `title`, `detail`,
  `traceId`, `fieldErrors`, `fieldError(path)`, `isValidationError`). `describeError(error)` gives
  user-facing `{ title, detail }` (409 `invalid_transition` → "This request changed in the
  meantime"). 401 clears the session and goes to `/login?redirect=…`. 404 also means "not visible
  to you" (API.md) → show the 404 view.
- **Workflow actions:** `useWorkflowAction({ resourcePath, invalidate, messages })` → `run(action,
body)` posts `<resource>/actions/<action>`, toasts, invalidates, refetches on 409, rethrows 422.
- **Envelope:** lists are `Page<T> = { data, meta: { page, perPage, total, totalPages } }`.
- **Uploads:** staged — `<FileDrop v-model="attachments" purpose="travel_booking_confirmation" />`
  uploads on drop (`POST /attachments`), deletes on remove; send `attachmentIds` with the form.
  Downloads go through `api.openAttachment(attachment)` (signed URL, same-origin check).
- **Types:** `pnpm api:types` regenerates `app/lib/api/schema.d.ts` from
  `../atrium-backend-demo/openapi.json` (it strips the `/api/v1` prefix). Since the merge the
  export is complete (96 paths) and `schema.d.ts` is regenerated on main; the app still uses the
  hand-written DTOs (core in `~/types/api`, modules in `app/modules/<m>/api/types.ts`), which the
  slices wrote from API.md. Moving them to the generated types is a possible follow-up.
- **Query keys:** `createQueryKeys('travel', 'requests')` → `.all`, `.lists()`, `.list(params)`,
  `.detail(id)`. Module root `['travel']` invalidates everything of a module. Anything under
  `['summary']` (inbox, counts, my-day) is invalidated after **every** successful mutation.
- **Meta:** `useEnums().options('travelStatus')` / `.label(enum, value)`; `usePublicConfig()`
  (`/meta/config` limits); `useWorkflowDefinition('travel_request')`.

## 5. Pages: list, detail, approvals, stepper

Every page sets `definePageMeta({ title, access? })`. `title` feeds breadcrumbs, the document
title and the mobile top bar; detail pages name themselves with
`useBreadcrumbTail(() => detail.value?.reference)`.

**List (DataTable).** Filters, sort, search and page live in the URL.

```vue
<script setup lang="ts">
const list = useListQuery({
  filters: ['status', 'kind'],
  multi: ['status'],
  defaultSort: '-createdAt',
})
const query = useQuery({
  queryKey: computed(() => travelKeys.requests.list(list.apiQuery.value)),
  queryFn: ({ signal }) =>
    api.get<Page<TravelListItem>>('/travel/requests', list.apiQuery.value, { signal }),
  placeholderData: keepPreviousData,
})
const columns: DataTableColumn<TravelListItem>[] = [
  { key: 'reference', label: 'Reference', format: 'mono', required: true, mobile: 'title' },
  { key: 'status', label: 'Status', mobile: 'status' },
  { key: 'startsAt', label: 'Starts', sort: 'startsAt', value: (row) => formatDate(row.startsAt) },
]
</script>
<template>
  <PageBody wide>
    <PageHeader title="My trips"><template #actions>…</template></PageHeader>
    <DataTable
      :columns="columns"
      :rows="query.data.value?.data"
      :meta="query.data.value?.meta"
      :loading="query.isPending.value"
      :error="query.error.value"
      :list="list"
      noun="trips"
      :row-to="(row) => `/travel/requests/${row.id}`"
      export-path="/travel/requests/export"
      :empty="{
        title: 'No trips yet',
        description: 'Book a rental car, a train journey or a flight.',
      }"
      @retry="query.refetch()"
    >
      <template #filters><UiSelect … /></template>
      <template #cell-status="{ row }"
        ><StatusBadge
          enum="travelStatus"
          :value="row.status"
          :available-actions="row.availableActions"
      /></template>
    </DataTable>
  </PageBody>
</template>
```

Select filters can't use `''` as a value (Reka): use a sentinel such as `'any'` (see
`pages/admin/users/index.vue`).

**Detail.** `PageHeader` (title, `#meta` with type · mono reference · dates, `#status`,
`#actions` with `ActionBar`), then `RoutingSlip variant="full"`, facts (`FactGrid`), module
content, `FileList`, and `LifecycleTimeline :entries="detail.timeline"`. Errors: `ProblemAlert`;
a 404 → `throw createError({ statusCode: 404 })`.

**Approvals and queues (SplitInbox).**

```vue
<SplitInbox
  v-model:tab="tab"
  v-model:filter="filter"
  title="Approvals"
  :tabs="tabs"
  :items="items"
  :item-key="(item) => item.id"
  :item-label="(item) => item.title"
  :can-decide="(item) => item.availableActions.includes('approve')"
  :item-to="(item) => `/travel/requests/${item.id}`"
  :loading="…"
  :error="…"
  @approve="(item) => run(item, 'approve')"
  @decline="openDecline"
>
  <template #item="{ item, selected }">…row…</template>
  <template #detail-title="{ item }">…</template>
  <template #detail-meta="{ item }">…</template>
  <template #detail-actions="{ item }"><ActionBar … /></template>
  <template #detail="{ item }"><WhySeeing … /> <ReasonChips … /> <RoutingSlip … /></template>
</SplitInbox>
```

`?selected=<id>` is in the URL; J/K/↓/↑ move, A approves, D declines, Enter opens the full page,
Esc closes, `?` lists shortcuts. Use `WhySeeing` ("Why you're seeing this": approver, deputy,
manager chain) on every approval detail. Decline uses `ReasonDialog` (reason required).

**Stepper (StepperPage, focus mode).**

```vue
<script setup lang="ts">
definePageMeta({ layout: 'focus', title: 'Rent a car' })
const { values, validateField, setValues, handleSubmit, isSubmitting } = useForm({
  validationSchema: schema,
  initialValues,
})
const stepper = useStepper(
  () => [
    { id: 'trip', label: 'Trip' },
    { id: 'vehicle', label: 'Vehicle' },
    { id: 'return', label: 'Return', skip: values.tripType === 'one_way' },
    { id: 'review', label: 'Review' },
  ],
  {
    validate: async (id) =>
      (await Promise.all(STEP_FIELDS[id].map((field) => validateField(field)))).every(
        (r) => r.valid,
      ),
  },
)
const draft = useStepperDraft('travel-car', values, { version: 1 })
onMounted(() => {
  const saved = draft.restore()
  if (saved) setValues(saved)
})
</script>
<template>
  <StepperPage
    title="Rent a car"
    :stepper="stepper"
    close-to="/travel"
    :saved-at="draft.savedAt.value"
    :submitting="isSubmitting"
    :strip="{ title: 'Needs approval · 2 reasons', detail: '…' }"
    @submit="onSubmit"
    @discard="
      draft.clear()
      navigateTo('/travel')
    "
  >
    <StepperStep v-if="stepper.current.value?.id === 'trip'" question="Where are you going?"
      >…</StepperStep
    >
    <template #summary>
      <StepperSlip
        title="Car rental"
        :facts="facts"
        :reasons="previewReasons"
        :route="previewRoute"
        @select-reason="focusField"
      />
    </template>
  </StepperPage>
</template>
```

`reasons` comes from the server preview (`POST …/preview`, SPEC_RESOLUTIONS #3) — `null` while
loading, `[]` shows "No approval needed". Submitting clears the draft; closing keeps it.

## 6. Forms (vee-validate + zod, 422 mapping)

- Schema with zod 4, wrapped once: `const schema = toTypedSchema(z.object({ … }))`;
  `useForm({ validationSchema: schema })`; fields via `defineField('name')`. For non-primitive
  fields pass the value type: `defineField<'manager', UserRef | null>('manager')`.
- Wrap each control in `UiField label hint optional :error="errors.x"`; the control picks up
  `id`, `aria-describedby` and invalid state from the field context.
- Messages: say what to do ("Choose a return date after the pick-up date."), no "Invalid".
- **422 mapping:** the API returns `errors` keyed by dot paths (`legs.0.date`); `ApiError`
  converts them to vee-validate paths (`legs[0].date`). After a failed submit:

  ```ts
  catch (error) {
    if (isApiError(error) && error.isValidationError) { setErrors(error.fieldErrors); return }
    formError.value = describeError(error).detail ?? describeError(error).title
  }
  ```

  Rename keys when a form field differs from the API name (e.g. `managerId` → `manager`). Show
  errors for fields not on screen with `<ProblemAlert :error="error" :mapped="['title', …]" />`.

- Money is `Money` (integer cents, `<MoneyInput>`); dates are `IsoDate` (`UiDatePicker`,
  `UiDateRangePicker`), timestamps `IsoDateTime` (`UiDatePicker time`).

## 7. Status, workflow and routing components

- **StatusBadge** (SPEC_RESOLUTIONS #8): `<StatusBadge enum="travelStatus" :value="r.status"
:available-actions="r.availableActions" />`. Tones are DESIGN's seven: `neutral`, `waiting`,
  `you`, `moving`, `positive`, `negative`, `blocked`. When `availableActions` holds a decision
  action for the state, the viewer sees tone `you` and "Needs your approval" (or "Book it",
  "Rate it", …). `actor` forces it on/off. Label/tone come from `/meta/enums`, the icon from
  `STATUS_MAP` in `~/lib/status` (foundation; ask for additions).
- **ActionBar:** renders `availableActions` with a per-module config
  (`Record<action, ActionConfig>` — label, icon, `reason` dialog, `confirm`, `variant`, `kbd`).
  Actions without config (capabilities like `edit`) are skipped. Emits `run(action, body)`.
- **RoutingSlip** (`compact` in rows, `full` on details, `vertical` in slips): `RouteStop[]`
  built from the DTO's `route`.
- **LifecycleTimeline** for a record's `timeline`; **AuditTrail** for raw audit lists;
  **WorkflowDiagram** `name="travel_request" :current="status"` from `/meta/workflows/{name}`.
- **ReasonChips** (`pill` or `lines`), **PriorityFlag** (`high`, `starts-at`, `due-at`),
  **PersonaCard**, **WhySeeing**, **ReasonDialog**.

## 8. Mocks and demo mode

`NUXT_PUBLIC_DEMO_MODE=msw` (`pnpm dev:demo`, `pnpm build:demo`) starts MSW before mount; data
lives in `localStorage` (`atrium.demo-db.v2`) and reseeds daily or on "Reset demo data".
`api` uses the real backend (`NUXT_PUBLIC_API_BASE`) with the demo ribbon; empty = production.

### 8.1 Data and dates

- The core org is `app/mocks/core/users.json`, copied from the backend export
  (`../_spec/atrium/users.json`) by `pnpm mocks:users`: same UUIDs, handles, names and reporting
  lines as the backend. Import ids from `~/mocks/core/seed`: `USER_IDS.emma`, `USER_IDS.hilTech1`,
  `SEED_USERS`, `SITES`, `DEPARTMENTS`, `COST_CENTERS`, `DEFAULT_ASSET_COST_CENTER_ID`.
- Seeds get `ctx.d(n)` (IsoDate today ± n, like the backend's `d(n)`), `ctx.at(n, hh, mm)`
  (ISO instant), `ctx.weekday(n)` (kept off weekends), `ctx.faker` and `ctx.uuid()` (seeded,
  deterministic). Never use `Math.random()` or `new Date()` in seeds.
- Declare collections by augmenting `MockCollections`:

  ```ts
  declare module '~/mocks/db' {
    interface MockCollections {
      travelRequests: TravelRequestRecord
    }
  }
  // seed: ctx.db.travelRequests.insert({ … })   handlers: db.travelRequests.where(…)
  ```

- Seeds may import at runtime only `~/mocks/define` and the pure helpers
  `~/mocks/core/{seed,org,audit,files,enums}` (they take `db` as an argument). ESLint enforces it.

### 8.2 Handlers

```ts
export default defineMockHandlers(({ api }) => [
  http.get(api('/travel/requests'), ({ request }) => {
    const user = requireUser(request)                       // 401 without a valid token
    const rows = db.travelRequests.where((row) => canView(row, user))
    return listResponse(rows, request, {                    // page/perPage/sort/q/filters, 422 on bad sort
      filters: { status: 'status', kind: 'kind' }, search: ['reference', 'destination'],
      sort: ['createdAt', 'startsAt'], defaultSort: '-createdAt', map: (row) => toListItem(row, user),
    })
  }),
  http.post(api('/travel/requests'), async ({ request }) => {
    const user = requireUser(request)
    const body = await readJson(request, createSchema)      // zod → 422 with dot-path errors
    …
    return created(toDetail(record, user), api(`/travel/requests/${record.id}`))
  }),
  travelWorkflow.actionsHandler(api('/travel/requests/:id/actions/:action'), {
    collection: db.travelRequests, find: (id, user) => visible(id, user), toDto: toDetail,
  }),
])
```

Helpers in `~/mocks/http`: `ok`, `created`, `accepted`, `noContent`, `problem`, `notFound`,
`forbidden`, `conflict`, `invalidTransition`, `validationProblem`, `requireUser`, `requireRole`,
`userHasRole`, `findOr404`, `param`. Org helpers in `~/mocks/core/org`: `resolveApprover`
(SPEC §6.1), `canDecide` (§6.2: approver, deputy, manager chain), `approverCandidates`,
`managerChain`, `isActiveDeputy`, `userRefById`, `toUserSummary`. Audit: `recordAudit`,
`timelineFor`, `diffFields`. Files: `linkAttachments`, `attachmentsOf`, `seedAttachment`.

### 8.3 Workflow engine

`defineMockWorkflow<E>({ name, label, module, entityType, states, initialStates, transitions,
capabilities })`. Each transition: `event`, `from[]`, `to` (or several + `resolveTo`), `label`,
`actors`, `allowed(entity, user) → ActingAs | boolean`, optional zod `body`, `apply` (extra field
updates), `summary`, `after` (notifications, cascades). It gives `availableActions(entity, user)`
(events + capability flags), `can`, `transition(collection, entity, event, user, body)` (also for
seeds and jobs) and `actionsHandler`. Error order matches the API: unknown action 404 → wrong state
409 `invalid_transition` → not allowed 403 → body 422. Every transition writes the audit trail.
Register `definition` via `providers.workflows` so `/meta/workflows/{name}` serves it.

### 8.4 Providers (registry, SPEC_RESOLUTIONS #5)

`mocks/providers.ts` default-exports `defineMockProviders({ workflows, enums, inbox, search,
myDay, counts, jobs })`. The foundation aggregates: `/me/inbox` (sorted: high priority, due date,
age; ≤ 200), `/me/inbox/counts`, `/search` (≤ 5 per module), `/meta/enums`, `/meta/workflows`,
`/<m>/queues/counts` (zeros until `counts` exists) and `/admin/jobs`. `/home/my-day` belongs to A4
(API.md §9): its handler merges every module's fragment with `myDayFor(user)` from
`~/mocks/registry`.
Inbox items need `actionsPath` (resource path for quick actions, #4) and `link` (frontend route).

## 9. Navigation, access and the shell

- Navigation is `app/config/navigation.ts` (foundation). Item ids double as **badge ids**: a
  module's `badges.ts` returns `{ count, tone: 'plain' | 'you' | 'urgent', label }` per id; a 404
  from the counts endpoint means "no badge" (useXxxCounts returns null).
- **Access rules** (`definePageMeta({ access })`, nav items): a list of `RoleName`, `'deputy'`
  (active deputy today) or `'approver'` (manager ∨ executive ∨ active deputy); ANY match grants.
  No list = every signed-in user. `it_admin` is in every `BACK_OFFICE.<m>` list. This is visibility
  only — the API enforces permissions; hide actions by `availableActions`, never by role checks.
- In components: `const auth = useAuthStore()` → `auth.me`, `auth.can(['manager'])`,
  `auth.is('travel_desk')`.
- Shell pieces a slice can use: `useToast().success/error`, `await useConfirm().confirm({ title,
description, confirmLabel, destructive })`, `useShell()` (open palette/inbox), `?add=1`-style
  query flags for "open the dialog" commands.

## 10. UI kit reference

Components are global (no prefix). Highlights:

| Group    | Components                                                                                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ui       | UiButton (primary/secondary/ghost/danger/danger-solid; `to`, `icon`, `kbd`, `loading`), UiIconButton, UiDialog, UiConfirmDialog, UiDrawer, UiPopover, UiTooltip, UiMenu + UiMenuItem/Label/Separator/RadioGroup/RadioItem, UiTabs, UiTag, UiMiniChip, UiAvatar, UiKbd, UiSkeleton, UiSpinner, UiProgress, UiToaster |
| form     | UiField, UiInput, UiTextarea, UiSelect, UiCheckbox, UiSwitch, UiRadioCards, UiSegmented, UiDatePicker, UiDateRangePicker, DateRangeFilter, MoneyInput, UserPicker (`/users?q=`, `multiple`, `scope="team"`, `options`), FileDrop, FileList                                                                          |
| data     | PageBody, PageHeader, Breadcrumbs, DataTable, SplitInbox, StatCard, FactGrid, EmptyState, ProblemAlert, PersonaCard, PagePlaceholder                                                                                                                                                                                |
| workflow | StatusBadge, ActionBar, ReasonDialog, ReasonChips, PriorityFlag, RoutingSlip, LifecycleTimeline, AuditTrail, WorkflowDiagram, WhySeeing                                                                                                                                                                             |
| stepper  | StepperPage, StepperStep, StepperSlip                                                                                                                                                                                                                                                                               |

Canonical names follow SPEC_RESOLUTIONS #27. Formatting helpers (auto-imported from `utils/`):
`formatDate` ("Tue 21 Oct"), `formatLongDate`, `formatTime`, `formatDateTime`,
`formatDateRange`, `formatAge` ("2 days ago"), `formatRelativeDay`, `daysFromToday`,
`formatMoney`, `formatBytes`, `initialsOf`; links from API data go through `internalLink()`.

## 11. Styling and content

- Tailwind v4 utilities on DESIGN tokens only (`bg-sheet`, `text-ink-muted`, `border-rule`,
  `bg-st-waiting-bg`, `text-display-md`, `font-display`, …). The default Tailwind palette is
  removed; no hex values or arbitrary colours in slices. Dark mode is `html[data-theme=dark]` and
  works automatically through the tokens.
- Numerals: `num` (tabular, for counts and money), `mono` (references like `TRV-000031`).
- Icons: `@lucide/vue`, 16px / 1.75 stroke by default (`class="size-4"`).
- Copy: sentence case, verbs on buttons ("Approve", "Book it"), English (en-GB dates), no
  exclamation marks, no "please". Empty states teach one thing and offer one action.
- Fictional data only: names from the seed, `example.com` emails, no real companies or places.
- Every interactive element has an accessible name; dialogs and drawers trap focus (Reka).
  Mobile at 375px: no horizontal scroll, the tab bar never covers content (`PageBody`).

## 12. Testing

- `pnpm test`: Vitest projects `unit` (node, `test/unit/**`) and `nuxt` (happy-dom with the Nuxt
  runtime, `test/nuxt/**`, use `mountSuspended`).
- Mock API tests use the real HTTP client against the MSW handlers:
  `createMockServer()` from `~/mocks/node` + `resetDemoData({ refDate: new Date(2026, 9, 13) })`
  for deterministic relative dates (see `test/unit/mock-api.spec.ts`).
- `pnpm test:e2e`: Playwright (Chromium) against a demo dev server on port 3210 (`E2E_PORT`).
  `test/e2e/integration.spec.ts` chains the cross-module happy paths persona by persona; it also
  runs against the real API: start the backend (`pnpm demo:reset` first) and a frontend with
  `NUXT_PUBLIC_DEMO_MODE=api`, then `PLAYWRIGHT_BASE_URL=http://localhost:3000 E2E_API=1
E2E_MAILPIT_URL=http://localhost:8025 pnpm exec playwright test --project=chromium --workers=1
test/e2e/integration.spec.ts` (add `E2E_FRESH_SEED=1` on a fresh seed for the My day counts).
  Type dates relative to today with `dateDigitsIn(days)` from `helpers.ts` - fixed dates expire.
  Sign in with `signInAs(page, 'emma')` from `test/e2e/helpers.ts`; prefer roles and labels over
  test ids. `pnpm screenshots` regenerates the README screenshots in `docs/screenshots/`
  (`test/e2e/screenshots.spec.ts`; `SCREENSHOTS_DIR=<dir>` writes a review set elsewhere).

## 13. Tooling and commits

- pnpm 10, Node 22.12+ (CI: Node 24). Do not add dependencies in a slice; ask the foundation.
- `pnpm lint` (ESLint + Prettier check), `pnpm format`, `pnpm typecheck` (vue-tsc).
- Conventional commits (`feat(travel): …`, `fix(assets): …`, `test(training): …`), each ending
  with the `Co-Authored-By` trailer the coordinator specifies. Never push from a slice.
- Run `python -I ../_spec/check_blocklist.py .` before committing: `HARD hits: 0`.

## 14. Decisions log

| Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-13 | MSW pinned to **v2** (2.15) as specified.                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-13 | **TypeScript 5.9**: `openapi-typescript` 7 requires TS 5 and `vue-tsc` is not ready for TS 7.                                                                                                                                                                                                                                                                                                                            |
| 2026-10-13 | Icons from **`@lucide/vue`** (`lucide-vue-next` is deprecated).                                                                                                                                                                                                                                                                                                                                                          |
| 2026-10-13 | **zod 4** with `@vee-validate/zod` 4.15 (declares a zod 3 peer; works, peer rule in `pnpm-workspace.yaml`).                                                                                                                                                                                                                                                                                                              |
| 2026-10-13 | `@tanstack/vue-query` is excluded from Vite pre-bundling (devtools-api CJS issue in dev).                                                                                                                                                                                                                                                                                                                                |
| 2026-10-13 | Node 23 locally prints an "unsupported" warning; everything works. CI/Vercel use Node 24.                                                                                                                                                                                                                                                                                                                                |
| 2026-10-13 | Vitest `fsModuleCache` is off for the `nuxt` project (warm-run breakage with `@nuxt/test-utils`).                                                                                                                                                                                                                                                                                                                        |
| 2026-10-13 | **API types are hand-written** (`~/types/api`, module `api/types.ts`) because the backend's `openapi.json` only has `/health` and `/files/{token}`. `pnpm api:types` strips the `/api/v1` prefix and is ready once the export is complete. The generic `api.get/post/action` helpers are primary; the openapi-fetch client stays available as `api.client`.                                                              |
| 2026-10-13 | **users.json** is the backend's export (`_spec/atrium/users.json`), copied by `pnpm mocks:users`; the mock org (sites, departments, cost centres, users) uses the backend's UUIDs and handles.                                                                                                                                                                                                                           |
| 2026-10-13 | **`d(n)` = today ± n days**, identical to the backend's seed context (`SEED_TODAY` ± n), so due/overdue/high-priority stay true every day; `weekday(n)` keeps a date off weekends where only the weekday matters. This is our reading of SPEC_RESOLUTIONS #5 "shift by whole weeks".                                                                                                                                     |
| 2026-10-13 | Global middleware ordered by prefix: `01.auth.global.ts`, `02.access.global.ts`; denied routes render the 403 view (no `/forbidden` page).                                                                                                                                                                                                                                                                               |
| 2026-10-13 | Theme: light/dark/system stored in `localStorage['atrium-theme']`, applied as `html[data-theme]` by an inline script before paint.                                                                                                                                                                                                                                                                                       |
| 2026-10-13 | DataTable is our own component (no TanStack Table): server-side paging/sorting via the URL is all SCREENS needs.                                                                                                                                                                                                                                                                                                         |
| 2026-10-13 | The demo ribbon shows "Reset demo data" in MSW mode (no mailbox) and "Open demo mailbox" against the real API. `demo.reset` is listed on /admin/jobs but not runnable from the UI (CLI only).                                                                                                                                                                                                                            |
| 2026-10-13 | Settings (Deputies, Profile) are not in the sidebar (`hideInSidebar`); they are in the account menu and ⌘K.                                                                                                                                                                                                                                                                                                              |
| 2026-10-13 | Steppers don't block navigation with a "leave?" prompt: the draft is saved in this browser and closing keeps it.                                                                                                                                                                                                                                                                                                         |
| 2026-10-13 | `vue/require-default-prop` is off: type-based props model optional values as `undefined`. Boolean props that must stay `undefined` when absent need an explicit `undefined` default (Vue casts them to `false`).                                                                                                                                                                                                         |
| 2026-10-13 | E2E uses port 3210 by default so a dev server on 3000 is never reused by accident.                                                                                                                                                                                                                                                                                                                                       |
| 2026-10-13 | Integration (QA): `UiConfirmDialog` settles from its own buttons (Reka's AlertDialogAction/Cancel closed the dialog first, so every confirm resolved "cancel"); `FileDrop` has `v-model:uploading`; `InboxItem.actionsPath` is nullable; `AuditTrail` shows the AutoApproval label for `auto_approve` entries; mocks mirror the API's timeline sentences (comment as quoted text, "as deputy for …", system = "Atrium"). |
