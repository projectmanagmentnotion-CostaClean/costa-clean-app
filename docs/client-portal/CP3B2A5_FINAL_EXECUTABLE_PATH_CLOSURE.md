# CP-3B.2A.5 — Final executable-path safety closure V5

Date: 2026-07-30

Status: `DONE — LOCAL PACKAGE PREPARED_NOT_AUTHORIZED`

CP-3B.2A.5 replaces the blocked V4 executable package without modifying the
reviewed-change migration or any V1, V2, V3 or V4 artifact. It closes only the
three demonstrated P1 findings.

## P1-A — Ambiguous fixture COMMIT

V5 creates and retains the complete synthetic fixture inventory before asking
PostgreSQL to commit. The fixture path uses these explicit states:

1. `NOT_STARTED`
2. `TRANSACTION_STARTED`
3. `COMMIT_REQUESTED`
4. `COMMIT_CONFIRMED`, `COMMIT_NOT_APPLIED` or `COMMIT_AMBIGUOUS`
5. `CLEANUP_STARTED`
6. `CLEANUP_CONFIRMED`

An independent PostgreSQL observer reads the exact Auth user, client, property,
membership, request and audit inventory after the commit request. Exact
presence permits the concurrency matrix. Exact absence stops without cleanup.
Partial state, observer failure or inconclusive state becomes
`MANUAL_VERIFICATION_REQUIRED`. That outcome does not run speculative cleanup,
DDL recovery or a second apply.

The observer also counts every unexpected run-scoped Auth, client, property,
membership, request and audit row plus both fixture rate-limit subjects.
Exact absence is accepted only when the observer returns the complete eight-key
counter schema with no missing or extra fields and every value is zero. Empty,
partial, extra-field or nonnumeric evidence is ambiguous.

PostgreSQL 17 commits the expected fixtures, then injects one unexpected client
from the post-COMMIT observer. The proof confirms the committed and unexpected
rows remain untouched, the reviewed-change contract remains installed, and the
runner returns `MANUAL_VERIFICATION_REQUIRED` without cleanup or DDL recovery.
Only the disposable proof harness then removes its synthetic rows and verifies
zero residue.

The exact run ID, Auth UUID, membership UUID, client ID and property ID are
persisted only in the mode-0600 private attempt ledger before the fixture
transaction. Concurrency errors are normalized into the diagnostic envelope
without exposing that inventory in public output.

Cleanup is allowed only from `COMMIT_CONFIRMED`. A second observer must prove
exact absence before `CLEANUP_CONFIRMED`.

## P1-B — Complete executed matrix

`cp3b2a_qa_matrix_v5.sql` is the executable orchestrator. It executes both
frozen transactional matrices in the remote path and emits a typed V5
capability envelope only after both succeed.

The versioned capability map records:

`requirement → executable stage → assertion ID → artifact → executeV5Core`

It includes session and membership states, active roles, cross-client and
same-client isolation, archived/deleted/missing properties, invalid payload and
allowlist cases, sequential idempotency, receipt stability, requester-only
listings, response minimization, real two-session concurrency and residue
checks. A canonical 52-ID list lives in the runner independently of the JSON
map, so removing a requirement from the map is itself rejected. The runner also
rejects missing runtime assertion evidence.

## P1-C — Backup versus live prestate

The V5 execute path never creates or replaces a backup. It:

1. verifies the supplied private backup and exact HEAD;
2. reads the recovered live prestate;
3. compares every protected count/digest and the policy/grant boundary digest;
4. creates the private local attempt ledger;
5. rereads the same live sentinel;
6. compares it with the same authorized prestate;
7. starts the single apply immediately.

Mismatch before apply becomes `BLOCKED_BEFORE_REMOTE_EFFECTS` with zero apply
attempts and zero recovery attempts.

Protected values include reviewed-change objects, request rows, canonical CRM
digests, Auth, financial sequences, migration history, audit and rate limiting.
The comparison also includes prerequisites, portal-table cardinality, target
function/column/constraint/index counts, broad-policy count, legacy grants and
synthetic-collision count.
The private V5 backup wraps the fresh immutable V3 backup with an additional
digest for `ENABLE RLS` and `FORCE RLS` on both reviewed-change request tables.
Preflight and execute compare that digest, policies/grants and all protected
prestate fields against a second live drift sentinel. Recovery must restore the
same complete boundary before it can be marked recovered.

## Executable path

`executeV5Core` is the only ordered core. The real `--execute` command and the
PostgreSQL 17 disposable proof use this same core. Its 26 stages are frozen and
tested from manifest verification through ledger completion.

The proof injects all 16 required failure points: backup mismatch, sentinel
drift, apply transport ambiguity, postcheck, transactional matrix, fixture
BEGIN, confirmed/not-applied/ambiguous COMMIT, observer timeout, partial
inventory, concurrent retry/conflict, cleanup, final digest and recovery.
Primary and recovery failures remain separate. Once `apply` starts, an
ambiguous transport result is recovery-eligible and is never reported as zero
effects.

Maximum apply attempts: `1`.

Maximum recovery attempts: `1`.

Automatic retries: `0`.

V1–V4 authorizations are rejected. There is no npm execute alias.

## Scope and remote state

- QA remote writes in CP-3B.2A.5: `0`
- production writes: `0`
- frontend functional changes: `0`
- invoice functional changes: `0`
- Auth Admin, Edge and Storage changes: `0`
- migration-history changes: `0`

V5 remains `PREPARED_NOT_AUTHORIZED`. A future execution requires a new exact
human authorization bound to the final V5 HEAD and a fresh private backup.
