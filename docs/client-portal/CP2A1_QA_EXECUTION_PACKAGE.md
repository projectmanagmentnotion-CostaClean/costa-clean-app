# CP-2A.1 — QA-compatible execution package

Date: 2026-07-27
Status: `DONE — SOURCE/LOCAL ONLY`
Remote status: `CP-2B BLOCKED_PENDING_EXPLICIT_V2_AUTHORIZATION`

## Why this corrective gate exists

The frozen CP-2A package was intentionally local-disposable. Its fixtures and cleanup rejected QA, its runner rejected `--execute`, and its authorization matrix used fixed Auth UUIDs. A future QA execution would therefore have required changing frozen files or improvising unreviewed SQL. CP-2B was correctly stopped before any remote write.

CP-2A.1 creates a separate V2 package. The original 16 artifacts and `CP2B_EXACT_QA_AUTHORIZATION.md` remain byte-for-byte unchanged. This gate does not authorize or execute QA.

## V2 architecture

```text
explicit V2 authorization + exact HEAD + clean tree + manifest
  -> triple QA identity + production rejection
  -> verified private backup + private pre-state catalog
  -> Admin API creates synthetic Auth users and returns real UUIDs
  -> private .git/cp2b-private ledger records exact created identifiers
  -> frozen migration + parameterized fixtures
  -> four frozen Edge deployments + exact private Storage objects
  -> SQL matrix + HTTP/Edge denial matrix
  -> exact-key Storage cleanup + exact-ID SQL cleanup + exact-UUID Auth cleanup
  -> zero-residue reconciliation
```

The runner exposes `--plan`, `--preflight`, and `--execute`. There is deliberately no npm script for `--execute`. Execution additionally requires `CP2B_EXECUTION_AUTHORIZED=true`, an exact authorization ID, an explicitly authorized HEAD, a clean tree, all private inputs, an exact QA URL/DB target, and a verified private backup manifest.

## Synthetic Auth lifecycle

Ten future Auth users are generated through the Supabase Admin API: suspended staff, A/B admins and members, pending, suspended, revoked, unverified, and invitee. Auth supplies each UUID. Emails use a unique `CP2B_RUN_ID` and `example.invalid`; random passwords exist only in process memory. The package never links identity by email and never reuses a real customer.

The active QA staff UUID is the only pre-existing identity. It must be supplied privately and manually verified. Suspended staff is synthetic; no second real staff UUID is needed.

## Private ledger

Each run uses `cp2b-<random UUID>` and a new mode-0600 JSON ledger below `.git/cp2b-private/`. The ledger contains only:

- the run ID;
- exact Auth UUIDs returned by Admin API;
- exact generated row IDs;
- exact Storage object keys;
- state transitions and timestamps.

Passwords, tokens, emails, secrets, peppers, connection strings, authorization headers, and PII are rejected by ledger validation. A pre-existing ledger path is a stop condition.

The state machine is:

`initialized -> backup_complete -> auth_users_created -> migration_applied -> staff_membership_verified -> fixtures_created -> edge_deployed -> storage_verified -> matrix_passed -> cleanup_started -> cleanup_complete -> auth_users_deleted -> zero_residue_verified -> completed`

Any active stage may move to `rollback_required` or `blocked` only along reviewed transitions. This permits an interrupted cleanup to resume from exact identifiers without broad searches.

## Parameterization and cleanup

All Auth UUIDs and every synthetic canonical/portal row ID enter SQL as `psql` variables. PL/pgSQL blocks copy those values into session settings before use, avoiding fixed UUIDs and avoiding invalid `psql` interpolation inside dollar-quoted bodies.

Fixtures create only two synthetic clients and their minimum properties, draft quotes, jobs, draft non-fiscal invoices/lines, portal memberships/applications/invitations/requests, document registries, and one suspended synthetic staff row. They create no payment, closing, issued fiscal invoice, number, or sequence mutation. Trigger suppression is transaction-local and limited to deterministic canonical fixtures.

Cleanup uses exact IDs and keys from the private ledger. It has no `TRUNCATE`, global `DELETE`, `email LIKE`, date window, prefix search, or real-user deletion. It proves fixture absence and exactly one active membership for the real QA staff identity before commit.

