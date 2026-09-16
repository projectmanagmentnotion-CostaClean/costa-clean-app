# CP-4.3A Transactional Email Provider Decision

## Status

`OWNER_APPROVED_PROVIDER_BREVO / ADAPTER_IMPLEMENTED_LOCAL`

The owner approved Brevo for transactional email only. This local adapter does
not configure credentials, create a Brevo account, authenticate a domain or
send email. Invitation delivery remains disconnected pending the next exact QA
integration gate.

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

## Provider decision

Brevo is the approved transactional provider for CP-4.3B. It is not approved
for newsletters, marketing lists, campaign creation, contact synchronization,
advertising or any public/production delivery.

The former technical options remain recorded for future reassessment only:

| Option | Technical considerations | Official pricing |
|---|---|---|
| Resend | HTTP API and template-oriented workflow; confirm sending region, account limits and webhooks at approval. | [Resend pricing](https://resend.com/pricing) |
| Postmark | Transactional-email focus and message-event webhooks; confirm region, retention and plan limits. | [Postmark pricing](https://postmarkapp.com/pricing) |
| Brevo | Transactional API plus broader communications product; confirm product separation, region and rate limits. | [Brevo pricing](https://www.brevo.com/pricing/) |
| Amazon SES | AWS-native sending service with operational configuration responsibility; confirm region, sandbox and event handling. | [Amazon SES pricing](https://aws.amazon.com/ses/pricing/) |

CP-4.3B uses Brevo's documented transactional endpoint:
`POST https://api.brevo.com/v3/smtp/email`, authenticated only through the
server-side `api-key` header. The local adapter renders repository-controlled
Spanish text and HTML content for `PORTAL_INVITATION`; it does not require a
Brevo dashboard template.

Brevo transport idempotency is `NOT_ASSUMED`. Costa Clean's trusted delivery
state/outbox boundary remains responsible for exactly-once invitation handling
before the adapter can be wired to the portal handler.

Pricing, sending limits, regions, subprocessors, webhook features and account
eligibility change over time. They must be verified from the applicable
provider account and legal terms at approval time; this document makes no
price, availability or compliance claim.

## Required approval inputs

Before a real credential, sandbox delivery, DNS change, wiring or deployment:

1. Review Brevo pricing/contract terms, DPA, subprocessors, processing region
   and any international data
   transfer basis with the owner/legal process.
2. Approve the sender domain, From/Reply-To behavior and template copy.
3. Authorize domain authentication records: SPF, DKIM and DMARC, including
   alignment and any return-path requirements.
4. Approve private server-side secret storage, sandbox target, rate limits,
   idempotency/retry policy, webhook verification and monitoring/rollback.
5. Authorize the exact QA deployment separately. Production delivery requires
   another exact production authorization.

Suggested future QA-only environment names are `TRANSACTIONAL_EMAIL_PROVIDER`,
`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` and
`BREVO_REPLY_TO_EMAIL`. They remain unset by this change. The provider resolver
defaults to `disabled`, and `brevo` fails closed if its configuration is
missing or invalid.

No DNS, SiteGround, Supabase remote configuration, provider account, real
send, or production change was performed in CP-4.3B.

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
