# Atrium (frontend demo)

Atrium is an employee self-service portal: training requests, travel requests, IT assets,
onboarding/offboarding requests and company news. This repository holds the single-page app;
the API lives in `atrium-backend-demo`. Atrium is a portfolio demo set in a fictional company,
Acme IT Services.

> **Status:** foundation done: design system, UI kit, app shell, auth, demo mode with mock data,
> and the foundation screens (inbox, settings, admin). The module screens (training, travel,
> devices, people requests, news, home) are placeholders that the slices replace.

## Stack

Nuxt 4 (SPA, `ssr: false`) · TypeScript (strict) · Tailwind CSS v4 · Reka UI · Pinia ·
TanStack Vue Query · vee-validate + zod · openapi-fetch · MSW 2 · Vitest · Playwright

## Getting started

Requires Node 22.12+ (CI uses Node 24) and pnpm 10.

```bash
pnpm install
pnpm dev:demo   # http://localhost:3000, no backend needed (MSW + in-browser mock data)
pnpm dev        # against the API at NUXT_PUBLIC_API_BASE (default http://localhost:3100/api/v1)
```

Demo mode signs you in as one of the demo personas. The password for every persona is
`demo1234`, which exists only for the demo. Copy `.env.example` to `.env` to change settings.

## Scripts

| Script                         | What it does                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm dev:demo`   | Dev server on port 3000 (real API / demo mode)                                    |
| `pnpm build` / `pnpm generate` | Production build / static generation                                              |
| `pnpm build:demo`              | Static demo build (demo mode on) to `.output/public`, which `vercel.json` deploys |
| `pnpm preview`                 | Preview the last build                                                            |
| `pnpm lint` / `pnpm lint:fix`  | ESLint + Prettier check (or fix)                                                  |
| `pnpm typecheck`               | `nuxt typecheck` (vue-tsc)                                                        |
| `pnpm test`                    | Vitest (unit + Nuxt runtime projects)                                             |
| `pnpm test:e2e`                | Playwright (Chromium) against a demo dev server on port 3210                      |
| `pnpm screenshots`             | Review screenshots (light/dark, desktop/mobile) into `docs/screenshots/`          |
| `pnpm mocks:users`             | Copy the backend's seed org export into `app/mocks/core/users.json`               |
| `pnpm api:types`               | Regenerate `app/lib/api/schema.d.ts` from the backend's OpenAPI document          |

## Contributing

Read [CONVENTIONS.md](./CONVENTIONS.md) before adding a feature. It covers the module system,
API usage, forms, mocks and tests.

## License

[MIT](./LICENSE) © 2026 Marten Ackermann
