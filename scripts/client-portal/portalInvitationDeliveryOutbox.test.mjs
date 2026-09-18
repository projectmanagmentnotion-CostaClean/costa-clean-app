import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  PORTAL_INVITATION_DELIVERY_MAX_ATTEMPTS,
  buildPortalInvitationDeliveryOutboxEntry,
  requirePortalInvitationDeliveryFinalization,
  toPortalInvitationDeliveryAuditEvent,
  transitionPortalInvitationDelivery,
} from '../../supabase/functions/_shared/portalInvitationDeliveryOutbox.ts'

const OUTBOX_MIGRATION = 'supabase/migrations/20260916133605_cp43_portal_invitation_delivery_outbox.sql'
const PRIVILEGE_MIGRATION = 'supabase/migrations/20260916133654_cp43_outbox_reduce_service_role_privileges.sql'
const PAYLOAD_MIGRATION = 'supabase/migrations/20260916141036_cp43_encrypted_invitation_delivery_payload.sql'
const PAYLOAD_REGEX_HOTFIX_MIGRATION = 'supabase/migrations/20260917120959_cp43_fix_delivery_payload_ciphertext_validation.sql'
const WORKER_ROLE_GUARD_HOTFIX_MIGRATION = 'supabase/migrations/20260917122537_cp43_fix_trusted_worker_role_guard.sql'
const CANONICAL_RECONCILIATION_MIGRATION = 'supabase/migrations/20260918155431_cp43_canonical_state_reconciliation.sql'

function entry(overrides = {}) {
  return buildPortalInvitationDeliveryOutboxEntry({
    invitationId: 'b3b891f7-4fca-4c9c-9c63-f09a6ef420b4',
    idempotencyKey: 'delivery:invitation:qa-1',
    correlationId: '3f3a7a5a-60b8-4290-82f5-4d3328030a2b',
    ...overrides,
  })
}

