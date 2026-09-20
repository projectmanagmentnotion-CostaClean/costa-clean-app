import assert from 'node:assert/strict'
import test from 'node:test'
import { artifactIsUsable, buildPgDumpallRolesCommand, buildPgDumpCommand, createMockJitApi, evaluateRevocationGate, EXPECTED_PAT_NAME, runMockBackup } from './cp51f-jit-backup-behavior.mjs'

const mapping = { user_id: '11111111-1111-1111-1111-111111111111', user_roles: [{ role: 'reader', expires_at: 1 }] }

test('roles use pg_dumpall roles-only without role passwords', () => {
  const command = buildPgDumpallRolesCommand()
  assert.equal(command[0], 'pg_dumpall')
  assert.ok(command.includes('--roles-only'))
  assert.ok(command.includes('--no-role-passwords'))
  assert.equal(command.includes('--role-only'), false)
})

test('database dumps use independent schema arguments and no legacy flags', () => {
  const schema = buildPgDumpCommand({ kind: 'schema', schemas: ['public', 'portal_private', 'auth'] })
  const data = buildPgDumpCommand({ kind: 'data', schemas: ['public', 'portal_private', 'auth'] })
  assert.equal(schema[0], 'pg_dump')
  assert.deepEqual(schema.slice(-3), ['--schema=public', '--schema=portal_private', '--schema=auth'])
  assert.deepEqual(data.slice(-3), ['--schema=public', '--schema=portal_private', '--schema=auth'])
  assert.ok(data.includes('--data-only'))
  assert.equal(schema.includes('--use-copy'), false)
  assert.equal(data.includes('--use-copy'), false)
  assert.equal(schema.includes('--role-only'), false)
})

test('migration history uses one schema argument', () => {
  assert.deepEqual(buildPgDumpCommand({ kind: 'schema', schemas: ['supabase_migrations'] }).slice(-1), ['--schema=supabase_migrations'])
  assert.deepEqual(buildPgDumpCommand({ kind: 'data', schemas: ['supabase_migrations'] }).slice(-1), ['--schema=supabase_migrations'])
})

test('empty artifacts fail closed', () => {
  assert.equal(artifactIsUsable(0), false)
  assert.equal(artifactIsUsable(12), true)
})

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

test('pg_dumpall failure activates JIT cleanup', async () => {
  const api = createMockJitApi({ state: 'disabled', mapping })
  const result = await runMockBackup({ api, dump: async name => {
    api.maybeFail(`dump-${name}`)
    if (name === 'roles') throw new Error('pg_dumpall failed')
  } })
  assert.equal(result.status, 'FAIL_CLOSED')
  assert.equal(api.state, 'disabled')
  assert.deepEqual(api.mapping, mapping)
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
