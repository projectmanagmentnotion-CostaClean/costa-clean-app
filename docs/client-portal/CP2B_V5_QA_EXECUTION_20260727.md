# CP-2B V5 Supabase Cloud QA Execution

Date: 2026-07-27

Status: `PASS — QA SECURITY BOUNDARY ACTIVE`

Authorized source HEAD: `d82d44a696287c50cca88541aaf96614c3d833a6`

QA project: `kpvvydthlxupjjqqdpxy`

Production project: prohibited and untouched

## Scope and authorization

The exact V5 package was executed once under a user authorization that accepted
the V5, V4, V3, V2, original and migration hashes. A fresh private schema
backup and catalog snapshot were verified against the authorized HEAD before
effects. The database URL and other trusted credentials remained outside
process arguments, logs and Git.

The authorization covered only Supabase Cloud QA. Production, WordPress,
SiteGround, `/portal`, CP-3, migration history, `db push`, financial writes,
fiscal records and real customer data were outside scope.

## Pre-effect gate

The immediate preflight passed:

- local and remote Git HEAD matched the authorized commit and the worktree was
  clean;
- all immutable hash groups and the migration hash passed;
- nine private inputs were present;
- local link, Supabase CLI and PostgreSQL all identified QA while production
  was rejected;
- the exact active staff UUID existed;
- portal tables, schema, functions, bucket, synthetic users and synthetic
  objects were absent;
- the previous blocked ledger was preserved and no new execution ledger
  existed.

The enforced order remained:

`postgres_pre_effect_check -> ledger_create -> auth_create`

## Execution result

The V5 runner was invoked exactly once and returned `PASS`.

- one new private ledger reached `COMPLETED`;
- ten synthetic Auth users were created with runtime UUIDs;
- the V4 apply wrapper and frozen migration completed;
- exactly one active internal staff membership was retained for the confirmed
  staff identity;
- eleven portal/security tables were created with RLS and `FORCE RLS`;
- the SQL authorization and cross-client matrix passed;
- all four frozen Edge Functions were deployed;
- the `invoice-documents` bucket exists and is private;
- two non-fiscal synthetic PDF objects were uploaded for the document checks;
- the HTTP Edge denial matrix passed;
- invitation token hashing, expiry, revocation, single use and replay denial
  passed;
- service requests remained `pending_review`;
- the invoice document contract remained limited to a 60-second signed URL.

Invitation email delivery was not implemented or claimed.

## Cleanup and independent reconciliation

The runner completed exact-ID cleanup and the independent post-run audit found:

- synthetic Auth users remaining: `0`;
- synthetic portal/canonical fixtures remaining: `0`;
- synthetic Storage objects remaining: `0`;
- total objects in `invoice-documents`: `0`;
- active internal staff memberships: `1`;
- portal tables: `11`;
- RLS / `FORCE RLS`: `11/11`;
- portal Edge Functions: `4/4`;
- portal bucket: private;
- prior blocked ledger: preserved;
- new execution ledger: `COMPLETED`;
- invoices, payments and quarterly closings: unchanged at `0/0/0`;
- public sequence catalog: byte-equivalent JSON state to the private pre-run
  snapshot.

Recovery was not invoked because the runner and cleanup completed successfully.

## Validation

- CP-2B V5 runner: `PASS`;
- independent live QA catalog/Auth/Storage/Edge audit: `PASS`;
- CP-2A.2 authenticated Windows proof: `PASS`;
- V4 tests: `9/9 PASS`;
- V3 tests: `22/22 PASS`;
- CP-2A.1 tests: `9/9 PASS`;
- CP-2A.3, CP-2A.1 and CP-2A disposable PostgreSQL proofs: `PASS`;
- complete suite: `324 passed`, `4 skipped`;
- lint: `PASS`;
- build: `PASS`.

The frozen CP-2A.4 proof and three authenticated V5 test cases are explicitly
pre-effect checks. After a successful CP-2B apply they return
`portal_prestate_rejected` because they require zero portal tables, functions
and bucket. Their remaining 33 V5 cases pass. This is a post-deployment harness
limitation, not evidence of boundary or cleanup failure; the frozen artifacts
were not modified to conceal it.

## Remaining debt and next gate

- invitation email delivery remains `NOT IMPLEMENTED`;
- legal content remains pending verified controller/provider facts and
  professional legal review;
- the pre-effect proof requires a future non-mutating post-deployment mode
  before it can be reused as a green authenticated regression;
- CP-3 remains `NOT STARTED` and requires separate authorization;
- no portal frontend or public website integration was performed.

All backups, snapshots and ledgers remain private under the ignored Git area.
No private path, secret, real UUID, token or synthetic credential is included
in this report.
