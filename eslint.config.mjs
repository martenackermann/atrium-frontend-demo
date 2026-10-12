// @ts-check
import { readdirSync } from 'node:fs'
import prettier from 'eslint-config-prettier/flat'
import withNuxt from './.nuxt/eslint.config.mjs'

const featureModules = readdirSync(new URL('./app/modules', import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

/**
 * Slice isolation: code in app/modules/<m>/ and app/pages/<m>/ may import its own module but no
 * other module (not even types). Share through ~/lib, ~/types, the API schema or global components.
 */
const moduleIsolation = featureModules.map((name) => ({
  files: [`app/modules/${name}/**/*.{ts,vue}`, `app/pages/${name}/**/*.{ts,vue}`],
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
              group: ['~/mocks/*', '!~/mocks/define'],
              allowTypeImports: true,
              message: 'Seeds may only import ~/mocks/define at runtime; use ctx.db instead.',
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
  prettier,
)
