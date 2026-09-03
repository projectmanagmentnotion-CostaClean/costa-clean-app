import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e/financial',
  timeout: 45000,
  fullyParallel: false,
  reporter: [['line'], ['json', { outputFile: 'qa-reports/private/financial-e2e.json' }]],
  use: { baseURL: process.env.QA_APP_URL || 'http://127.0.0.1:5173', headless: !process.argv.includes('--headed'), trace: 'retain-on-failure', screenshot: 'only-on-failure' },
})

