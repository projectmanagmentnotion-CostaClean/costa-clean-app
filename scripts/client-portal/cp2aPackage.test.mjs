import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const MIGRATION = 'supabase/migrations/20260723160000_client_portal_security_boundary.sql'
const QA_REF = 'kpvvydthlxupjjqqdpxy'
const PROD_REF = 'wfxnwfcdjainpojhbdri'
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

describe('CP-2A immutable package guards', () => {
  it('has one unique new 14-digit migration and its frozen hash matches', () => {
    const names = readdirSync('supabase/migrations')
    expect(names.filter((name) => name.startsWith('20260723160000_'))).toEqual([
      '20260723160000_client_portal_security_boundary.sql',
    ])
    expect(sha256(MIGRATION)).toBe('ea10b4b3db30f6b27f60cd8fff6c8a7c711636e1d6ac439337966f5736cc6277')
  })

  it('keeps CP-2B plan-only and rejects execution', () => {
    const plan = spawnSync(process.execPath, ['scripts/client-portal/run-cp2b-qa.mjs', '--plan'], {
      encoding: 'utf8',
    })
    expect(plan.status).toBe(0)
    expect(JSON.parse(plan.stdout)).toMatchObject({
      status: 'NOT_AUTHORIZED',
      qaProjectRef: QA_REF,
      productionProjectRef: PROD_REF,
      productionAllowed: false,
      remoteWritesPerformed: 0,
    })
    const execute = spawnSync(process.execPath, ['scripts/client-portal/run-cp2b-qa.mjs', '--execute'], {
      encoding: 'utf8',
    })
    expect(execute.status).not.toBe(0)
    expect(execute.stderr).toContain('CP-2B is not authorized')
  })

  it('guards apply, fixtures and cleanup against production', () => {
    for (const path of [
      'scripts/client-portal/cp2b_apply.sql',
      'scripts/client-portal/cp2a_fixtures.sql',
      'scripts/client-portal/cp2a_cleanup.sql',
    ]) {
      const source = readFileSync(path, 'utf8')
      expect(source).toContain(PROD_REF)
      expect(source).toContain(QA_REF)
    }
    const fixtures = readFileSync('scripts/client-portal/cp2a_fixtures.sql', 'utf8')
    expect(fixtures).toContain('QA-CP2-')
    expect(fixtures).toContain('@example.invalid')
    expect(fixtures).not.toMatch(/@(gmail|hotmail|outlook|yahoo)\./iu)
  })

  it('contains no raw invite-token column or frontend service-role import', () => {
    const migration = readFileSync(MIGRATION, 'utf8')
    const frontend = readFileSync('src/lib/supabase.ts', 'utf8')
    expect(migration).not.toContain('raw_token')
    expect(migration).toContain('token_hash')
    expect(frontend).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
  })
})
