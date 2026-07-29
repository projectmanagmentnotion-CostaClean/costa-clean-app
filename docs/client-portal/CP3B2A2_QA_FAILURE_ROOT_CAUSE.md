# CP-3B.2A.2 — QA failure root cause

Date: 2026-07-29

## Confirmed root cause

`V2_RUNNER_OBSERVABILITY_DEFECT`: the frozen V2 runner discarded the original
post-apply failure detail.

The V2 migration was applied once, the first post-apply operation started, and
the matrix did not start. The guarded recovery ran once and restored the exact
prestate. The frozen V2 runner then discarded the original exception and
replaced it with `qa_application_failed_recovery_completed`.

## Original remote trigger

`UNKNOWN — requires a separately authorized instrumented V3 execution`.

The original SQL assertion, PostgreSQL error, parser error or transport error
cannot be recovered from V2 evidence. Claiming a particular function, index,
grant, policy or digest as the remote failure would be speculative.

## Sanitized incident record

| Field | Evidence |
|---|---|
| Last completed stage | `apply` |
| First failed stage | `postcheck` |
| Apply committed | yes |
| Postcheck started | yes |
| Postcheck JSON returned | not recorded by V2 |
| Matrix started | no |
| Recovery attempts | 1 |
| Recovery result | exact prestate restored |
| Automatic retries | 0 |
| Sanitized failure code | `V2_POST_APPLY_FAILURE_DETAIL_NOT_RETAINED` |

No private path, database identifier, internal UUID, token, payload or real
person appears in this report.

## Exact failed assertion

The exact demonstrated failed assertion below is the runner's
incident-observability
contract:

- object: `executeV2 post-apply failure telemetry`;
- assertion: preserve the first failure before recovery;
- expected: sanitized stage, category, code, assertion, object, expected value
  and actual value;
- actual: the exception was discarded by `catch {}` and only the generic final
  recovery code was retained.

This identifies the code path and the information loss that made the original
database-level assertion unknowable. It does not satisfy the separate gate
requirement to name that original assertion/object/expected/actual; therefore
the gate cannot close.

## Technical reason

`run-cp3b2a-qa-v2.mjs`:

1. recorded stages only through `apply`;
2. invoked postcheck without `postcheck_started` or `postcheck_completed`
   markers;
3. aggregated distinct contract failures into
   `postcheck_contract_rejected`;
4. entered `catch {}` without binding the original exception;
5. wrote only stages, attempt counts and recovery state to the private report;
6. raised a new generic error after recovery.

The prior local proof validated a green disposable database and simulated a
generic post-apply recovery. It did not execute an assertion-specific failure
through the real V2 runner catch/report path. Its database also started with
empty reviewed-change tables, so the V2 matrix's global `2/1` row assertions
were not challenged by historical rows.

## Ruled-out and unresolved categories

| Category | Result |
|---|---|
| Migration defect | not demonstrated; original migration passes PostgreSQL 17 V1, V2 and V3 disposable proofs |
| Postcheck SQL defect | not demonstrated as the incident trigger; frozen V2 postcheck passes locally |
| Runner defect | demonstrated and reproduced |
| Local vs QA catalog difference | not demonstrated; both are PostgreSQL 17 |
| Incorrect grant/policy/function/index expectation | not recoverable from V2 report |
| Transport/timeout/output format | not recoverable from V2 report |

The absence of retained evidence is not converted into a claim that QA would
now pass. A future V3 attempt remains separately authorized and fail-closed.

## Safe recovered state

Independent read-only evidence after recovery confirmed:

- zero V2 columns, constraints, indexes and functions;
- both original broad customer policies restored;
- both legacy trusted service grants restored;
- zero synthetic, audit or rate-limit residue;
- historical, canonical, Auth, financial sequence and migration-history state
  unchanged;
- production, Edge, Storage, WordPress and SiteGround untouched.

## Severity and impact

Severity: `P1` for release diagnostics and retry safety.

There was no current P0 data exposure because recovery passed. The impact was
loss of the first failure evidence and therefore loss of a safe basis for
reusing V2 authorization or choosing a database correction.

## Minimal correction

No corrective migration is justified.

V3:

- keeps the frozen migration unchanged;
- rejects V1/V2 authorization identifiers;
- creates an exclusive, HEAD-bound private attempt ledger;
- records start/completion for apply, postcheck, matrix, residue, final
  postcheck and recovery;
- captures only allowlisted sanitized diagnostics;
- reconciles an ambiguous apply outcome read-only before recovery;
- validates exact objects and protected prestate;
- uses run-scoped matrix deltas compatible with historical rows;
- performs one recovery and zero automatic retries.

## Regression evidence

`node scripts/client-portal/run-cp3b2a3-local-proof.mjs` demonstrates:

- V2 diagnostic loss reproduced;
- V3 assertion retention;
- PostgreSQL 17 apply;
- frozen-state and detailed V3 postchecks;
- historical-row preservation;
- `PASS_ROLLED_BACK` V3 matrix;
- rowful rollback blocked safely;
- exact recovery, reapply and second postcheck/matrix;
- deliberate assertion-specific failure retention;
- zero retry, residue and remote contact.

## Conditions for a future authorization

CP-3B.2A.3 explicitly redefines the next safe step as an instrumented package
without claiming the missing trigger. A new human authorization must name its
final committed HEAD, QA ref and
`CP3B2A-QA-V3-AUTHORIZATION-PENDING`. It must use a fresh V3 private backup for
that exact HEAD. V2 authorization is exhausted permanently. That future V3
execution is the only allowed mechanism for resolving the original trigger;
any failure must preserve its sanitized first cause before one guarded recovery
and must not be retried automatically.
