export function fastDeliveryPlan(level, relatedTestPaths = []) {
  if (!['L1', 'L2'].includes(level)) throw new Error('L3_CHANGE_BLOCKED_FROM_FAST_DELIVERY')
  return {
    commands: ['npm run lint', 'npm run build'],
    testMode: level === 'L2' ? 'FULL_SUITE' : relatedTestPaths.length ? 'RELATED' : 'NONE',
    tests: level === 'L2' ? ['vitest run + verify-test-baseline.mjs'] : [...new Set(relatedTestPaths)],
  }
}
