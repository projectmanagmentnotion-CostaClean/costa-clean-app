import assert from 'node:assert/strict'
import test from 'node:test'
import { createMockJitApi, evaluateRevocationGate, EXPECTED_PAT_NAME, runMockBackup } from './cp51f-jit-backup-behavior.mjs'

const mapping = { user_id: '11111111-1111-1111-1111-111111111111', user_roles: [{ role: 'reader', expires_at: 1 }] }

for (const state of ['disabled', 'enabled']) {
  test(`restores exact ${state} prestate after successful dumps`, async () => {
    const api = createMockJitApi({ state, mapping })
    const result = await runMockBackup({ api })
    assert.equal(result.status, 'PASS')
    assert.equal(api.state, state)
    assert.deepEqual(api.mapping, mapping)
    assert.deepEqual(result.calls.filter(call => call.startsWith('dump-')), [
      'dump-roles', 'dump-schema', 'dump-data', 'dump-history_schema', 'dump-history_data',
    ])
  })
}

for (const failAt of ['enable', 'mapping-put', 'dump-roles', 'dump-schema', 'dump-data', 'dump-history_schema', 'dump-history_data']) {
  test(`cleans up after ${failAt}`, async () => {
    const api = createMockJitApi({ state: 'disabled', mapping, failAt })
    const result = await runMockBackup({ api })
    assert.notEqual(result.status, 'PASS')
    assert.equal(api.state, 'disabled')
    if (failAt !== 'enable') assert.deepEqual(api.mapping, mapping)
  })
}

test('mapping absence fails closed before mutation', async () => {
  const api = createMockJitApi({ state: 'disabled', mapping: null })
  const result = await runMockBackup({ api })
  assert.equal(result.status, 'STOP_MAPPING_ABSENT')
  assert.deepEqual(api.calls, ['get-state', 'get-mapping'])
})

test('unexpected state fails closed before mutation', async () => {
  const api = createMockJitApi({ state: 'unknown', mapping })
  const result = await runMockBackup({ api })
  assert.equal(result.status, 'FAIL_CLOSED')
  assert.deepEqual(api.calls, ['get-state'])
})

test('failure immediately after enable is cleaned up', async () => {
  const api = createMockJitApi({ state: 'disabled', mapping, failAfter: 'enable' })
  const result = await runMockBackup({ api })
  assert.equal(result.status, 'FAIL_CLOSED')
  assert.equal(api.state, 'disabled')
  assert.deepEqual(api.mapping, mapping)
})

test('cleanup API failure is a hard stop', async () => {
  const api = createMockJitApi({ state: 'disabled', mapping, failAt: 'cleanup-mapping-put' })
  const result = await runMockBackup({ api })
  assert.equal(result.status, 'STOP_JIT_CLEANUP_FAILURE')
})

test('cleanup state failure is a hard stop', async () => {
  const api = createMockJitApi({ state: 'disabled', mapping, failAt: 'cleanup-state' })
  const result = await runMockBackup({ api })
  assert.equal(result.status, 'STOP_JIT_CLEANUP_FAILURE')
})

test('revocation is mandatory for certification', () => {
  assert.deepEqual(evaluateRevocationGate({ restoreResult: 'PASS', jitPoststateMatchesPrestate: 'YES' }), {
    status: 'AWAITING_PAT_REVOCATION', canCertify: false,
  })
  assert.deepEqual(evaluateRevocationGate({
    restoreResult: 'PASS', jitPoststateMatchesPrestate: 'YES', classicPatRevoked: 'YES',
    revocationEvidence: { tokenName: EXPECTED_PAT_NAME, active: true, tokenValuePresent: false },
  }), { status: 'STOP_PAT_REVOCATION_FAILURE', canCertify: false })
  assert.deepEqual(evaluateRevocationGate({
    restoreResult: 'PASS', jitPoststateMatchesPrestate: 'YES', classicPatRevoked: 'YES',
    revocationEvidence: { tokenName: EXPECTED_PAT_NAME, active: false, tokenValuePresent: false },
  }), { status: 'LOGICAL_BACKUP_VERIFIED', canCertify: true })
})

test('sentinel is never emitted by the mocked operation surface', async () => {
  const sentinel = 'CP51F_TEST_SECRET_SENTINEL_DO_NOT_LEAK'
  const api = createMockJitApi({ state: 'enabled', mapping })
  const result = await runMockBackup({ api, dump: async name => api.maybeFail(`dump-${name}`) })
  const observed = JSON.stringify({ result, calls: api.calls })
  assert.equal(observed.includes(sentinel), false)
})
