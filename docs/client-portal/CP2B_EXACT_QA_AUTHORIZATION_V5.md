# CP-2B exact QA authorization V5

Status: `PREPARED / NOT EXECUTED / AWAITING EXPLICIT AUTHORIZATION`
Prepared: 2026-07-27

This document does not authorize CP-2B. No HEAD is authorized yet. A future
prompt must name the exact clean commit containing this package, accept every
hash below and require a fresh private backup bound to that same HEAD.

Allowed QA target: `kpvvydthlxupjjqqdpxy`
Prohibited production target: `wfxnwfcdjainpojhbdri`
Authorization ID: `CP2B-V5-AUTHORIZATION-PENDING`

## V5 hashes

| Artifact | SHA-256 |
| --- | --- |
| `scripts/client-portal/cp2b_postgres_transport_v5.mjs` | `4d5b4654655921d145e9ff9f21ee3227646ac9709362bff30e708b21f62e4c90` |
| `scripts/client-portal/run-cp2b-qa-v5.mjs` | `be6e9fe7bccddb2b1d4c98df0af64366ba8057acd569189ecb4b99b38386bd22` |
| `scripts/client-portal/run-cp2a4-postgres-transport-proof.mjs` | `f0ed9d289a9ff93ee8f5778bcb3c247b952c2876adba1346a28d21c6b8b28b17` |
| `scripts/client-portal/cp2bPostgresTransportV5.test.mjs` | `24942fc0168a7003ee2a206ba675da82b6120282deb093af888bb57cc2e94a20` |

The V5 manifest also freezes:

- V4: 4/4 artifacts;
- V3: 5/5 artifacts;
- V2: 8/8 artifacts;
- original: 16/16 artifacts;
- migration:
  `ea10b4b3db30f6b27f60cd8fff6c8a7c711636e1d6ac439337966f5736cc6277`.

## Required future authorization

A future prompt must provide and accept:

1. the exact clean V5 commit and matching `origin/main`;
2. all V5 and reused hashes;
3. the QA target and explicit production rejection;
4. a new private backup and catalog snapshot bound to that HEAD;
5. nine private inputs loaded without printing;
6. the prior blocked ledger preserved and a new execution ledger absent;
7. `CP2B_EXECUTION_AUTHORIZED=true`;
8. `CP2B_V5_AUTHORIZATION_ID=CP2B-V5-AUTHORIZATION-PENDING`;
9. `CP2B_V5_AUTHORIZED_HEAD=<exact authorized commit>`.

No earlier authorization carries forward.

## Non-mutating commands

```text
npm run qa:client-portal:cp2b-v5-plan
npm run qa:client-portal:cp2b-v5-preflight
```

The preflight performs authenticated read-only CLI/PostgreSQL checks. It must
create no ledger, Auth user, schema, Edge deployment, secret or Storage object.

## Future execute command

Only a later prompt satisfying every condition above may invoke:

```text
node scripts/client-portal/run-cp2b-qa-v5.mjs --execute
```

There is intentionally no npm execute alias.

## Stop conditions

Stop before effects if any of these occurs:

- HEAD, worktree, manifest, hash or private backup mismatch;
- QA local/CLI/PostgreSQL identity mismatch;
- any production reference;
- PostgreSQL connectivity failure;
- active staff UUID absent;
- portal schema/table/bucket/function or synthetic residue;
- an existing ledger selected for the new run;
- a secret found in arguments, logs, Git or a non-private file.

Connectivity failure must return `BLOCKED_BEFORE_REMOTE_EFFECTS` with zero new
ledger, zero Auth users and zero remote mutations.

## Recovery

After effects begin, the frozen V2 disable-first recovery and exact identifiers
remain authoritative. The prior blocked incident ledger is preserved and never
reused. Cleanup may target only IDs and object keys recorded by the new ledger.

Production, WordPress, SiteGround, `/portal`, CP-3, invoices, payments, fiscal
closings, numbering, migration history and `db push` remain prohibited.
