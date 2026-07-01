import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function resolveGitCommit() {
  const vercelCommit = process.env.VERCEL_GIT_COMMIT_SHA?.trim()
  if (vercelCommit) {
    return vercelCommit.slice(0, 7)
  }

  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

const buildDate = new Date().toISOString()
const buildCommit = resolveGitCommit()
const buildVersion = `${buildDate.slice(0, 10)}-${buildCommit}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_COMMIT__: JSON.stringify(buildCommit),
    __APP_BUILD_VERSION__: JSON.stringify(buildVersion),
    __APP_BUILD_DATE__: JSON.stringify(buildDate),
  },
})
