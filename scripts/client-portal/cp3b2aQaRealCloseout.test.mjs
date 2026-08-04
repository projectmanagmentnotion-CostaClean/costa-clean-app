import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const POSTCHECK = 'scripts/client-portal/cp3b2a_qa_real_postcheck.sql'
const MATRIX = 'scripts/client-portal/cp3b2a_qa_real_contract_matrix.sql'
const CONCURRENCY = 'scripts/client-portal/cp3b2a_qa_real_concurrency.mjs'

function read(filePath) {
  return readFileSync(filePath, 'utf8')
}

describe('CP-3B.2A real QA closeout package', () => {
  it('freezes a strict read-only postcheck for the reviewed-change contract', () => {
    const source = read(POSTCHECK)
    for (const phrase of [
      'client_portal_profile_change_requests',
      'client_portal_property_change_requests',
      'idempotency_key',
      'public_reference',
      'client_portal_profile_change_public_reference_format',
      'client_portal_property_change_public_reference_format',
      'client_portal_profile_change_v2_idempotency_uidx',
      'client_portal_property_change_v2_idempotency_uidx',
      'client_portal_profile_change_v2_public_reference_uidx',
      'client_portal_property_change_v2_public_reference_uidx',
      'normalize_profile_change_v2(jsonb)',
      'normalize_property_change_v2(jsonb)',
      'reviewed_change_receipt_v2(text,text,timestamp with time zone,jsonb,text)',
      'portal_submit_profile_change_request_v2(text,jsonb,uuid)',
      'portal_submit_property_change_request_v2(text,text,jsonb,uuid)',
      'portal_list_own_profile_change_requests_v2(text,integer)',
      'portal_list_own_property_change_requests_v2(text,text,integer)',
      'REAL_STRUCTURAL_POSTCHECK_PASS',
      'cp3b2a_project_ref_mismatch',
      'authenticated_execute_grant_missing',
      'customer_tables_write_policy_leak',
    ]) {
      expect(source).toContain(phrase)
    }
    expect(source).toContain('set local statement_timeout = \'30s\'')
    expect(source).toContain('rollback;')
    expect(source).toContain('has_function_privilege(\'anon\'')
    expect(source).toContain('pg_get_userbyid(p.proowner) = \'postgres\'')
  })

  it('executes a real transactional matrix with explicit neutral, payload and idempotency coverage', () => {
    const source = read(MATRIX)
    for (const phrase of [
      'no_session_neutral',
      'anon_denied',
      'no_membership_neutral',
      'suspended_membership_neutral',
      'revoked_membership_neutral',
      'cross_client_neutral',
      'anon_denied_profile_submit',
      'profile_payload_rejected',
      'property_payload_rejected',
      'profile_receipt_shape',
      'property_receipt_shape',
      'profile_idempotency_same_payload',
      'property_idempotency_same_payload',
      'profile_idempotency_conflict',
      'property_idempotency_conflict',
      'same_client_cross_user_profile_hidden',
      'same_client_cross_user_property_hidden',
      'profile_list_order_desc',
      'property_list_order_desc',
      'REAL_CONTRACT_MATRIX_PASS',
      'pg_temp.set_auth_context',
    ]) {
      expect(source).toContain(phrase)
    }
    expect(source).toContain('request.jwt.claim.sub')
    expect(source).toContain('request.jwt.claims')
    expect(source).toContain('portal_list_own_property_change_requests_v2')
    expect(source).toContain('portal_list_own_profile_change_requests_v2')
    expect(source).toContain('rollback;')
  })

  it('uses independent child processes, barriered workers and private cleanup for concurrency', () => {
    const source = read(CONCURRENCY)
    for (const phrase of [
      'child_process',
      'spawn(',
      'Promise.all',
      'pg_sleep(0.5)',
      'profile_same_payload_receipt_mismatch',
      'profile_conflict_missing_error',
      'property_same_payload_receipt_mismatch',
      'property_conflict_missing_error',
      'cleanup',
      'residueZero',
      'CP-3B.2A REAL QA CLOSEOUT',
    ]) {
      expect(source).toContain(phrase)
    }
    expect(source).not.toContain("'pg'")
    expect(source).toContain('resolveSupabaseCliTarget')
  })
})
