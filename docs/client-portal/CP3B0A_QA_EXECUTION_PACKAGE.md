# CP-3B.0A QA Application Execution and Recovery Package

Date: 2026-07-28

Status: `DONE — SOURCE/LOCAL/PREFLIGHT ONLY`

QA application: `READY_PENDING_EXPLICIT_V2_AUTHORIZATION`

CP-3B.1: `BLOCKED_PENDING_CP3B0_QA`

## Objective

Prepare a deterministic, recoverable V2 package for one future QA effect:

```text
public.portal_resolve_self_access_context()
```

This gate did not apply that function. It changed no remote schema, Auth user,
Storage object, Edge Function or migration-history row.

## Immutable inputs

The nine artifacts in
`scripts/client-portal/cp3b0_self_access_context.manifest.json` remain
byte-for-byte frozen, including `package.json`. The complete CP-2B V5 chain is
also reverified before plan, preflight or execution. The migration remains:

```text
supabase/migrations/20260728120000_portal_self_access_context.sql
SHA-256 c6161ddb4d5d85e139aea98a47429feae21d20dd06c5e3d54b579f58c5468731
```

There is no npm execute alias.

## Commands

The V2 runner accepts exactly:

```text
node scripts/client-portal/run-cp3b0-qa-v2.mjs --plan
node scripts/client-portal/run-cp3b0-qa-v2.mjs --preflight
node scripts/client-portal/run-cp3b0-qa-v2.mjs --execute
```

`--plan` is local and sanitized. `--preflight` performs authenticated QA reads
and creates a new ignored private backup. `--execute` remains blocked until a
later prompt grants the exact V2 authorization.

## Execution gate

The future runner requires all of:

- `CP3B0_EXECUTION_AUTHORIZED=true`;
- exact QA `CP3B0_PROJECT_REF`;
- exact authorization ID
  `CP3B0-QA-V2-AUTHORIZATION-PENDING`;
- `CP3B0_V2_AUTHORIZED_HEAD` equal to clean local and `origin/main` HEAD;
- zero Git divergence;
- a verified `CP3B0_PRIVATE_BACKUP_MANIFEST` tied to that same HEAD;
- intact V1, V2 and CP-2B chains;
- local link, Supabase CLI and live PostgreSQL all identifying QA;
- production not linked;
- CP-2B prerequisite and eleven portal tables present;
- the new function absent;
- unchanged catalog/history prestate and zero synthetic collisions.

Any mismatch returns `BLOCKED_BEFORE_REMOTE_EFFECTS` behavior: no apply, fixture,
Auth, Storage, Edge or history effect can start.

## Private backup

Each preflight creates a new directory below `.git/cp3b0-private/`. It does not
reuse CP-2B evidence. The private package contains:

- PostgreSQL schema-only dump;
- portal function catalog;
- table and routine grants;
- relation and function owners;
- policies;
- read-only migration-history snapshot;
- catalog/digest prestate;
- a `COMPLETE` manifest with QA ref, current Git HEAD, timestamp, private paths
  and SHA-256 for all eight artifacts.

The source-preflight backup proves the backup mechanism and current QA prestate.
It cannot authorize a later committed HEAD. After this package is committed, a
future authorization session must run `--preflight` again on the exact clean
authorized HEAD and use that newly generated manifest. Private paths and
contents must never be printed or versioned.

## Pre-effect order

The runner locks:

```text
manifest_and_hashes
→ authorization_and_head
→ clean_worktree
→ private_backup
→ local_qa_link
→ supabase_cli_qa_link
→ production_not_linked
→ postgres_live_read
→ postgres_qa_target
→ cp2b_prerequisite
→ function_absent
→ catalog_prestate
→ grants_and_policy_digest
→ synthetic_collision_check
→ postgres_pre_effect_check
→ apply
```

The migration is transported through the frozen PostgreSQL V5 boundary:
PostgreSQL 17, no connection string/password in arguments, no database URL in
the child environment and `ON_ERROR_STOP`.

## Postcheck

After a future apply, the runner requires one zero-parameter `jsonb`, `STABLE`,
`SECURITY DEFINER` function owned by `postgres`, with fixed
`search_path=pg_catalog`, a comment and execute granted only to
`authenticated`. It also proves:

- portal table rows unchanged;
- table grants and policies unchanged;
- no unexpected portal function drift;
- migration-history count and digest unchanged.

## Transactional QA matrix

The QA-specific matrix creates unique `example.invalid` Auth and CRM fixtures
inside one PostgreSQL transaction. It uses no Auth Admin API and no existing
user or client. Trigger delivery is suppressed with transaction-local replica
mode during fixture insertion; normal mode is restored before authorization
checks. The transaction always rolls back and a separate post-query requires
zero collisions/residue.

It covers anonymous denial, authenticated grant, all six states, admin/member,
multiple-client deterministic ordering, inactive minimization, precedence,
approved-without-membership, unverified user, internal staff isolation,
cross-user isolation, exact DTO keys and absence of PII.

## Recovery

If a future stage fails after apply, the runner executes exactly once:

```sql
drop function if exists public.portal_resolve_self_access_context();
```

The frozen rollback is atomic and touches no table, policy, other function or
migration history. Recovery verifies function absence and restoration of the
private prestate digest, writes a private `BLOCKED` report and never retries
the application automatically.

## Evidence

- CP-3B.0 disposable proof: pass;
- CP-3B.0A disposable apply/postcheck/matrix/recovery proof: pass;
- unauthorized execute, production, bad HEAD, dirty tree, hash, backup,
  pre-existing function and offline PostgreSQL gates: covered;
- V1/CP-2B/V2 hashes: pass;
- QA read-only preflight and private backup/snapshot: pass;
- QA/production writes, remote Auth users, Edge deploys, Storage mutations and
  migration-history writes: zero.

No frontend file changed. CP-3B.1 remains blocked.
