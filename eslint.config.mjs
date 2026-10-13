// @ts-check
import { readdirSync } from 'node:fs'
import prettier from 'eslint-config-prettier/flat'
import withNuxt from './.nuxt/eslint.config.mjs'
import { pageGlobs, sliceModules } from './slices.config.mjs'

const featureModules = readdirSync(new URL('./app/modules', import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

/**
 * Slice isolation: code in app/modules/<m>/ and in the pages the module owns (slices.config.mjs)
 * may import its own module but no other module (not even types). Share through ~/lib, ~/types,
 * the API or global components.
 */
const moduleIsolation = featureModules.map((name) => ({
  files: [
    `app/modules/${name}/**/*.{ts,vue}`,
    ...(sliceModules[name]?.pages ?? []).flatMap(pageGlobs),
  ],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            regex: `^(~|@)/modules/(?!${name}/)`,
            message: `"${name}" must not import other modules. Share via ~/lib, ~/types or the API.`,
          },
        ],
      },
    ],
  },
}))

export default withNuxt(
  {
    ignores: ['app/lib/api/schema.d.ts', 'public/mockServiceWorker.js'],
  },
  ...moduleIsolation,
  {
    // Module seeds run inside the mock-database bootstrap: importing the database (or anything that
    // imports it) at runtime from a seed creates an import cycle. Type imports are fine.
    files: ['app/modules/*/mocks/seed.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Allowed at runtime: define + the pure core helpers that take `db` as a parameter.
              regex: '^(~|@)/mocks/(?!define$|core/(seed|org|audit|files|enums|types)$)',
              allowTypeImports: true,
              message:
                'Seeds may import only ~/mocks/define and ~/mocks/core/{seed,org,audit,files,enums} at runtime; use ctx.db instead of ~/mocks/db.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['app/pages/**/*.vue', 'app/layouts/**/*.vue', 'app/app.vue', 'app/error.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  {
    // Type-based props: optional props are `undefined` unless defaulted, which TS already models.
    rules: { 'vue/require-default-prop': 'off' },
  },
  prettier,
)
