import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Several QA contract tests intentionally launch isolated Git/Node/CLI
    // processes. Running those files concurrently on Windows makes the
    // frozen package proof exceed Vitest's per-test budget; serialize files
    // while keeping each test's assertions and default timeout unchanged.
    fileParallelism: false,
    include: [
      'api/**/*.test.js',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'scripts/**/*.test.mjs',
    ],
  },
})
