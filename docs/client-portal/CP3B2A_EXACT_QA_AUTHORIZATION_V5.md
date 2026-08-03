# CP-3B.2A exact QA authorization V5

Status: `NOT GRANTED`

Authorization ID:

`CP3B2A-QA-V5-AUTHORIZATION-PENDING`

This document defines a future human gate. Its presence does not authorize
execution.

## Immutable identity

- QA target: `kpvvydthlxupjjqqdpxy`
- prohibited production target: `wfxnwfcdjainpojhbdri`
- migration:
  `supabase/migrations/20260728160000_portal_reviewed_change_contract.sql`
- migration SHA-256:
  `4030c67ba82f353cd81345a59fca8ee0c3088affd0869c8d9e744c02f24bb544`
- authorized HEAD: the future final V5 commit quoted exactly by a human
- backup: fresh, complete, private and bound to that exact HEAD

All V1, V2, V3 and V4 authorization variables and IDs are rejected.

## Required private inputs

The values must remain private and must not be printed:

- `CP2B_QA_DATABASE_URL`, exact QA PostgreSQL with TLS required;
- `SUPABASE_ACCESS_TOKEN`, only for read-only CLI identity verification;
- `CP3B2A_PROJECT_REF=kpvvydthlxupjjqqdpxy`;
- `CP3B2A_V5_EXECUTION_AUTHORIZED=true`;
- `CP3B2A_V5_AUTHORIZATION_ID=CP3B2A-QA-V5-AUTHORIZATION-PENDING`;
- `CP3B2A_V5_AUTHORIZED_HEAD=<exact final V5 HEAD>`;
- `CP3B2A_PRIVATE_BACKUP_MANIFEST=<fresh manifest for that HEAD>`.

## Commands

Allowed during CP-3B.2A.5:

```text
node scripts/client-portal/run-cp3b2a-qa-v5.mjs --plan
node scripts/client-portal/run-cp3b2a-qa-v5.mjs --preflight
```

Not authorized during CP-3B.2A.5:

```text
node scripts/client-portal/run-cp3b2a-qa-v5.mjs --execute
```

There is intentionally no npm execute alias.

## Future one-shot limits

- maximum apply attempts: `1`;
- maximum recovery attempts: `1`;
- automatic retries: `0`;
- migration-history writes: `0`;
- corrective migrations: `0`;
- second `--execute`: prohibited.

The future human authorization must acknowledge committed temporary synthetic
fixtures, observer-confirmed commit state, exact cleanup, the complete
transactional capability map and `MANUAL_VERIFICATION_REQUIRED` for ambiguous
commit or unverifiable cleanup.

Production, WordPress, SiteGround, frontend, invoices, Auth Admin, Edge
Functions and Storage remain prohibited.
