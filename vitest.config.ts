import { fileURLToPath } from 'node:url'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

const app = fileURLToPath(new URL('./app', import.meta.url))

export default defineConfig({
  test: {
    projects: [
      {
        // Fast, framework-free tests (pure functions, mocks, helpers). No auto-imports here.
        resolve: { alias: { '~': app, '@': app } },
        test: {
          name: 'unit',
          include: ['test/unit/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      await defineVitestProject({
        // Tests that need the Nuxt runtime (auto-imports, plugins, stores, components).
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.{test,spec}.ts'],
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              rootDir: fileURLToPath(new URL('.', import.meta.url)),
              domEnvironment: 'happy-dom',
            },
          },
          // Vitest 5's persistent transform cache (node_modules/.vitest-cache) breaks
          // @nuxt/test-utils' virtual app entry on warm runs ("Failed to resolve import
          // ./diagnostics/core.js"). Re-evaluate when @nuxt/test-utils supports it.
          fsModuleCache: false,
        },
      }),
    ],
  },
})