## Failure recovery

`cp2b_qa_failure_recovery_v2.sql` is the reviewed disable-first path. It:

1. rejects production and unknown targets;
2. revokes `authenticated` execution only from public functions named `portal_*`;
3. invokes exact-ID V2 cleanup;
4. invokes the frozen rollback;
5. lets the runner delete Storage keys and Auth users by exact identifiers;
6. leaves the ledger `blocked` after any failed run, even when compensation succeeds.

It does not revoke or rewrite unrelated operational/financial RPCs. A failed Edge deployment cannot be restored automatically to a previous remote bundle; the database surface is disabled/dropped by rollback, and the exact deployed-function state remains incident evidence requiring authorized operator review.

## Local proof

`npm run qa:client-portal:cp2a1-proof` creates a temporary loopback PostgreSQL 17 cluster with minimal Auth/Storage compatibility schemas, asks PostgreSQL to generate eleven runtime Auth UUIDs (including active and suspended staff), applies the frozen migration, runs V2 fixtures/matrix/cleanup/recovery, deletes exact Auth IDs, proves zero residue, and discards the cluster.

It also proves rejection of production, an unknown target, a missing required variable, an altered manifest hash, and a pre-existing ledger.

This is substantive SQL/RLS/RPC proof, but it is not equivalent to Supabase Cloud. It does not prove managed Auth Admin API behavior, JWT/AAL claims, PostgREST schema cache, Edge deployment/runtime, private Storage signing, provider logs, or Cloud grants. Those remain mandatory CP-2B evidence.

## Private inputs for a future CP-2B

Names only:

- `CP2B_QA_DATABASE_URL`
- `CP2B_ACTIVE_STAFF_USER_ID`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORTAL_INVITATION_PEPPER`
- `PORTAL_RATE_LIMIT_PEPPER`
- `PORTAL_ALLOWED_ORIGIN`

Execution controls additionally require `CP2B_PROJECT_REF`, `CP2B_EXECUTION_AUTHORIZED`, `CP2B_V2_AUTHORIZATION_ID`, `CP2B_V2_AUTHORIZED_HEAD`, and `CP2B_PRIVATE_BACKUP_MANIFEST`. They are authorization/target controls, not substitutes for the nine private inputs.

Current source-only preflight reports all nine runtime inputs `MISSING` in this process. Their absence does not fail CP-2A.1 and does prevent any claim of CP-2B readiness.

## Stop conditions

Stop before mutation on any target mismatch, production occurrence, dirty tree, unauthorized HEAD, missing authorization, hash drift, missing/invalid backup, non-empty ledger, missing/invalid private input, inability to prove exact active staff identity, or missing rollback artifact.

After mutation, stop and run reviewed recovery on any unexpected catalog, RLS, Edge, Storage, cross-client, sequence, cleanup, audit, or privacy result. Never use `db push`, `db pull`, migration repair, migration-history writes, email identity matching, real customer fixtures, or production.

## Commands executed in CP-2A.1

```text
npm run qa:client-portal:cp2a1-proof
npx vitest run scripts/client-portal/cp2a1Package.test.mjs --config vitest.config.mjs
npm run qa:client-portal:cp2b-v2-plan
npm run qa:client-portal:cp2b-v2-preflight
```

Only local/source checks were run. QA writes, production writes, remote Auth users, Edge deployments, remote Storage objects, WordPress changes, and CP-3 work were all zero.

## Remaining risk and debt

- Managed Supabase behavior remains unproved until an exact future CP-2B.
- Invitation delivery remains unavailable because the frozen member Edge intentionally has no delivery adapter.
- Successful live invoice-download Edge proof would create auditable state; the V2 HTTP matrix therefore proves anonymous, cross-client, and suspended denials, while the SQL matrix proves the successful exact-path/60-second contract transactionally.
- The private backup must be produced and verified outside Git before authorization.
- Edge deployment rollback cannot recreate an unknown prior bundle automatically.
- No legal or professional approval is asserted by this engineering package.
