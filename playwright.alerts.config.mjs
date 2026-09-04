import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e/alerts',
  timeout: 60000,
  fullyParallel: false,
  reporter: [['line'], ['json', { outputFile: 'qa-reports/private/alerts-e2e.json' }]],
  use: {
    baseURL: process.env.QA_APP_URL || 'http://127.0.0.1:5173',
    headless: !process.argv.includes('--headed'),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
