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

/**
 * Applies the stored theme before the app renders (no flash). Same storage key as the comps.
 * 'light' | 'dark' | 'system' (default) → data-theme="light" | "dark" on <html>.
 */
const themeBootstrap = `(function(){var t=null;try{t=localStorage.getItem('atrium-theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t})();`

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',

  // Atrium is a client-only SPA (static hosting, no Nitro server at runtime).
  ssr: false,

  // Off for Playwright runs (E2E=1): the DevTools launcher overlaps the UI in screenshots.
  devtools: { enabled: !process.env.E2E },

  modules: ['@nuxt/eslint', '@pinia/nuxt', '@vueuse/nuxt'],

  css: [
    '@fontsource-variable/schibsted-grotesk/index.css',
    '@fontsource-variable/schibsted-grotesk/wght-italic.css',
    '@fontsource-variable/hedvig-letters-serif/index.css',
    '@fontsource/fragment-mono/400.css',
    '~/assets/css/main.css',
  ],

  app: {
    head: {
      title: 'Atrium',
      htmlAttrs: { lang: 'en-GB' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Atrium - employee self-service portal (demo)' },
        { name: 'color-scheme', content: 'light dark' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      script: [{ innerHTML: themeBootstrap, tagPriority: 'critical' }],
    },
  },

  runtimeConfig: {
    public: {
      /** NUXT_PUBLIC_API_BASE. Default = "main" row in WORKSPACE.md. */
      apiBase: 'http://localhost:3100/api/v1',
      /**
       * NUXT_PUBLIC_DEMO_MODE: 'msw' = fully in-browser demo (MSW + mock database),
       * 'api' = real backend in demo mode, '' = off. `true` is treated as 'msw'.
       */
      demoMode: '',
      /** NUXT_PUBLIC_MAILPIT_URL: "Open demo mailbox" link in the demo ribbon. */
      mailpitUrl: 'http://localhost:8025',
    },
  },

  components: {
    dirs: [
      // Kit components are registered by file name (UiButton, StatusBadge, DataTable, …).
      { path: '~/components', pathPrefix: false },
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
        '@internationalized/date',
        '@lucide/vue',
        '@tanstack/vue-query > @tanstack/query-core',
        '@vee-validate/zod',
        'class-variance-authority',
        'clsx',
        'date-fns',
        'dompurify',
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
      include: [
        '../playwright.config.ts',
        '../vitest.config.ts',
        '../test/e2e/**/*',
        '../slices.config.mjs',
      ],
    },
  },

  eslint: {
    // Formatting is Prettier's job.
    config: { stylistic: false },
  },
})
