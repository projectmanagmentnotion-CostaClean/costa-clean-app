# CP-3B.2A exact QA authorization V3

## Current state

Package status:

`PREPARED_NOT_AUTHORIZED`

QA application status:

`READY_PENDING_EXPLICIT_V3_AUTHORIZATION`

Authorization ID:

`CP3B2A-QA-V3-AUTHORIZATION-PENDING`

This document defines a future authorization contract. It is not authorization
and no V3 `--execute` command ran in CP-3B.2A.3.

## Exact target and frozen artifact

- permitted project: QA `kpvvydthlxupjjqqdpxy`;
- prohibited project: production `wfxnwfcdjainpojhbdri`;
- frozen migration:
  `supabase/migrations/20260728160000_portal_reviewed_change_contract.sql`;
- migration SHA-256:
  `4030c67ba82f353cd81345a59fca8ee0c3088affd0869c8d9e744c02f24bb544`;
- corrective migration: none;
- V2 authorization: consumed and permanently rejected.

## Future entrypoint

```text
node scripts/client-portal/run-cp3b2a-qa-v3.mjs --execute
```

There is no npm execute alias.

## Required future human authorization

A future prompt must explicitly name:

1. CP-3B.2A QA application V3;
2. QA ref `kpvvydthlxupjjqqdpxy`;
3. the exact clean committed and pushed 40-character HEAD;
4. `CP3B2A-QA-V3-AUTHORIZATION-PENDING`;
5. the frozen migration and exact V3 manifest;
6. one application attempt and at most one guarded recovery;
7. zero automatic retry;
8. continued prohibition of production, WordPress and SiteGround.

No prior authorization satisfies this contract.

## Private inputs

Loaded without printing:

- `CP2B_QA_DATABASE_URL`;
- `SUPABASE_ACCESS_TOKEN`;
- `CP3B2A_PRIVATE_BACKUP_MANIFEST`.

Required execution pins:

```text
CP3B2A_EXECUTION_AUTHORIZED=true
CP3B2A_PROJECT_REF=kpvvydthlxupjjqqdpxy
CP3B2A_V3_AUTHORIZATION_ID=CP3B2A-QA-V3-AUTHORIZATION-PENDING
CP3B2A_V3_AUTHORIZED_HEAD=<exact authorized HEAD>
CP3B2A_PRIVATE_BACKUP_MANIFEST=<fresh V3 manifest for that HEAD>
```

Any V1/V2 authorization variable blocks execution.

## Fresh preflight

After the V3 package commit is pushed:

```text
node scripts/client-portal/run-cp3b2a-qa-v3.mjs --plan
node scripts/client-portal/run-cp3b2a-qa-v3.mjs --preflight
```

The private backup must be `COMPLETE`, contain the exact eight safe artefacts,
match live recovered prestate, be bound to the exact final HEAD and preserve
the complete exact policy/grant boundary. Additional target-table policies,
even under new names, are boundary drift. A backup from any earlier HEAD is
stale.

## Mandatory stops

Stop before apply on:

- branch, HEAD, divergence or worktree mismatch;
- V1, V2, V3 or migration hash mismatch;
- stale, incomplete, tampered or wrong-HEAD backup;
- used/tampered V3 ledger;
- V1/V2 authorization;
- non-QA local, CLI or PostgreSQL identity;
- production linked or present in target material;
- prerequisite or recovered-boundary drift;
- reviewed contract already present or partial;
- synthetic collision against the actual V3 run ID;
- secret exposure.

## Future effect and diagnostics

One authorized attempt may apply the frozen contract and run the transactional
synthetic matrix. It may not mutate migration history, canonical CRM content,
financial/fiscal data, Auth Admin, Edge, Storage, production, WordPress or
SiteGround.

V3 persists and verifies its private sanitized primary failure before any
recovery. Recovery is attempted once only after a confirmed apply and exact
eligibility. Apply ambiguity, partial state, V2 rows or concurrent drift stop
for manual verification. The original remote trigger remains unknown until
that separately authorized execution.
