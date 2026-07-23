import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrations = readdirSync('supabase/migrations').filter((name) => /^\d{14}_.+\.sql$/u.test(name))
const edgeSource = readFileSync('supabase/functions/_shared/publicQuizHandler.ts', 'utf8')

describe('Gate 4B source guardrails', () => {
  it('adds exactly one uniquely versioned 14-digit migration', () => {
    expect(migrations).toEqual(['20260722171428_public_quiz_providerless_abuse_protection.sql'])
  })

  it('locks the old RPC and grants only the private signature to service_role', () => {
    const sql = readFileSync(`supabase/migrations/${migrations[0]}`, 'utf8')
    expect(sql).toMatch(/revoke execute on function public\.submit_public_gym_manual_quiz_attempt\(jsonb\)[\s\S]+from public, anon, authenticated/iu)
    expect(sql).toMatch(/grant execute on function public\.submit_public_gym_manual_quiz_attempt_private\(jsonb, text, text\)[\s\S]+to service_role/iu)
    expect(sql).toMatch(/enable row level security/iu)
    expect(sql).not.toContain('supabase_migrations.schema_migrations')
    expect(sql).not.toMatch(/invoice_number|display_code|quarterly_closings|payments/iu)
  })

  it('allowlists only the reviewed QA and production projects and contains no sensitive logging fields', () => {
    expect(edgeSource).toContain("'kpvvydthlxupjjqqdpxy'")
    expect(edgeSource).toContain("'wfxnwfcdjainpojhbdri'")
    expect(edgeSource).toContain('AUTHORIZED_PROJECT_REFS.has(projectRef)')
    expect(edgeSource).not.toMatch(/log\([^\n]*(clientIp|payload|serviceKey|pepper|requestNonce)/u)
    expect(edgeSource).not.toMatch(/user-agent/iu)
  })
})
