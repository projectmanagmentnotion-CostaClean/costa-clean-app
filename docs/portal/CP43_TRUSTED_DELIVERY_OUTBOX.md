# CP-4.3C Trusted Invitation Delivery Outbox

## Status

`QA_CERTIFIED / CLOSED`

The QA schema and trusted worker were certified in QA against
`kpvvydthlxupjjqqdpxy` by the accepted FINAL V18 run. The outbox, encrypted
payload lifecycle, RLS/FORCE RLS, service-role-only RPC grants, and expiry
cleanup are active in QA. The prior payload-validation and claim-guard repairs
were applied and verified before the final run; they are retained below as
historical implementation context, not open blockers.

The certification used one controlled invitation through the real trusted
invitation path. The worker returned HTTP `200`; Brevo accepted one sandbox
`drop` request; and no real email was delivered. The final outbox state was
`provider_accepted` at attempt `1`, with a provider message reference, no
lease, and no retained encrypted payload. The append-only audit recorded
`invitation_delivery_provider_accepted` with result `completed`.

## QA migration history

The externally applied, verified QA history is:

- `20260916133605_cp43_portal_invitation_delivery_outbox`;
- `20260916133654_cp43_outbox_reduce_service_role_privileges`.

The final verified state has the table, foreign key, checks, unique constraints
and ready partial index. RLS and FORCE RLS are enabled. `service_role` has only
`SELECT`, `INSERT` and `UPDATE`; `anon` and `authenticated` have no table
privileges. This reconciliation performs no remote operation. Production was
not touched.

## Encrypted payload extension

The owner approved temporary AES-256-GCM token recovery for CP-4.3C. The
additive migration `20260916141036_cp43_encrypted_invitation_delivery_payload`
and its required validation hardening are applied in QA and were exercised by
the accepted FINAL V18 run.

The new payload table contains only an invitation reference, ciphertext, nonce,
key version and lifecycle timestamps. The canonical invitation record remains
the recipient source. The invitation URL is constructed only in worker memory.
The encryption key is server-only and excluded from source, migrations, logs,
tests and audit metadata. AAD binds ciphertext to the invitation ID, contract
version, key version and expiry.

Payloads are deleted after provider acceptance, a terminal/ambiguous result,
revocation or expiry. The finalization RPC derives this policy from its status;
the compatibility boolean is rejected unless it matches that database-derived
policy. A revocation-status trigger clears payload state. The worker can retain
ciphertext solely for an explicit provider `429` or a received retryable `5xx`
response with bounded exponential delay. Network failure, timeout, connection
reset and malformed success response are treated as `delivery_outcome_unknown`,
blocked and never resent automatically.

The prepared migration also creates a private expiry cleanup function and a
`pg_cron` job scheduled every 15 minutes. It marks unavailable invitations
blocked and deletes expired or otherwise unavailable ciphertext without sending
or reissuing an invitation. The migration fails closed if `pg_cron` is absent.
This scheduler is active in QA through the externally approved `pg_cron`
extension. The migration does not install extensions implicitly.

## Boundary

The future trusted flow is:

```text
trusted invitation creation
  -> one idempotent outbox record in the same transaction
  -> internal worker lease
  -> provider adapter
  -> safe state transition and append-only audit event
```

The browser, portal user, and provider never obtain direct outbox access. The
outbox must be created by a narrow trusted boundary, not by a frontend client.

## Persisted state

The prepared schema contains only opaque operational references and safe
provider metadata:

- invitation reference;
- provider identifier;
- idempotency and correlation references;
- state, bounded attempts, retry/lease timestamps;
- provider message reference and safe provider code.

It intentionally excludes recipient email, invitation URL, raw invitation token,
template variables and provider credentials. `provider_accepted` means only that
the provider accepted a request; it does not prove inbox delivery.

## Retry and idempotency

One invitation has one outbox row and one stable idempotency key. Retryable
failures are bounded at five attempts. Finalization locks the leased outbox row
and accepts only the exact next attempt number, so concurrent workers cannot
repeat, skip or reset attempts. Missing configuration and provider rejections
become blocked, not automatic retries. Because Brevo does not offer a verified
request-idempotency guarantee, the worker leases one row atomically and retries
only a known `429` non-dispatch outcome or an explicit received retryable `5xx`.
A lease that expires before
finalization becomes blocked rather than being resent automatically. A received
Brevo `5xx` is an explicit retryable provider outcome; no transport failure is
treated as evidence that a request did not reach Brevo.

Only attempts `1` through `4` may transition to `retry_scheduled`. Attempt `5`
must end as `provider_accepted`, `blocked` or `terminal_failed`. Claiming also
filters out any queued or retry row at the maximum and terminalizes such legacy
or malformed rows without dispatching them.

