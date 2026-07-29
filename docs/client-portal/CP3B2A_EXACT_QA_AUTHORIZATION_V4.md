# CP-3B.2A exact QA authorization V4

Status: `NOT GRANTED`

Authorization ID:

`CP3B2A-QA-V4-AUTHORIZATION-PENDING`

This document is a future human gate. It does not authorize execution by its
presence in the repository.

## Immutable identity

- target: Supabase QA `kpvvydthlxupjjqqdpxy`
- prohibited target: production `wfxnwfcdjainpojhbdri`
- migration:
  `supabase/migrations/20260728160000_portal_reviewed_change_contract.sql`
- migration SHA-256:
  `4030c67ba82f353cd81345a59fca8ee0c3088affd0869c8d9e744c02f24bb544`
- authorized HEAD: the future final V4 commit, stated verbatim by a human
- backup: a complete private backup bound to that exact HEAD

V1, V2 and V3 authorizations are rejected and cannot be reused.

## Required private inputs

Execution requires all of the following without printing their values:

- `CP2B_QA_DATABASE_URL`, with TLS required and QA identity;
- `SUPABASE_ACCESS_TOKEN`, only where the read-only CLI identity check needs it;
- `CP3B2A_PROJECT_REF=kpvvydthlxupjjqqdpxy`;
- `CP3B2A_V4_EXECUTION_AUTHORIZED=true`;
- `CP3B2A_V4_AUTHORIZATION_ID=CP3B2A-QA-V4-AUTHORIZATION-PENDING`;
- `CP3B2A_V4_AUTHORIZED_HEAD=<exact final V4 HEAD>`;
- `CP3B2A_PRIVATE_BACKUP_MANIFEST=<private manifest for the same HEAD>`.

The runner rejects production, non-TLS targets, wrong or divergent HEAD,
non-main branch, dirty worktree, stale backup, local/CLI/PostgreSQL identity
mismatch, frozen hash drift and an existing V4 attempt ledger.

## Commands

Allowed now:

```text
node scripts/client-portal/run-cp3b2a-qa-v4.mjs --plan
node scripts/client-portal/run-cp3b2a-qa-v4.mjs --preflight
```

Not authorized now:

```text
node scripts/client-portal/run-cp3b2a-qa-v4.mjs --execute
```

There is intentionally no npm execute alias. A future authorization must quote
the final HEAD, QA ref, authorization ID and migration hash exactly. It must
also acknowledge one migration apply attempt, one recovery attempt, zero
automatic retries, committed synthetic concurrency fixtures, exact cleanup and
the `MANUAL_VERIFICATION_REQUIRED` stop condition.

Production, WordPress, SiteGround, Auth Admin, Storage, Edge Functions,
frontend and invoice changes remain prohibited.
