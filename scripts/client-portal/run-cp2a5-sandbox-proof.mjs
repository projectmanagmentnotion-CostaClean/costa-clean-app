import { runSandboxCompatibilityProofV6 } from './cp2b_sandbox_compat_v6.mjs'

function main() {
  if (!process.argv.includes('--proof') || process.argv.length !== 3) {
    throw new Error('proof_mode_required')
  }
  const result = runSandboxCompatibilityProofV6()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`BLOCKED: ${error instanceof Error ? error.message : 'unknown_error'}\n`)
  process.exitCode = 1
}
