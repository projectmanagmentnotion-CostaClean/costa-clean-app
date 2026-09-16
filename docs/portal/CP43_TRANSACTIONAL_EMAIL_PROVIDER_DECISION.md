# CP-4.3A Transactional Email Provider Decision

## Status

`FOUNDATION_IMPLEMENTED_PROVIDER_PENDING_OWNER_APPROVAL`

This document records a local, provider-neutral foundation. No email provider
has been selected, no provider credentials or domain records have been
configured, and no invitation email can be sent by this change.

## Current audit

The existing invitation path is intentionally secure but delivery-disabled:

- `client_portal_invitations` stores a normalized recipient address and a hash
  of a one-time token; it never stores the raw token.
- `portal_create_invitation_trusted` creates bounded, expiring, pending
  invitations through the existing trusted boundary.
- `portal-member-actions` explicitly passes `deliverInvitation: undefined`.
  An invitation request therefore fails closed with `delivery_unavailable` and
  has no configured external provider.
- The active portal code has no connected transactional provider adapter.
  Private local environment files were not read or changed by this foundation.

The current handler persists an invitation before a future delivery callback is
called. An approved delivery phase must define retry/outbox state and a safe
recovery path for a provider failure after invitation creation. It must not
blindly issue additional raw tokens or resend them without an explicit,
auditable policy.

## Foundation contract

`supabase/functions/_shared/transactionalEmail.ts` is a server-only port. It
supports only `PORTAL_INVITATION` initially:

```ts
sendTransactionalEmail({
  template,
  recipient,
  locale,
  variables,
  idempotencyKey,
  correlationId,
})
```

It returns a normalized provider-independent result:

```ts
{
  status,
  providerMessageId?,
  retryable,
  providerCode?,
}
```

The committed default provider is disabled and returns `not_configured`.
It is not wired into `portal-member-actions`, so this phase does not alter
invitation behavior. Audit metadata deliberately excludes the recipient and
template variables because those fields can contain PII and the one-time
invitation URL/token.

## Provider decision boundary

The following are technical options only, not a provider selection:

| Option | Technical considerations | Official pricing |
|---|---|---|
| Resend | HTTP API and template-oriented workflow; confirm sending region, account limits and webhooks at approval. | [Resend pricing](https://resend.com/pricing) |
| Postmark | Transactional-email focus and message-event webhooks; confirm region, retention and plan limits. | [Postmark pricing](https://postmarkapp.com/pricing) |
| Brevo | Transactional API plus broader communications product; confirm product separation, region and rate limits. | [Brevo pricing](https://www.brevo.com/pricing/) |
| Amazon SES | AWS-native sending service with operational configuration responsibility; confirm region, sandbox and event handling. | [Amazon SES pricing](https://aws.amazon.com/ses/pricing/) |

Recommended decision path: evaluate Resend first for a narrow server API and
template workflow, then compare it with Postmark, Brevo and Amazon SES against
the approved data-processing and operational requirements. This is a technical
short-list only. `OWNER_APPROVAL_REQUIRED` applies before creating an account,
accepting paid terms, configuring a provider, or sending any email.

Pricing, sending limits, regions, subprocessors, webhook features and account
eligibility change over time. They must be verified from the applicable
provider account and legal terms at approval time; this document makes no
price, availability or compliance claim.

## Required approval inputs

Before a real adapter, secret, sandbox delivery, DNS change or deployment:

1. Select a provider and approve its pricing/contract terms.
2. Review the DPA, subprocessors, processing region and any international data
   transfer basis with the owner/legal process.
3. Approve the sender domain, From/Reply-To behavior and template copy.
4. Authorize domain authentication records: SPF, DKIM and DMARC, including
   alignment and any return-path requirements.
5. Approve private server-side secret storage, sandbox target, rate limits,
   idempotency/retry policy, webhook verification and monitoring/rollback.
6. Authorize the exact QA deployment separately. Production delivery requires
   another exact production authorization.

No DNS, SiteGround, Supabase remote configuration, provider account, real
send, or production change was performed in CP-4.3A.

## Security and privacy constraints

- Provider secrets remain server-only and must never enter `src/`, browser
  bundles, logs, reports, screenshots or Git.
- Raw invitation tokens may appear only in the delivered link and the
  recipient's browser during redemption; they are not persisted raw or added
  to analytics/audit metadata.
- The recipient address and invitation variables must not become metric labels,
  object keys, correlation IDs or webhook log payloads.
- Idempotency must be enforced at the approved delivery boundary. A provider
  message ID is operational metadata, not a public API response.
- Provider webhooks, if approved, require signature verification, narrow event
  allowlists, redaction and a bounded retention policy.

## Rollback

There is no active provider integration to roll back. A future approved
adapter must be disabled through server-only configuration, revoke the provider
credential, preserve only safe delivery audit metadata, and leave existing
pending invitations available to an explicit reviewed recovery workflow.
