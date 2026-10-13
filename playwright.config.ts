import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs against the demo dev server (MSW mocks, no backend) on port E2E_PORT (default 3210, so
 * a dev server on 3000 is never reused by accident).
 * Set PLAYWRIGHT_BASE_URL to test an already running server instead (e.g. the static demo build
 * served with `npx serve -s .output/public -l 4173`); no web server is started then.
 */
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL
const port = Number(process.env.E2E_PORT ?? 3210)
const baseURL = externalBaseURL ?? `http://localhost:${port}`

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
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
      // `pnpm screenshots`: foundation screenshots into docs/screenshots/foundation/.
      name: 'screenshots',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /screenshots\.spec\.ts/,
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: `pnpm exec nuxt dev --port ${port} --dotenv .env.demo`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: { E2E: '1' },
        stdout: 'ignore',
        stderr: 'pipe',
      },
})
