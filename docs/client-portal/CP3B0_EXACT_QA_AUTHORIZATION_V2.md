# CP-3B.0 Exact QA Authorization V2

Date: 2026-07-28

Status: `PREPARED / NOT EXECUTED / AWAITING EXPLICIT AUTHORIZATION`

Authorization ID: `CP3B0-QA-V2-AUTHORIZATION-PENDING`

This document does not authorize a remote change.

## Exact target

- permitted future project: Costa Clean QA `kpvvydthlxupjjqqdpxy`;
- prohibited project: production `wfxnwfcdjainpojhbdri`;
- expected effect: one function
  `public.portal_resolve_self_access_context()`;
- expected table/Auth/Storage/Edge/history effects: zero.

## Frozen evidence

The future prompt must name the exact clean commit containing:

- `scripts/client-portal/cp3b0_qa_package_v2.manifest.json`;
- the unchanged V1 manifest and all nine V1 artifact hashes;
- the unchanged CP-2B V5 chain;
- migration SHA-256
  `c6161ddb4d5d85e139aea98a47429feae21d20dd06c5e3d54b579f58c5468731`.

V1 authorization cannot authorize V2. CP-2B or CP-3B.1 permission cannot
authorize this application.

## Required private controls

Before a future `--execute`, rerun V2 `--preflight` on the exact clean
authorized commit. The generated private backup manifest must:

- be below `.git/cp3b0-private/`;
- be `COMPLETE`;
- identify only QA;
- be tied to the exact authorized local/remote HEAD;
- verify all eight private artifacts and hashes;
- match the immediate live catalog, table-grant, policy, function and migration
  history prestate.

The private database connection is loaded only by dot-sourcing the existing
ignored private PowerShell file. Its contents, connection string, tokens,
passwords, internal UUIDs and full private paths are never printed.

## Future exact invocation contract

Only a later human prompt may set:

```text
CP3B0_EXECUTION_AUTHORIZED=true
CP3B0_PROJECT_REF=kpvvydthlxupjjqqdpxy
CP3B0_V2_AUTHORIZATION_ID=CP3B0-QA-V2-AUTHORIZATION-PENDING
CP3B0_V2_AUTHORIZED_HEAD=<exact clean future commit>
CP3B0_PRIVATE_BACKUP_MANIFEST=<exact verified private manifest>
```

Then, and only then, the permitted command is:

```text
node scripts/client-portal/run-cp3b0-qa-v2.mjs --execute
```

No npm alias, `db push`, `db pull`, migration repair or migration-history
registration is permitted.

## Mandatory stop conditions

Stop before effects on any:

- V1, V2, CP-2B or migration hash mismatch;
- wrong/dirty/diverged Git state;
- missing, stale or mismatched private backup;
- local, CLI or PostgreSQL identity not exactly QA;
- production linked or present as target;
- offline PostgreSQL or failed live read;
- CP-2B prerequisite/table mismatch;
- new function already present;
- catalog, grants, policy, history or synthetic collision mismatch;
- secret/private artifact in arguments, output or Git.

After apply, any postcheck, matrix or residue failure invokes the one-function
rollback once and stops `BLOCKED`; the runner never retries.

## Current boundary

```text
CP-3B.0A: DONE — SOURCE/LOCAL/PREFLIGHT ONLY
CP-3B.0 QA APPLICATION: READY_PENDING_EXPLICIT_V2_AUTHORIZATION
CP-3B.1: BLOCKED_PENDING_CP3B0_QA
CP-3B.2: NOT STARTED
```
