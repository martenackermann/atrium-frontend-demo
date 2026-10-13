import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs in demo mode (MSW mocks, no backend):
 * - default: against the demo dev server (`nuxt dev --dotenv .env.demo`) on port E2E_PORT
 *   (default 3210, so a dev server on 3000 is never reused by accident);
 * - `E2E_STATIC=1`: against the static demo build (`pnpm build:demo` first), served like Vercel
 *   serves it by scripts/serve-static.mjs (SPA fallback). CI uses this.
 * Set PLAYWRIGHT_BASE_URL to test an already running server instead; no web server is started then.
 */
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL
const staticBuild = !!process.env.E2E_STATIC
const port = Number(process.env.E2E_PORT ?? (staticBuild ? 4173 : 3210))
const baseURL = externalBaseURL ?? `http://localhost:${port}`

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /screenshots\.spec\.ts/,
    },
    {
      // `pnpm screenshots`: the README screenshots in docs/screenshots/.
      name: 'screenshots',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /screenshots\.spec\.ts/,
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: staticBuild
          ? `node scripts/serve-static.mjs .output/public ${port}`
          : `pnpm exec nuxt dev --port ${port} --dotenv .env.demo`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: { E2E: '1' },
        stdout: 'ignore',
        stderr: 'pipe',
      },
})
