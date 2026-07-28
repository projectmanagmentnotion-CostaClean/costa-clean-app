# CP-3B.0 Exact QA Authorization Package

Date: 2026-07-28

Status: `PREPARED / NOT EXECUTED / AWAITING EXPLICIT AUTHORIZATION`

This document does not authorize a database change.

## Target boundary

- only eligible future target: Costa Clean QA
  `kpvvydthlxupjjqqdpxy`;
- prohibited production target: `wfxnwfcdjainpojhbdri`;
- WordPress, SiteGround, Auth users, Edge Functions and Storage remain outside
  the package;
- `db push`, `db pull`, migration repair and migration-history writes remain
  prohibited.

## Frozen source

The canonical artifact allowlist and exact SHA-256 values are in:

`scripts/client-portal/cp3b0_self_access_context.manifest.json`

It freezes the new migration, local proof runner, reproduction and authorization
SQL, contract tests, read-only QA runner and the two CP-3B.0 contract documents.
It also records the exact CP-2B V5 manifest hash; the full original/V2–V5 chain
must continue to verify byte-for-byte before any later authorization.

No authorization can be inferred from an earlier CP-2B or CP-3 prompt. A future
human prompt must name the clean final commit containing this package and
accept the exact current manifest.

## Commands authorized now

Only source/local proof and QA read-only inspection are prepared:

```text
npm run qa:client-portal:cp3b0-proof
npm run qa:client-portal:cp3b0-plan
npm run qa:client-portal:cp3b0-preflight
```

There is deliberately no npm execute alias and no apply command in this
package. `cp3b0-preflight` opens a read-only PostgreSQL transaction, verifies
the exact QA prestate and rolls back. Its private connection input must remain
outside Git and must never be printed.

## Required future authorization

A later QA mutation gate must separately provide and verify:

1. clean `main`, exact local/remote HEAD and zero divergence;
2. every manifest hash;
3. triple QA identity and explicit production rejection;
4. a new private HEAD-bound schema backup and catalog snapshot;
5. a private backup manifest with verified hashes;
6. exact reviewed apply and rollback commands using PostgreSQL 17;
7. `ON_ERROR_STOP` and one atomic transaction;
8. pre/post catalog checks for signature, owner, volatility, `SECURITY DEFINER`,
   fixed search path and grants;
9. the complete synthetic self-context matrix and zero-residue cleanup;
10. explicit confirmation that migration history remains untouched.

The later prompt must authorize the exact migration SHA-256 and exact action.
Generic permission to continue CP-3B.1 is insufficient.

## Expected QA effect if later authorized

Only one new public function and its comment/grants:

```text
public.portal_resolve_self_access_context()
```

Expected table rows, policies, RLS rules, table grants, Auth users, Storage
objects, Edge deployments, audit events and migration-history writes: `0`.

## Stop conditions

Stop before mutation on any:

- target or hash mismatch;
- production reference or unknown database identity;
- dirty/diverged Git state;
- missing or invalid private backup;
- CP-2B artifact drift;
- existing unexpected function/poststate;
- missing `authenticated` role or CP-2B prerequisite;
- SQL outside the one-function allowlist;
- policy, table grant, Auth, Edge, Storage or history change;
- secret/private artifact in Git or output;
- test, lint, build, security or independent quality failure.

## Current result

```text
CP-3B.0 SOURCE/LOCAL PROOF: DONE
CP-3B.0 QA APPLICATION: NOT AUTHORIZED
QA REMOTE WRITES: 0
PRODUCTION WRITES: 0
CP-3B.1: BLOCKED_PENDING_CP3B0_QA
CP-3B.2: NOT STARTED
```
