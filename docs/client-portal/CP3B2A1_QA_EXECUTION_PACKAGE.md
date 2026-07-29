# CP-3B.2A.1 — QA application execution and recovery package

## Status

- Gate: `CP-3B.2A.1`
- Source package: `DONE`
- Local disposable proof: required before closeout
- QA read-only preflight: required before closeout
- QA application: `READY_PENDING_EXPLICIT_V2_AUTHORIZATION`
- CP-3B.2: `BLOCKED_PENDING_CP3B2A_QA`
- CP-3B.3: `NOT STARTED`

This gate prepares and validates the application package. It does not authorize
or apply the reviewed-change migration.

## Frozen migration

- Path:
  `supabase/migrations/20260728160000_portal_reviewed_change_contract.sql`
- SHA-256:
  `4030c67ba82f353cd81345a59fca8ee0c3088affd0869c8d9e744c02f24bb544`
- QA project ref: `kpvvydthlxupjjqqdpxy`
- Prohibited production ref: `wfxnwfcdjainpojhbdri`

The runner verifies the complete CP-3B.2A V1 artifact chain, the CP-3B.0
prerequisite chain, the CP-2B V5 chain, and the frozen migration before it can
reach an execution effect.

## Package contents

| Artifact | Purpose |
|---|---|
| `cp3b2a_qa_precheck_v2.sql` | Read-only target, prerequisite, absence, collision, row, Auth, ACL, policy, function, financial sequence, canonical-data and migration-history evidence |
| `cp3b2a_qa_postcheck_v2.sql` | Read-only exact catalog and unchanged-state verification |
| `cp3b2a_qa_matrix_v2.sql` | Synthetic transactional authorization, idempotency, minimization, cross-client and canonical immutability matrix |
| `cp3b2a_qa_rollback_v2.sql` | Atomic exact rollback with an internal zero-V2-row guard |
| `run-cp3b2a-qa-v2.mjs` | Fail-closed `--plan`, `--preflight`, and future-authorized `--execute` runner |
| `run-cp3b2a1-local-proof.mjs` | Disposable PostgreSQL 17 apply/postcheck/matrix/recovery proof |
| `cp3b2aQaApplicationV2.test.mjs` | Package, identity, authorization, ordering, recovery and secret-handling tests |
| `cp3b2a_qa_package_v2.manifest.json` | Immutable V2 artifact and dependency chain |

## Runner modes

### `--plan`

Performs local manifest and hash verification. It exposes the exact stage order
and reports zero remote writes.

### `--preflight`

Performs read-only QA verification and creates a private backup under
`.git/cp3b2a-private/`. It:

1. requires the exact QA database identity;
2. rejects the production ref before PostgreSQL access;
3. verifies the local Supabase link is QA;
4. verifies the CLI lists QA as linked and production as not linked;
5. executes the precheck in a read-only transaction;
6. writes a schema-only dump and seven catalog/prestate snapshots;
7. hashes all eight private backup artifacts;
8. creates and verifies a private manifest bound to the current Git HEAD and
   frozen migration hash.

It does not set execution authorization and performs no remote write.

### `--execute`

The mode exists but is fail-closed. It must not be run during CP-3B.2A.1.
Future execution requires every input in
`CP3B2A_EXACT_QA_AUTHORIZATION_V2.md`, including a new exact human
authorization for the final committed HEAD.

## Pre-effect order

The runner fixes this order, with `apply` last:

1. manifest and hashes;
2. exact authorization and Git HEAD;
3. clean worktree;
4. private backup bound to the authorized HEAD;
5. local QA link;
6. Supabase CLI QA link;
7. production not linked;
8. live PostgreSQL read;
9. exact PostgreSQL QA target;
10. CP-2B and CP-3B.0 prerequisites;
11. reviewed-change contract absent;
12. catalog prestate;
13. grant, policy and migration-history digests;
14. synthetic collision check;
15. private backup equals live prestate;
16. apply.

Any failure before `apply` returns `BLOCKED_BEFORE_REMOTE_EFFECTS`.

## Postcheck contract

An authorized application must prove:

- four nullable, default-free columns;
- two validated format constraints with the expected reference patterns;
- four unique partial indexes;
- four public and three private functions with exact identities;
- `postgres` ownership;
- `SECURITY DEFINER`;
- fixed `search_path=pg_catalog`;
- expected volatility and `jsonb` return type;
- public, anonymous and service-role execute denied;
- authenticated execute only for the four public functions;
- comments on the four public functions;
- both broad customer read policies absent;
- both internal staff management policies retained;
- both legacy service-role trusted-submit grants absent;
- historical request rows unchanged, with new columns null;
- canonical CRM rows, financial sequence state, Auth users, table grants,
  unaffected policies/functions and migration history unchanged.

## Transactional QA matrix

The matrix uses only synthetic users and records inside one transaction. It
tests:

- anonymous, authenticated and service-role execute grants;
- admin and member submission;
- profile and property receipt minimization;
- atomic idempotent retry;
- idempotency conflict;
- requester-only lists;
- same-client cross-user isolation;
- direct request-table read denial;
- foreign-client, suspended and unverified denials;
- archived, deleted, foreign and missing property denials;
- canonical client/property immutability;
- audit metadata without proposed values or PII;
- exact created-row counts;
- transaction rollback and zero residue.

It does not call the Auth Admin API or create persistent QA users.

## Recovery contract

If a future authorized run fails after the single migration application:

1. recovery is attempted exactly once;
2. the rollback first rejects execution if either request table contains a
   non-null V2 idempotency key or public reference;
3. it drops only the seven V2 functions;
4. it restores exactly the two broad customer policies and two legacy
   service-role grants;
5. it removes exactly the four indexes, two constraints and four columns;
6. it verifies the V2 contract is absent;
7. it reruns the precheck and compares it with the private backup.

There is no automatic application retry. If recovery cannot be verified, the
runner stops for manual inspection.

## Private backup lifetime

The preflight run made during this gate occurs before the closeout commit. Its
backup is evidence for the starting HEAD only and cannot authorize application
from the new committed HEAD. A future exact authorization must rerun
`--preflight` after the closeout commit and use the newly generated private
manifest tied to that exact clean local and remote HEAD.

Private backup paths, connection strings, tokens, internal UUIDs and private
environment values must never be logged or committed.

## Explicit non-effects

- QA migration applications: `0`
- production writes: `0`
- Auth Admin changes: `0`
- Storage changes: `0`
- Edge Function changes: `0`
- frontend changes: `0`
- WordPress/SiteGround changes: `0`
- migration-history changes: `0`

CP-3B.2 remains blocked until a separately authorized CP-3B.2A V2 application
passes application, postcheck, transactional matrix, residue and final
postcheck.