## Security

The prepared table uses RLS and FORCE RLS, revokes public, anonymous and generic
authenticated access, and grants only the trusted service role. No public API,
portal read model, analytics event, or log may return provider message IDs or
delivery metadata.

## Certification evidence

The authoritative CP-4.3C runtime certification is FINAL V18. It records one
synthetic QA invitation, one worker invocation, one Brevo sandbox request and
zero real emails. The fixture and all related outbox, payload, audit,
membership, and temporary Auth-user records were removed after acceptance.

The final safety assertions were:

- precheck passed before dispatch;
- sandbox mode was `drop` and the allowlisted QA recipient was enforced;
- the outbox finished as `provider_accepted` with `attempt_count = 1`;
- a provider message ID was present and `last_provider_code` was null;
- the encrypted payload was destroyed and the lease was cleared;
- the audit event was `invitation_delivery_provider_accepted` with result
  `completed`;
- temporary one-shot helpers were restored to inert HTTP `410` behavior;
- cleanup restored all temporary CP-4.3C fixture counts to zero;
- production, DNS, secrets, and Git were not changed by the runtime run.

This is QA certification only. It does not authorize production deployment,
real email delivery, DNS changes, secret rotation, or a production pilot.

## Local freeze status

`CP43_CANONICAL_RECONCILIATION_IMMUTABLE_CHECKPOINT`

The QA runtime certificate is accepted and remains closed. The local candidate
has completed source-ledger reconciliation and is recorded in this immutable
checkpoint.

The local worker source was restored from the active QA deployment artifact:

- worker: `portal-invitation-delivery-worker`, version `18`;
- artifact SHA-256:
  `bd309b300e1bbe20532d70ea4a5c1c6d33704b4507307e8a761729794c39d3d6`;
- provenance: read-only Supabase QA deployment metadata and its seven-file
  source artifact bundle;
- no deployment, invocation, credential, or QA mutation occurred during
  recovery.

The remaining source-ledger reconciliation is database-only: the current QA
audit-event constraint includes the four CP-4.3C delivery event types, while
the available local CP-4.3C migration files do not record that persistent
constraint extension. The forward-only reconciliation is recorded in
`20260918155431_cp43_canonical_state_reconciliation.sql`. It is not a
recovery, rename, or repair of QA history: it creates or verifies the final
CP-4.3C contract, fails closed on incompatible state, requires `pg_cron`,
and excludes `pg_net` and QA certification scaffolding.

The only textual divergence from the QA V18 worker artifact is lint-only:
each intentional cleanup `catch` has an explicit `void 0` no-op and a
comment stating that cleanup failure cannot change the already classified
provider result. This preserves V18 provider codes, retry policy, timeout
behavior, payload lifecycle, and audit behavior.

These tasks did not reapply QA migrations, repeat FINAL V18, or change
production. CP-5.1 is ready only for its separately authorized
production-readiness gate.

## Activation order and prerequisites

Activation must be a coherent QA release, not an incremental configuration
change. The encrypted-payload migration must be applied before deploying the
worker and the updated `portal-member-actions` function. Server-only QA
configuration must be present before either function is allowed to create an
invitation: the payload encryption key and version, worker authentication key,
provider credentials, sender details and the canonical invitation-accept URL.

The first QA provider run also requires the private `BREVO_SANDBOX_MODE=drop`
setting and exactly one `PORTAL_INVITATION_DELIVERY_QA_RECIPIENT`. The worker
rejects all other targets before decrypting the token or contacting Brevo.

The canonical acceptance surface is now the local portal route
`/portal/invitacion#token=<opaque-token>`. It immediately removes the fragment
and keeps the raw token only in process memory until the authenticated account
submits it through the existing trusted acceptance RPC. The database continues
to validate the token hash, pending state, expiry, revocation and exact
authenticated email; unavailable cases receive one generic response. The base
URL remains a future QA deployment setting and must be the approved QA portal
origin plus `/portal/invitacion`; it is not configured in source.

An external OAuth redirect intentionally does not retain the token in browser
storage. If the user selects Google, they must reopen the invitation link after
authentication; this preserves the no-persistent-token rule.

A single owner-controlled QA recipient is required for the first provider
acceptance test. If sender verification requires DNS, stop for a separate DNS
approval.

## Verification

Local tests cover AES-GCM binding and expiry, state classification, bounded
retry behavior, ambiguous-outcome blocking, audit redaction, migration security
and the PostgreSQL validation and claim-guard repairs. FINAL V18 additionally
certified the real QA trusted-worker and Brevo sandbox path. Do not repeat that
runtime test unless a subsequent source, migration, worker, or provider change
invalidates this evidence.
