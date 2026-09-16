import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  CLEANUP_RPC_NAME,
  QA_INTAKE_ENDPOINT,
  QA_PROJECT_REF,
  assertBaselineRestored,
  assertNoForbiddenReportContent,
  assertPublicResponseSafe,
  buildFixture,
  cleanupFixture,
  startWebRuntime,
  validatePreflight,
} from './certify-cp42b7.mjs'

const testApi = process.env.VITEST || process.env.VITEST_POOL_ID
  ? await import('vitest')
  : await import('node:test')
const { describe, it } = testApi

const validEnv = {
  PUBLIC_LEAD_INTAKE_SECRET: 's'.repeat(48),
  PUBLIC_LEAD_INTAKE_ENV: 'qa',
  PUBLIC_LEAD_INTAKE_URL: QA_INTAKE_ENDPOINT,
  SUPABASE_QA_SERVICE_ROLE_KEY: 'qa-admin-placeholder',
}

describe('CP42B7 runtime harness preflight', () => {
  it('fails closed when the HMAC signer is missing', () => {
    assert.throws(() => validatePreflight({ ...validEnv, PUBLIC_LEAD_INTAKE_SECRET: '' }), /HMAC_SIGNER_SECRET_UNAVAILABLE/)
  })

  it('rejects the wrong environment and production endpoint', () => {
    assert.throws(() => validatePreflight({ ...validEnv, PUBLIC_LEAD_INTAKE_ENV: 'production' }), /QA_ENVIRONMENT_INVALID/)
    assert.throws(() => validatePreflight({ ...validEnv, PUBLIC_LEAD_INTAKE_URL: 'https://wfxnwfcdjainpojhbdri.supabase.co/functions/v1/public-lead-intake' }), /PRODUCTION_TARGET_BLOCKED/)
  })

  it('locks the exact QA project endpoint', () => {
    assert.deepEqual(validatePreflight(validEnv).environment, 'qa')
    assert.deepEqual(validatePreflight(validEnv).endpoint, QA_INTAKE_ENDPOINT)
    assert.match(QA_INTAKE_ENDPOINT, new RegExp(QA_PROJECT_REF))
    assert.throws(() => validatePreflight({ ...validEnv, PUBLIC_LEAD_INTAKE_URL: 'https://other.supabase.co/functions/v1/public-lead-intake' }), /QA_TARGET_MISMATCH/)
  })
})

describe('CP42B7 Windows web runtime', () => {
  const webRoot = 'C:\\qa-web'
  const runtimeConfig = {
    endpoint: QA_INTAKE_ENDPOINT,
    environment: 'qa',
    secret: 'hmac-placeholder',
  }

  it('runs local Next through the current Node executable without npm.cmd or a shell', () => {
    const child = new EventEmitter()
    child.exitCode = null
    let launch
    const started = startWebRuntime(webRoot, runtimeConfig, 3217, {
      exists: () => true,
      nodeExecutable: 'node-under-test',
      spawnProcess: (command, args, options) => {
        launch = { command, args, options }
        return child
      },
    })

    assert.equal(started, child)
    assert.equal(launch.command, 'node-under-test')
    assert.deepEqual(launch.args, [
      resolve(webRoot, 'node_modules', 'next', 'dist', 'bin', 'next'),
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3217',
    ])
    assert.equal(launch.options.shell, undefined)
    assert.equal(launch.options.env.SUPABASE_QA_SERVICE_ROLE_KEY, undefined)
    assert.equal(launch.options.env.SUPABASE_SERVICE_ROLE_KEY, undefined)
    assert.equal(launch.options.env.SUPABASE_SECRET_KEY, undefined)
    assert.equal(launch.options.stdio, 'ignore')
    assert.equal(launch.options.windowsHide, true)
  })

  it('fails explicitly when the local Next runtime is unavailable', () => {
    assert.throws(
      () => startWebRuntime(webRoot, runtimeConfig, 3217, { exists: () => false }),
      /WEB_NEXT_RUNTIME_UNAVAILABLE/,
    )
  })

  it('translates synchronous and asynchronous spawn failures without exposing configuration', () => {
    assert.throws(
      () => startWebRuntime(webRoot, runtimeConfig, 3217, {
        exists: () => true,
        spawnProcess: () => {
          const error = new Error('spawn failed')
          error.code = 'EINVAL'
          throw error
        },
      }),
      /WEB_RUNTIME_SPAWN_FAILED:EINVAL/,
    )

    const child = new EventEmitter()
    child.exitCode = null
    const started = startWebRuntime(webRoot, runtimeConfig, 3217, {
      exists: () => true,
      spawnProcess: () => child,
    })
    const error = new Error('spawn failed')
    error.code = 'ENOENT'
    child.emit('error', error)
    assert.equal(started.cp42b7SpawnError, 'WEB_RUNTIME_SPAWN_FAILED:ENOENT')
    assert.doesNotMatch(started.cp42b7SpawnError, /hmac-placeholder|SUPABASE_QA_SERVICE_ROLE_KEY/)
  })
})

