import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const edgeSource = readFileSync(new URL('../../../supabase/functions/expense-document-openai-extraction/index.ts', import.meta.url), 'utf8')
const migrationSource = readFileSync(new URL('../../../supabase/migrations/20261002080214_n55_openai_provider_contract.sql', import.meta.url), 'utf8')

describe('N5.5 OpenAI security boundary', () => {
  it('requires bearer auth and accepts only a capture document id plus mode', () => {
    expect(edgeSource).toContain("request.headers.get('Authorization')")
    expect(edgeSource).toContain("['captureDocumentId', 'mode']")
    expect(edgeSource).not.toContain('receipt_file_path')
    expect(edgeSource).not.toContain('owner_id')
    expect(edgeSource).not.toContain('bucket')
  })

  it('derives ownership and storage path server-side before downloading private bytes', () => {
    expect(edgeSource).toContain("p_authenticated_user_id: userId")
    expect(edgeSource).toContain("p_provider: OPENAI_PROVIDER")
    expect(edgeSource).toContain("p_provider_version: OPENAI_PROVIDER_VERSION")
    expect(edgeSource).toContain('row.storage_path.startsWith(`captures/${row.capture_session_id}/`)')
    expect(edgeSource).toContain("adminClient.storage.from(BUCKET).download(row.storage_path)")
    expect(edgeSource).toContain("Deno.env.get('OPENAI_API_KEY')")
    expect(edgeSource).not.toContain('import.meta.env')
  })

  it('does not confirm or write an expense before human confirmation', () => {
    expect(edgeSource).not.toContain('confirm_expense_capture')
    expect(edgeSource).not.toContain("from('expenses')")
    expect(edgeSource).toContain("from('expense_capture_extractions').update")
    expect(edgeSource).toContain('OPENAI_MAX_ATTEMPTS_PER_DOCUMENT')
    expect(edgeSource).toContain('requestOpenAiExtraction')
  })

  it('keeps the provider migration forward-only and version-gated', () => {
    expect(migrationSource).toContain("p_provider not in ('fixture', 'openai')")
    expect(migrationSource).toContain("p_provider_version <> 'n55-openai-responses-v1'")
    expect(migrationSource).toContain('v_latest.attempt >= 2')
    expect(edgeSource).toContain("row.action === 'ATTEMPT_LIMIT_REACHED'")
    expect(migrationSource).toContain('v_session.created_by <> p_authenticated_user_id')
    expect(migrationSource).toContain('for update')
    expect(migrationSource).toContain('grant execute')
  })
})
