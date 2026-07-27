# CP-2A.4 — PostgreSQL secret transport and pre-effect connectivity

Date: 2026-07-27
Status: `DONE / LIVE QA READ PASS / REMOTE EXECUTION NOT AUTHORIZED`
Remote writes: `0`

## Root cause

V4 passed `CP2B_QA_DATABASE_URL` as the first `psql` argument to `runCommandV3()`.
That launcher checks all arguments for sensitive environment values before
`spawnSyncCompatV3()` can call `preparePostgresInvocationV3()`. The intended
URL-to-`PG*` conversion was therefore unreachable and the command stopped with
`sensitive_argument_rejected`.

A synthetic Windows/Linux reproduction proved the validation order and recorded
zero spawned `psql` processes, zero ledgers and zero Auth effects.

## V5 transport

`cp2b_postgres_transport_v5.mjs` reads the database URL only from the supplied
private environment. It rejects production, unknown targets, invalid protocols,
malformed URLs and control characters before building a minimal child
environment.

The child receives only the required operating-system values plus:

- `PGHOST`;
- `PGPORT`;
- `PGUSER`;
- `PGPASSWORD`;
- `PGDATABASE`;
- allowlisted `PGSSLMODE`, `PGSSLROOTCERT`, `PGCONNECT_TIMEOUT`, `PGAPPNAME` and
  `PGTARGETSESSIONATTRS`.

`CP2B_QA_DATABASE_URL`, Supabase tokens/keys and portal peppers are removed from
the child environment. URL, password, keys and peppers are rejected from
arguments. The transport then calls the frozen V3 launcher with `shell: false`,
bounded output, timeout and forced redaction.

## Pre-effect order

V5 cannot create a ledger or call the Auth Admin API until all of these checks
pass:

1. V5 manifest and all reused hashes;
2. explicit V5 execution authorization, exact HEAD and clean worktree;
3. private backup bound to that HEAD;
4. local QA link;
5. Supabase CLI QA linked and production not linked;
6. live PostgreSQL read;
7. QA database target;
8. portal schema/table/bucket/function and synthetic-residue prestate;
9. exact active staff UUID in `auth.users`.

The enforced effect order is:

`postgres_pre_effect_check -> ledger_create -> auth_create`

A connectivity failure is classified as `BLOCKED_BEFORE_REMOTE_EFFECTS`.

## Evidence

The authenticated CP-2A.4 proof demonstrated:

- V4 `sensitive_argument_rejected` reproduced before spawn;
- V5 live QA `SELECT 1`;
- exact QA target and production rejection;
- active staff UUID confirmed without printing it;
- portal tables `0`, `portal_private` absent, portal Edge Functions `0/4`,
  `invoice-documents` bucket absent, synthetic Auth users `0` and synthetic
  Storage objects `0`;
- URL in child arguments `NO`;
- secret in child arguments `NO`;
- database URL in child environment `NO`;
- connectivity failure before ledger and Auth;
- unauthorized execution blocked;
- new ledgers, Auth users, Edge deploys, Storage mutations and remote writes `0`.

The V5 test package contains 36 passing cases when the private QA inputs are
loaded, including the authenticated read. The same suite skips only its three
live cases when private inputs are intentionally absent.

## Recovery and remaining risk

V5 preserves the frozen V2 disable-first recovery, exact-ID cleanup and blocked
incident ledger. A future attempt must create a new ledger and a new private
backup bound to the exact authorized V5 HEAD.

Remaining risk:

- CP-2B V5 has not executed;
- migration, Auth creation, Edge deployment, Storage verification and the
  authorization matrix remain unproved in the V5 Cloud execution path;
- invitation email delivery remains `NOT IMPLEMENTED`;
- no V1–V4 authorization can authorize V5.

Production, WordPress, SiteGround, `/portal`, CP-3, migration history and
financial/fiscal data were not modified.