describe('CP42B7 runtime harness safety assertions', () => {
  it('cleans fixtures only through the guarded RPC with exact identifiers', async () => {
    let request
    const result = await cleanupFixture('qa-admin-placeholder', '11111111-1111-4111-8111-111111111117', 'LEAD-CP42B-test', async (url, options) => {
      request = { url, options }
      return { ok: true, json: async () => ({ ok: true, submission_deleted: true, lead_deleted: true }) }
    })

    assert.equal(result.status, 'cleaned')
    assert.equal(request.url, `https://${QA_PROJECT_REF}.supabase.co/rest/v1/rpc/${CLEANUP_RPC_NAME}`)
    assert.equal(request.options.method, 'POST')
    assert.deepEqual(JSON.parse(request.options.body), {
      p_submission_id: '11111111-1111-4111-8111-111111111117',
      p_lead_id: 'LEAD-CP42B-test',
    })
    assert.doesNotMatch(request.options.body, /table|delete|audit/iu)
  })

  it('fails closed when the guarded cleanup RPC fails', async () => {
    await assert.rejects(
      cleanupFixture('qa-admin-placeholder', '11111111-1111-4111-8111-111111111117', 'LEAD-CP42B-test', async () => ({ ok: false, json: async () => ({}) })),
      /QA_CLEANUP_RPC_FAILED/,
    )
  })

  it('keeps the append-only trigger and verifies migration privileges and guards', async () => {
    const [migration, runner, intakeMigration] = await Promise.all([
      readFile('supabase/migrations/20260916101722_cp42b7_guarded_runtime_fixture_cleanup.sql', 'utf8'),
      readFile('scripts/qa/certify-cp42b7.mjs', 'utf8'),
      readFile('supabase/migrations/20260915174434_cp42b5_public_quote_lead_seed_qa.sql', 'utf8'),
    ])
    assert.match(migration, /security definer/i)
    assert.match(migration, /set search_path = pg_catalog/i)
    assert.match(migration, /owner to postgres/i)
    assert.match(migration, /revoke all on function .* from public, anon, authenticated, service_role/is)
    assert.match(migration, /grant execute on function .* to service_role/is)
    for (const guard of ['QA CP42B7 Runtime', 'qa\.cp42b7\.runtime@qa\.invalid', '\\+34999999999', 'qa_b7_runtime', 'internal_qa', 'cp42b7_certification', 'cp42b-v2', 'quote_draft_seed_v1', 'costa_clean_quote_intelligence@1\.0\.0', 'estimate_v1']) {
      assert.match(migration, new RegExp(guard))
    }
    assert.match(migration, /CP42B7_QA_CLEANUP_GUARD_FAILED/)
    assert.match(migration, /delete from public\.public_quote_intake_audit/i)
    assert.doesNotMatch(migration, /drop trigger|disable trigger|prevent_public_quote_audit_mutation/is)
    assert.doesNotMatch(runner, /method:\s*'DELETE'/)
    assert.match(intakeMigration, /create trigger public_quote_intake_audit_append_only/i)
    assert.match(intakeMigration, /current_user <> 'postgres'/i)
  })

  it('builds a fresh RES-C synthetic fixture without click IDs', () => {
    const fixture = buildFixture('11111111-1111-4111-8111-111111111117')
    assert.equal(fixture.service, 'residential')
    assert.equal(fixture.size, '71-100')
    assert.deepEqual(fixture.cookieConsent, { analytics: false, marketing: false })
    assert.equal(Object.hasOwn(fixture.attribution, 'gclid'), false)
  })

  it('rejects public response leaks and accepts only the minimal success shape', () => {
    assert.equal(assertPublicResponseSafe({ ok: true }, 200), true)
    assert.throws(() => assertPublicResponseSafe({ ok: true, seed_id: 'internal' }, 200), /PUBLIC_RESPONSE_NOT_MINIMAL/)
    assert.throws(() => assertPublicResponseSafe({ ok: false, error: 'supabase' }, 503), /WEB_HTTP_NOT_200/)
  })

  it('fails when cleanup does not restore the baseline', () => {
    assert.equal(assertBaselineRestored({ leads: 2, clients: 8 }, { leads: 2, clients: 8 }), true)
    assert.throws(() => assertBaselineRestored({ leads: 2 }, { leads: 3 }), /BASELINE_NOT_RESTORED:leads/)
  })

  it('keeps secrets and forbidden fields out of the report', () => {
    assert.equal(assertNoForbiddenReportContent({ status: 'PASS', target: QA_PROJECT_REF }, ['secret-value']), true)
    assert.throws(() => assertNoForbiddenReportContent({ status: 'PASS', token: 'secret-value' }, ['secret-value']), /REPORT_SECRET_LEAK/)
  })
})
