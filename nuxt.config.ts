import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

/**
 * Feature modules live in app/modules/<name>/. They are discovered here so that adding a
 * module never requires editing this file: each module's components/ folder is registered
 * with a PascalCase prefix (app/modules/training/components/StatusChip.vue -> <TrainingStatusChip>).
 */
const modulesDir = fileURLToPath(new URL('./app/modules', import.meta.url))
const featureModules = readdirSync(modulesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const toPascalCase = (value: string) =>
  value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('')

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',

  // Atrium is a client-only SPA (static hosting, no Nitro server at runtime).
  ssr: false,

  devtools: { enabled: true },

  modules: ['@nuxt/eslint', '@pinia/nuxt', '@vueuse/nuxt'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'Atrium',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Atrium - employee self-service portal (demo)' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  runtimeConfig: {
    public: {
      /** Override with NUXT_PUBLIC_API_BASE. Default = "main" row in WORKSPACE.md. */
      apiBase: 'http://localhost:3100/api/v1',
      /** Override with NUXT_PUBLIC_DEMO_MODE=true. Starts MSW + the in-browser mock database. */
      demoMode: false,
    },
  },

  components: {
    dirs: [
      { path: '~/components' },
      ...featureModules.map((name) => ({
        path: `~/modules/${name}/components`,
        prefix: toPascalCase(name),
      })),
    ],
  },

  imports: {
    presets: [
      {
        from: '@tanstack/vue-query',
        imports: ['useQuery', 'useQueries', 'useMutation', 'useQueryClient', 'keepPreviousData'],
      },
      {
        from: 'vee-validate',
        imports: ['useForm', 'useField', 'useFieldArray'],
      },
      {
        from: '@vee-validate/zod',
        imports: ['toTypedSchema'],
      },
    ],
  },

  devServer: { port: 3000 },

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      // Pre-bundle the heavy deps up front so the first dev page load does not trigger a
      // dependency re-optimisation + full reload (important for Playwright against `dev:demo`).
      include: [
        '@faker-js/faker',
        '@tanstack/vue-query > @tanstack/query-core',
        '@vee-validate/zod',
        'class-variance-authority',
        'clsx',
        'date-fns',
        'msw',
        'msw/browser',
        'openapi-fetch',
        'reka-ui',
        'tailwind-merge',
        'vee-validate',
        'zod',
      ],
      // Nuxt excludes @vue/devtools-api from pre-bundling; when it is imported from inside a
      // pre-bundled @tanstack/vue-query chunk, Nuxt's fallback resolver picks devtools-api v6's
      // CommonJS entry ("does not provide an export named 'setupDevtoolsPlugin'"). Serving
      // vue-query from its real path lets Vite resolve its own deps to their ESM builds.
      exclude: ['@tanstack/vue-query'],
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
    // `pnpm typecheck` also covers unit tests (app context) and the e2e/tool configs (node context).
    appTsConfig: { include: ['../test/unit/**/*'] },
    nodeTsConfig: {
      include: ['../playwright.config.ts', '../vitest.config.ts', '../test/e2e/**/*'],
    },
  },

  eslint: {
    // Formatting is Prettier's job.
    config: { stylistic: false },
  },
})