describe('portal invitation delivery outbox contract', () => {
  it('keeps enqueue state deterministic and free of recipient or invitation token fields', () => {
    const queued = entry()

    expect(queued).toEqual({
      invitationId: 'b3b891f7-4fca-4c9c-9c63-f09a6ef420b4',
      provider: 'brevo',
      idempotencyKey: 'delivery:invitation:qa-1',
      correlationId: '3f3a7a5a-60b8-4290-82f5-4d3328030a2b',
      status: 'queued',
    })
    expect(JSON.stringify(queued)).not.toMatch(/email|recipient|token|invitationUrl/iu)
  })

  it('maps provider acceptance, retry, terminal failure and blocked states without assuming provider idempotency', () => {
    expect(transitionPortalInvitationDelivery({ status: 'accepted', retryable: false, providerMessageId: 'provider-1' }, 0))
      .toEqual({ status: 'provider_accepted', attemptCount: 1, retryable: false, providerMessageId: 'provider-1' })
    expect(transitionPortalInvitationDelivery({ status: 'accepted', retryable: false }, 0))
      .toEqual({ status: 'terminal_failed', attemptCount: 1, retryable: false, providerCode: 'provider_message_id_missing' })
    expect(transitionPortalInvitationDelivery({ status: 'failed', retryable: true, providerCode: 'rate_limited' }, 0))
      .toEqual({ status: 'retry_scheduled', attemptCount: 1, retryable: true, providerCode: 'rate_limited' })
    expect(transitionPortalInvitationDelivery({ status: 'failed', retryable: true, providerCode: 'rate_limited' }, PORTAL_INVITATION_DELIVERY_MAX_ATTEMPTS - 1))
      .toEqual({ status: 'terminal_failed', attemptCount: PORTAL_INVITATION_DELIVERY_MAX_ATTEMPTS, retryable: false, providerCode: 'rate_limited' })
    expect(transitionPortalInvitationDelivery({ status: 'not_configured', retryable: false, providerCode: 'provider_disabled' }, 0))
      .toEqual({ status: 'blocked', attemptCount: 1, retryable: false, providerCode: 'provider_disabled' })
    expect(() => transitionPortalInvitationDelivery({ status: 'failed', retryable: true }, PORTAL_INVITATION_DELIVERY_MAX_ATTEMPTS))
      .toThrow('portal_invitation_delivery_attempt_count_invalid')
  })

  it('keeps provider message IDs and synthetic PII out of audit events', () => {
    const audit = toPortalInvitationDeliveryAuditEvent(entry(), {
      status: 'provider_accepted',
      attemptCount: 1,
      retryable: false,
      providerMessageId: 'provider-message-private',
    })
    const serialized = JSON.stringify(audit)

    expect(audit.hasProviderMessageId).toBe(true)
    expect(serialized).not.toContain('provider-message-private')
    expect(serialized).not.toMatch(/qa\.invalid|synthetic-one-time-token|recipient|token/iu)
  })

  it('prepares a service-role-only, forced-RLS outbox without delivery configuration', () => {
    const migration = readFileSync(OUTBOX_MIGRATION, 'utf8')
    const tableDefinition = migration.match(/create table public\.portal_invitation_delivery_outbox \([\s\S]*?\n\);/iu)?.[0] ?? ''

    expect(migration).toContain('create table public.portal_invitation_delivery_outbox')
    expect(migration).toContain('enable row level security')
    expect(migration).toContain('force row level security')
    expect(migration).toContain('revoke all on table public.portal_invitation_delivery_outbox from public, anon, authenticated')
    expect(migration).toContain('grant select, insert, update on table public.portal_invitation_delivery_outbox to service_role')
    expect(tableDefinition).not.toMatch(/email_normalized|recipient|token_hash|invitation_url/iu)
  })

  it('keeps the reconciled privilege hardening limited to service-role reads and writes', () => {
    const migration = readFileSync(PRIVILEGE_MIGRATION, 'utf8')

    expect(migration).toContain('revoke all on table public.portal_invitation_delivery_outbox from public, anon, authenticated')
    expect(migration).toContain('revoke delete on table public.portal_invitation_delivery_outbox from service_role')
    expect(migration).toContain('grant select, insert, update on table public.portal_invitation_delivery_outbox to service_role')
    expect(migration).not.toMatch(/grant\s+all|grant\s+delete/iu)
  })

  it('prepares encrypted payload lifecycle and service-role-only worker RPCs', () => {
    const migration = readFileSync(PAYLOAD_MIGRATION, 'utf8')

    expect(migration).toContain('create table public.portal_invitation_delivery_payloads')
    expect(migration).toContain('force row level security')
    expect(migration).toContain('clear_invitation_delivery_payload_after_status_change')
    expect(migration).toContain('portal_claim_invitation_delivery_trusted')
    expect(migration).toContain('portal_finalize_invitation_delivery_trusted')
    expect(migration).toContain("current_setting('request.jwt.claim.role', true)")
    expect(migration).toContain('revoke all on function public.portal_claim_invitation_delivery_trusted(uuid, integer) from public, anon, authenticated')
    expect(migration).not.toMatch(/invitation_url|raw_token|brevo_api_key/iu)
  })

  it('fails closed for null retry inputs and advances attempt counts only under a row lock', () => {
    const migration = readFileSync(PAYLOAD_MIGRATION, 'utf8')

    expect(migration).toContain('or p_status is null')
    expect(migration).toContain('or p_attempt_count is null')
    expect(migration).toContain('or p_destroy_payload is null')
    expect(migration).toContain("or (p_status = 'retry_scheduled' and p_next_attempt_at is null)")
    expect(migration).toContain("or (p_status = 'retry_scheduled' and p_next_attempt_at <= clock_timestamp())")
    expect(migration).toContain("or (p_status = 'retry_scheduled' and p_attempt_count >= 5)")
    expect(migration).toContain('for update of o')
    expect(migration).toContain('p_attempt_count <> v_outbox.attempt_count + 1')
  })

  it('derives ciphertext destruction from terminal status and schedules independent expiry cleanup', () => {
    const migration = readFileSync(PAYLOAD_MIGRATION, 'utf8')

    expect(migration).toContain("v_destroy_payload := p_status in ('provider_accepted', 'blocked', 'terminal_failed')")
    expect(migration).toContain('p_destroy_payload is distinct from v_destroy_payload')
    expect(migration).toContain("if p_status = 'retry_scheduled' then")
    expect(migration).toContain('portal_private.cleanup_expired_invitation_delivery_payloads')
    expect(migration).toContain("'cp43-expired-invitation-delivery-payload-cleanup'")
    expect(migration).toContain("'*/15 * * * *'")
  })

  it('allows only a future retry with the next monotonic attempt', () => {
    const now = new Date('2030-09-16T12:00:00.000Z')

    expect(() => requirePortalInvitationDeliveryFinalization({
      status: 'retry_scheduled', attemptCount: 1, previousAttemptCount: 0, nextAttemptAt: null, now,
    })).toThrow('portal_invitation_delivery_finalization_invalid')
    expect(() => requirePortalInvitationDeliveryFinalization({
      status: 'retry_scheduled', attemptCount: 1, previousAttemptCount: 0, nextAttemptAt: now, now,
    })).toThrow('portal_invitation_delivery_finalization_invalid')
    expect(() => requirePortalInvitationDeliveryFinalization({
      status: 'retry_scheduled', attemptCount: 1, previousAttemptCount: 1, nextAttemptAt: new Date('2030-09-16T12:01:00.000Z'), now,
    })).toThrow('portal_invitation_delivery_finalization_invalid')
    expect(() => requirePortalInvitationDeliveryFinalization({
      status: 'retry_scheduled', attemptCount: 2, previousAttemptCount: 0, nextAttemptAt: new Date('2030-09-16T12:01:00.000Z'), now,
    })).toThrow('portal_invitation_delivery_finalization_invalid')
    expect(requirePortalInvitationDeliveryFinalization({
      status: 'retry_scheduled', attemptCount: 1, previousAttemptCount: 0, nextAttemptAt: new Date('2030-09-16T12:01:00.000Z'), now,
    })).toEqual({ destroyPayload: false })
    expect(requirePortalInvitationDeliveryFinalization({
      status: 'retry_scheduled', attemptCount: 4, previousAttemptCount: 3, nextAttemptAt: new Date('2030-09-16T12:01:00.000Z'), now,
    })).toEqual({ destroyPayload: false })
    expect(() => requirePortalInvitationDeliveryFinalization({
      status: 'retry_scheduled', attemptCount: 5, previousAttemptCount: 4, nextAttemptAt: new Date('2030-09-16T12:01:00.000Z'), now,
    })).toThrow('portal_invitation_delivery_finalization_invalid')
  })

  it('destroys payloads for every terminal state and fails closed for null-sensitive inputs', () => {
    const now = new Date('2030-09-16T12:00:00.000Z')

    for (const status of ['provider_accepted', 'blocked', 'terminal_failed']) {
      expect(requirePortalInvitationDeliveryFinalization({
        status, attemptCount: 1, previousAttemptCount: 0, nextAttemptAt: null, now,
      })).toEqual({ destroyPayload: true })
    }
    for (const status of ['provider_accepted', 'terminal_failed']) {
      expect(requirePortalInvitationDeliveryFinalization({
        status, attemptCount: 5, previousAttemptCount: 4, nextAttemptAt: null, now,
      })).toEqual({ destroyPayload: true })
    }
    for (const input of [
      { status: null, attemptCount: 1, previousAttemptCount: 0, nextAttemptAt: null },
      { status: 'blocked', attemptCount: null, previousAttemptCount: 0, nextAttemptAt: null },
      { status: 'blocked', attemptCount: 1, previousAttemptCount: null, nextAttemptAt: null },
    ]) {
      expect(() => requirePortalInvitationDeliveryFinalization({ ...input, now }))
        .toThrow('portal_invitation_delivery_finalization_invalid')
    }
  })

  it('preserves the crash and expired-lease policy: unknown outcomes are blocked and expired ciphertext is cleaned', () => {
    const migration = readFileSync(PAYLOAD_MIGRATION, 'utf8')

    expect(migration).toContain("last_provider_code = 'delivery_outcome_unknown'")
    expect(migration).toContain("and lease_expires_at <= clock_timestamp()")
    expect(migration).toContain('p.expires_at <= clock_timestamp()')
  })

  it('never claims an outbox that already reached the maximum attempt count', () => {
    const migration = readFileSync(PAYLOAD_MIGRATION, 'utf8')

    expect(migration).toContain("where status in ('queued', 'retry_scheduled')\n    and attempt_count >= 5")
    expect(migration).toContain("and o.attempt_count < 5\n    and o.next_attempt_at <= clock_timestamp()")
    expect(migration).toContain("last_provider_code = 'delivery_attempt_limit_reached'")
  })

  it('repairs the PostgreSQL regex bound without weakening the 512-character ciphertext contract', () => {
    const migration = readFileSync(PAYLOAD_REGEX_HOTFIX_MIGRATION, 'utf8')

    expect(migration).toContain('create or replace function public.portal_create_invitation_delivery_trusted')
    expect(migration).toContain("char_length(coalesce(p_payload_ciphertext, '')) not between 32 and 512")
    expect(migration).toContain("coalesce(p_payload_ciphertext, '') !~ '^[A-Za-z0-9_-]+$'")
    expect(migration).not.toContain('{32,512}')
    expect(migration).toContain('security definer')
    expect(migration).toContain('revoke all on function public.portal_create_invitation_delivery_trusted')
    expect(migration).toContain('grant execute on function public.portal_create_invitation_delivery_trusted')
  })

  it('accepts only service-role JWT claims from either supported PostgREST request setting', () => {
    const migration = readFileSync(WORKER_ROLE_GUARD_HOTFIX_MIGRATION, 'utf8')

    expect(migration).toContain("nullif(current_setting('request.jwt.claim.role', true), '')")
    expect(migration).toContain("nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'")
    expect(migration).toContain("<> 'service_role'")
    expect(migration).toContain('create or replace function public.portal_claim_invitation_delivery_trusted')
    expect(migration).toContain('create or replace function public.portal_finalize_invitation_delivery_trusted')
    expect(migration).toContain('revoke all on function public.portal_claim_invitation_delivery_trusted')
    expect(migration).toContain('grant execute on function public.portal_finalize_invitation_delivery_trusted')
  })

  it('defines a forward-only canonical reconciliation without QA certifier infrastructure', () => {
    const migration = readFileSync(CANONICAL_RECONCILIATION_MIGRATION, 'utf8')
    const executableSql = migration.replace(/^--.*$/gmu, '')

    expect(migration).toContain('cp43_canonical_partial_delivery_schema')
    expect(migration).toContain('cp43_canonical_requires_pg_cron')
    expect(migration).toContain('cp43-expired-invitation-delivery-payload-cleanup')
    expect(migration).toContain("'*/15 * * * *'")
    expect(migration).toContain('client_portal_audit_events_event_type_check')
    expect(migration).toContain('invitation_delivery_provider_accepted')
    expect(migration).toContain('invitation_delivery_retry_scheduled')
    expect(migration).toContain('invitation_delivery_blocked')
    expect(migration).toContain('invitation_delivery_terminal_failed')
    expect(migration).toContain('portal_claim_invitation_delivery_trusted')
    expect(migration).toContain('portal_finalize_invitation_delivery_trusted')
    expect(executableSql).not.toMatch(/pg_net|certifier|one-shot|fixture/iu)
    expect(executableSql).not.toMatch(/drop\s+table|truncate\s+/iu)
  })
})
