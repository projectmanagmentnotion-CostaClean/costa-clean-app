import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'v3-release.spec.mjs',
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  reporter: [['line'], ['json', { outputFile: 'qa-reports/private/v3-8-release/playwright.json' }]],
  use: {
    baseURL: process.env.QA_APP_URL || 'http://127.0.0.1:4176/?v3=1',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
