# CP-3B.2A.3 — V3 failure observability package

Date: 2026-07-29

## Status

- Gate: `CP-3B.2A.3 — DONE`
- Package: `PREPARED_NOT_AUTHORIZED`
- Future QA application:
  `READY_PENDING_EXPLICIT_V3_AUTHORIZATION`
- Original remote trigger: `UNKNOWN_PENDING_V3_EXECUTION`
- Corrective migration: `NO`
- QA/production writes in this gate: `0`

This package does not resolve or guess the original remote trigger. It corrects
the demonstrated V2 observability defect so a separately authorized V3
application will either certify the reviewed contract or retain the exact
sanitized failure before restoring the recovered prestate.

## Frozen migration

V3 applies only:

`supabase/migrations/20260728160000_portal_reviewed_change_contract.sql`

SHA-256:

`4030c67ba82f353cd81345a59fca8ee0c3088affd0869c8d9e744c02f24bb544`

V1, V2, CP-2B, CP-3B.0 and the migration remain byte-for-byte frozen.

## Failure envelope

Before reconciliation or recovery, V3 writes and rereads one private envelope
under `.git/cp3b2a-private/`. It retains:

- synthetic run reference and exact failed/last-completed stage;
- stable failure code/category and sanitized SQLSTATE;
- relative artifact and SHA-256;
- stable assertion, object kind/reference and digest-bearing bounded
  expected/actual summaries;
- PostgreSQL/JSON output-presence flags;
- apply, postcheck, matrix, recovery and retry state;
- bounded, privacy-redacted stdout/stderr, full private expected/actual,
  exit code, signal and timeout;
- immutable `primaryFailure`, enforced by an exact snapshot hash and a
  recovery-only update allowlist;
- separate `recoveryFailure` when recovery itself fails.

Successful closure uses a provisional `PASS_PENDING_LEDGER` report. It becomes
`PASS` only after the terminal ledger transition. A failed transition
invalidates the candidate before recovery; a report-finalization failure after
an already completed ledger never triggers rollback.

The public closure allowlist contains only stage, failure code/category,
assertion ID, object kind, bounded expected/actual and recovery outcome.
Connections, credentials, known secret values, JWTs, private paths, UUIDs,
emails, Spanish phone/tax identifiers, payloads and snapshots are not public
output.

## Parser and process classification

The runner distinguishes:

- PostgreSQL SQL failure and allowlisted SQLSTATE;
- assertion failure with exact V3 assertion ID;
- empty output;
- absent, malformed, duplicated or wrong-kind JSON;
- transport failure;
- timeout;
- process signal/abort;
- matrix failure;
- recovery failure.

`ON_ERROR_STOP=1` and verbose PostgreSQL diagnostics are mandatory. Raw process
evidence is held only long enough to create the redacted private envelope.

## Recovery and retry

Mandatory order:

1. capture `primaryFailure`;
2. persist and verify the private envelope;
3. determine whether recovery is eligible;
4. run recovery at most once;
5. update `recoveryOutcome` and optional `recoveryFailure`;
6. emit the allowlisted closure.

Apply attempts are exactly one and automatic retries are zero. A confirmed
apply may recover only when target counts, protected audit/rate state and the
HEAD/package/backup-bound ledger remain eligible. Every ledger transition
rechecks the exact original HEAD, run ID and backup-manifest hash against the
in-memory execution context. An ambiguous timeout with a present or partial
contract stops at `MANUAL_VERIFICATION_REQUIRED`; it is not rolled back
speculatively. Any V2 row blocks destructive rollback.

## Assertion contract

The postcheck uses stable families for:

- columns, relative order and historical nulls;
- normalized constraints;
- indexes, method, keys, predicate, uniqueness, readiness and immediacy;
- function signature, volatility, security definer, owner, search path,
  comments and exact ACL grantor/grantability;
- the complete target-table policy set, including table-to-policy mapping,
  roles, command, exact `USING`/`WITH CHECK`, and rejection of every extra
  policy, plus RLS/FORCE RLS;
- legacy exact-signature grants;
- historical, canonical, Auth, financial-sequence, audit/rate and
  migration-history digests.

Expected and actual values come from the failed assertion. Public summaries
are bounded, redacted and carry a digest when truncated; the private envelope
retains the full redacted values rather than replacing them with a generic
mismatch.

## Local failure-injection matrix

The Vitest package injects and verifies:

- precheck SQL failure;
- apply SQL failure and apply timeout ambiguity;
- postcheck SQL, assertion, malformed JSON and empty output;
- matrix SQL/envelope failure;
- residue and final-postcheck failure;
- recovery SQL failure;
- primary/recovery separation;
- process nonzero, SQLSTATE, timeout and signal;
- V2 generic detail loss versus V3 retained assertion;
- persist/verify-before-recovery ordering;
- primary-failure tamper rejection and recovery-only envelope updates;
- provisional success-report invalidation on ledger failure and no recovery
  after an already completed ledger;
- exact ledger-context tamper and real V3 collision rejection;
- secret/JWT/phone/DNI/NIE/company-CIF redaction;
- zero retry and one recovery maximum;
- public allowlist and secret redaction.

The PostgreSQL 17 disposable proof validates baseline, CP-2B, CP-3B.0, frozen
apply, V2/V3 postcheck, rejection of an injected extra permissive target-table
policy and an injected function grant option (with exact expected/actual ACL),
historical-safe transactional matrix, rowful rollback denial and exact
recovery. It then drives the actual V3 core with local PostgreSQL operations
through apply, a deliberate catalog assertion failure, private-file persist,
reread-before-recovery, guarded rollback and restored prestate. A final reapply,
second postcheck/matrix and rollback leave zero audit/rate residue.

## Authorization boundary

The only future authorization ID is:

`CP3B2A-QA-V3-AUTHORIZATION-PENDING`

V1/V2 authorization is rejected. The future execution additionally requires
exact clean local/remote HEAD, QA target, production rejection, a fresh
HEAD-bound private backup, exact manifest hashes and an unused ledger. This
gate executed only local proofs and read-only planning/preflight.

## Remaining uncertainty

The demonstrated root cause is:

`V2_RUNNER_OBSERVABILITY_DEFECT`

The original remote trigger remains:

`UNKNOWN_PENDING_V3_EXECUTION`

Only a separately authorized instrumented V3 application can resolve that
uncertainty. CP-3B.2 remains blocked until the V3 QA application passes.
