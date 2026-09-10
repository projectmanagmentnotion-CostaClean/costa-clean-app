# CP-3C.1 Controlled QA Identities And Fixtures

Date: 2026-09-10  
Target: QA project `kpvvydthlxupjjqqdpxy` only  
Status: `FIXTURES_ACTIVE_READY_FOR_CP3C2`

This closeout records the separately authorized synthetic QA dataset. It does
not start CP-3C.2, change production, configure Google, send email, or alter
financial records.

## Sanitized Inventory

- Auth identities: 5 created (`APPLICANT_INDIVIDUAL`, `APPLICANT_BUSINESS`,
  `SUSPENDED_OR_INACTIVE_A`, `REVOKED_A`, `INVITEE`); 3 existing identities
  reused for `ADMIN_A`, `MEMBER_A`, and `ADMIN_B`.
- Clients: 1 created (Client B), 1 existing Client A reused.
- Properties: 1 created for Client B, 2 existing Client A properties reused.
- Memberships: 5 created: active member, active admin, suspended, revoked,
  and the accepted-invitation membership. One existing Client A admin
  membership is protected and reused.
- Invitations: 4 created: pending, expired, revoked, and accepted.
- Applications and marketing consents pre-created: 0 and 0.
- Invoices/payment/fiscal fixtures created: 0. The known CP-3B.4 invoice was
  found as an existing QA row and was read-only checked; it was not changed.
- Legal document fixture: existing active QA privacy document unchanged.
- Email delivery and Google provider changes: 0.

## Security Invariants

- Every created email is synthetic and ends in `@qa.invalid`.
- The individual and business applicants have no portal membership. The
  individual applicant email intentionally matches Client B to prove that an
  email match alone does not grant tenancy.
- The fixture package rejects the production project ref and any non-QA ref.
- RLS and trusted RPC boundaries were not changed by this block. No direct
  client-to-CRM access was introduced.
- Passwords, invitation tokens, session material and private IDs remain only
  in `.auth/cp3c1/ledger.json`, which is ignored by Git. No private file is
  tracked.

## Recovery And Cleanup

`.auth/cp3c1/prestate.json` records the sanitized prestate. The exact created
row handles are in the private ledger. Run the source-controlled cleanup
planner with:

```text
node scripts/client-portal/cp3c1_qa_fixture_cleanup.mjs --dry-run
```

The current cleanup command is intentionally dry-run only. It lists only the
created Client B, property, five memberships and four invitations. Reused
Client A rows and the existing invoice are protected explicitly. A future
destructive cleanup needs its own exact authorization and postcheck.

## Verification

Read-only QA postcheck after fixture creation:

| Invariant | Result |
|---|---|
| QA counts | 9 clients, 3 properties, 8 invoices, 6 memberships, 4 invitations |
| Applications / consents | 0 / 0 |
| Applicant memberships | 0 |
| Created Client B / property | Present with active status |
| Membership states | Active, suspended and revoked states present |
| Invitation states | Pending, expired, revoked and accepted present |
| Production writes/deploy/auth mutations | 0 |
| Known CP-3B.4 invoice mutation | 0 |
| Cleanup dry-run | Pass |

Normal password sign-in and end-to-end authorization journeys remain runtime
certification work for CP-3C.2. Provider verification and invitation delivery
remain deferred to their existing roadmap gates. This fixture gate is ready
without claiming those later journeys as complete.

## Package

- Plan: `scripts/client-portal/cp3c1_qa_fixture_plan.mjs`
- Cleanup: `scripts/client-portal/cp3c1_qa_fixture_cleanup.mjs`
- Tests: `scripts/client-portal/cp3c1FixturePackage.test.mjs`
- Manifest: `scripts/client-portal/cp3c1_qa_package.manifest.json`
