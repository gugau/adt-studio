import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/desktop',
  timeout: 120_000,
  globalTimeout: 600_000,
  // Electron tests must run one at a time — parallel launch causes port conflicts
  // and corrupts the shared user-data-dir if workers reuse the same temp path.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
})
