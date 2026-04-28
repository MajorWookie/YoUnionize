import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration.
 *
 * Runs against docker-compose backend + dev server.
 * Start with: docker-compose up -d && bun dev
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  retries: 1,
  fullyParallel: false,

  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'bun dev',
    port: 8081,
    timeout: 60_000,
    reuseExistingServer: true,
  },
})
