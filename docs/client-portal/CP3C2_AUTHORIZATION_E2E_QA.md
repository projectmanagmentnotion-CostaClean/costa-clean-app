# CP-3C.2 Authenticated Authorization E2E QA

Date: 2026-09-10
Target: QA project `kpvvydthlxupjjqqdpxy` only
Status: `PARTIAL — CP-3C.2R2 replacement identities verified; certification debt remains`

## Current Consolidated Status

CP-3C.2R3 completed the QA-only CORS remediation and invitation lifecycle
certification. The canonical origin remains preserved, the exact local QA
origin is allowlisted, and the four affected portal Edge Functions were
deployed consistently in QA. `ADMIN_A`, `MEMBER_A_V2` and `ADMIN_B_V2` pass
authenticated self-access and their member authorization matrix; the member
role receives safe denial for admin-only actions. The active invitation was
accepted once and replayed safely with exactly one Client B membership.

The initial cross-tenant 500 defect and invoice TTL evidence below are
historical evidence from the earlier run, not current open blockers. Current
remaining external debts are Google provider configuration and invitation
email delivery; CP-3C.3 remains not started.

This report is sanitized. It contains no passwords, tokens, signed URLs,
private bearer material or raw invitation tokens. CP-3C.3 was not started.

## Environment And Identity Matrix

| Identity | Password auth | Self-access / runtime result |
|---|---|---|
| `ADMIN_A` | NOT_VERIFIED — stored credential rejected | NOT_EXECUTED |
| `MEMBER_A` | NOT_VERIFIED — reused credential unavailable | NOT_EXECUTED |
| `ADMIN_B` | NOT_VERIFIED — reused credential unavailable | NOT_EXECUTED |
| `APPLICANT_INDIVIDUAL` | PASS | Authenticated without access before onboarding; onboarding produced `pending_review` |
| `APPLICANT_BUSINESS` | PASS | Authenticated without access before onboarding; onboarding produced `pending_review` |
| `SUSPENDED_OR_INACTIVE_A` | PASS | `suspended` state returned |
| `REVOKED_A` | PASS | `revoked` state returned |
| `INVITEE` | PASS | Active Client B member context |

The three reused identities were not reset or replaced. Their missing private
credentials are a certification blocker, not a reason to weaken identity
isolation.

## Completed Evidence

- Email match without tenancy: `PASS`. The individual applicant matched the
  synthetic Client B email but had zero membership and no tenant context.
- Individual onboarding: `PASS` at HTTP level; status `pending_review`, legal
  acceptance present, marketing false, no membership or automatic client link.
- Business onboarding: `PASS` at HTTP level; status `pending_review`, legal
  acceptance present, marketing true, one granted versioned marketing consent,
  no membership or automatic client link.
- Onboarding idempotency: `PASS`. Exact repeat returned `202`; same key with a
  different payload returned `409`.
- Forged application fields and unknown extra key: `PASS` denied with `400`.
- Service request: `PASS` through an active synthetic Client B member. One
  request was created, exact repeat did not duplicate it, a changed payload
  conflicted, cancellation preserved history, and a second cancellation was
  denied. The transient row was removed during cleanup.
- Marketing preference: `PASS` for read, grant, read, withdraw and read.
- RLS/direct writes: `PASS` for the inspected portal tables. Sensitive portal
  tables have RLS and FORCE RLS; authenticated direct insert grants are false.
- Invoice cross-tenant download: `PASS` denied with `404` from Client B toward
  the existing Client A invoice. The invoice and document were not mutated.
- Cleanup: `PASS`. Two applications, two legal acceptances, two consents and
  one service request were removed by an exact QA transaction. CP-3C.1
  identities and fixtures remain `KEEP_UNTIL_CP3C3`.

## Remaining Certification Debt

- The original corrupted `MEMBER_A` and `ADMIN_B` rows remain untouched. Their
  exact CP-3C.1 memberships were rebound to the authorized V2 replacements;
  no duplicate memberships were created.
- Active invitation acceptance/replay remains deferred because the raw
  ephemeral token is absent from the private ledger. No token was invented and
  no email was sent.
- Invoice owner read, PDF retrieval, 60-second expiry, refresh, unsigned
  access and document mismatch checks were not executed because the owner
  identity was unavailable.
- Integrated browser Console and Network certification remains incomplete: the
  members Edge Function rejects the local origin with its generic safe error
  before member RPC execution. Production requests remain zero by target lock.
- Cross-tenant profile/property/invoice RPC attempts returned no data but three
  returned HTTP `500` instead of the preferred uniform `404`; this is a
  contract error-handling defect to resolve before full certification.
- Rate-limit runtime: `NOT_EXECUTED_AVOID_FIXTURE_LOCKOUT`.

## Cleanup And Invariants

- Private ledger: `.auth/cp3c2/ledger.json`, ignored and not tracked.
- Cleanup planner: `scripts/client-portal/cp3c2_qa_cleanup_plan.mjs`.
- Package manifest: `scripts/client-portal/cp3c2_qa_package.manifest.json`.
- Cleanup dry-run matched the ledger exactly before deletion.
- CP-3C.1 Client B/property B, Auth users, invitations and membership states
  remain intact.
- Existing invoice/document, legal catalog and fiscal numbering remain intact.
- Production writes, deploys, Auth mutations and requests: `0`.

## Gate Decision

`CP-3C.2` remains `PARTIAL`. It must not be marked `DONE` or promote CP-3B.3,
CP-3B.4 or CP-3B.5 to full certification until the listed identity, browser,
invoice and fixture-collision evidence is completed. CP-3C.3 remains not
started.

See [`CP3C2R_AUTHENTICATED_CERTIFICATION_REMEDIATION.md`](./CP3C2R_AUTHENTICATED_CERTIFICATION_REMEDIATION.md)
for the remediation run. The cross-tenant 500 defect and CP-3B.4 invoice
download/TTL debt were addressed in QA; two Auth identities, active invitation
acceptance and integrated browser Console/Network evidence remain pending.
