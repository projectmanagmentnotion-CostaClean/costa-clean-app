# CP-3B.2A exact QA authorization V2

## Current authorization state

`NOT_GRANTED`

This document specifies a future authorization contract. It is not an
authorization and must not be interpreted as one.

## Exact scope of a future authorization

The only permitted remote target is Supabase QA:

`kpvvydthlxupjjqqdpxy`

The prohibited production target is:

`wfxnwfcdjainpojhbdri`

The only permitted migration is:

`supabase/migrations/20260728160000_portal_reviewed_change_contract.sql`

Its required SHA-256 is:

`4030c67ba82f353cd81345a59fca8ee0c3088affd0869c8d9e744c02f24bb544`

The only permitted execution entrypoint is:

```text
node scripts/client-portal/run-cp3b2a-qa-v2.mjs --execute
```

There is no npm execute alias.

## Required future human statement

A future instruction must explicitly:

1. authorize CP-3B.2A V2 application;
2. name the QA project ref exactly;
3. name the exact committed and pushed Git HEAD;
4. identify the V2 authorization ID exactly;
5. authorize only the frozen migration and runner;
6. retain the prohibition on production, WordPress and SiteGround.

Earlier CP-2B, CP-3B.0, CP-3B.2A V1 or generic QA authorization does not
satisfy this contract.

## Required private inputs

All values must be loaded privately and never printed:

- `CP2B_QA_DATABASE_URL`
- `SUPABASE_ACCESS_TOKEN`
- `CP3B2A_PRIVATE_BACKUP_MANIFEST`

The database URL must resolve to one of these exact identities:

- direct: host `db.kpvvydthlxupjjqqdpxy.supabase.co`, user `postgres`,
  database `postgres`, port `5432`, `sslmode=require`;
- pooler: a `*.pooler.supabase.com` host, user
  `postgres.kpvvydthlxupjjqqdpxy`, database `postgres`, port `5432` or
  `6543`, `sslmode=require`.

Substring or hostname-spoof matches are rejected.

## Required execution pins

Only after exact future human authorization, all of these must be set:

```text
CP3B2A_EXECUTION_AUTHORIZED=true
CP3B2A_PROJECT_REF=kpvvydthlxupjjqqdpxy
CP3B2A_V2_AUTHORIZATION_ID=CP3B2A-QA-V2-AUTHORIZATION-PENDING
CP3B2A_V2_AUTHORIZED_HEAD=<exact authorized 40-character HEAD>
CP3B2A_PRIVATE_BACKUP_MANIFEST=<private verified manifest for that HEAD>
```

The authorization ID remains deliberately pending in the prepared package. A
future human instruction must quote it exactly and bind it to the final HEAD.

## Required preflight immediately before authorization

After the CP-3B.2A.1 closeout commit is pushed, rerun privately:

```text
node scripts/client-portal/run-cp3b2a-qa-v2.mjs --plan
node scripts/client-portal/run-cp3b2a-qa-v2.mjs --preflight
```

The new private manifest must show:

- status `COMPLETE`;
- QA project ref;
- exact authorized local and `origin/main` HEAD;
- frozen migration SHA-256;
- eight present artifacts with matching hashes.

The preflight generated before the closeout commit is stale by design and must
not be reused.

## Mandatory stop conditions

Stop before any remote effect if any condition is true:

- local HEAD, `origin/main`, authorized HEAD or backup HEAD differs;
- branch is not `main`, worktree is dirty, or main diverges;
- any package, frozen dependency or migration hash differs;
- the local Supabase link is not QA;
- QA is not linked in the CLI or production is linked;
- the PostgreSQL identity is not an exact QA match;
- a CP-2B or CP-3B.0 prerequisite is absent;
- any V2 function, column, constraint or index already exists;
- either broad customer policy or legacy service-role grant is missing;
- a synthetic fixture collision exists;
- the private backup is absent, incomplete, outside `.git/cp3b2a-private`,
  belongs to another HEAD, or differs from live prestate;
- any secret appears in arguments or versioned files.

## Authorized effect boundary

If every pre-effect gate passes, one application attempt may:

- add four nullable columns;
- add two constraints and four indexes;
- add three private and four public functions;
- remove two broad customer read policies;
- revoke two legacy service-role execute grants.

It may not:

- alter canonical client or property values;
- alter historical request values;
- create or update Auth users outside the rolled-back synthetic matrix;
- alter financial or fiscal rows or sequences;
- write migration history;
- modify Storage, Edge Functions, frontend, production, WordPress or SiteGround.

## Required success evidence

A successful future run must report:

- one application attempt;
- complete postcheck;
- `PASS_ROLLED_BACK` transactional matrix;
- zero synthetic residue;
- final postcheck equal to the private prestate for every protected digest;
- zero production writes.

Only then may CP-3B.2 be reconsidered. CP-3B.3 remains out of scope.

## Recovery

On failure after application, the runner makes one guarded recovery attempt and
does not retry application. The rollback is prohibited when V2 request rows
exist. An unverified recovery requires manual inspection and a new human
decision.
