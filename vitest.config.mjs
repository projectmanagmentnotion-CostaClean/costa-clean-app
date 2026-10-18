import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Several QA contract tests intentionally launch isolated Git/Node/CLI
    // processes. Running those files concurrently on Windows makes the
    // frozen package proof exceed Vitest's per-test budget; serialize files
    // and allow up to 15 seconds for each process-backed contract assertion.
    fileParallelism: false,
    testTimeout: 15_000,
    include: [
      'api/**/*.test.js',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'scripts/**/*.test.mjs',
    ],
  },
})
