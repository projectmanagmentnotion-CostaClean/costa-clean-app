# CP-2B exact QA authorization V2

Status: `PREPARED / NOT EXECUTED / AWAITING EXPLICIT AUTHORIZATION`
Prepared: 2026-07-27
Source parent: `b27f8809f9737728d63c8be0ba0f833681bcd414`
Future authorized HEAD: must be the exact clean commit containing this package and must be named again by the user.

Allowed target: `kpvvydthlxupjjqqdpxy` only.
Prohibited production target: `wfxnwfcdjainpojhbdri`.
WordPress: prohibited. CP-3: prohibited.

This document prepares but does not grant authorization. Setting environment variables does not grant authorization. A future prompt must explicitly name the final V2 commit, QA ref, authorization ID, mutation scope, and acceptance of these hashes.

## V2 artifact hashes

| Artifact | SHA-256 |
|---|---|
| `scripts/client-portal/cp2b_qa_auth_fixtures_v2.mjs` | `744427964926cabb1da2249ed14a34d3305059eb14b2fb7a42723e51a43e5118` |
| `scripts/client-portal/cp2b_qa_fixtures_v2.sql` | `1cf3b34f0b707596864bf44c4bfdb099833d6d4a558c395a1bdfb80abda0e600` |
| `scripts/client-portal/cp2b_qa_authorization_matrix_v2.sql` | `2b4b623540be3e298052c969a83eef1328d0b56e95095d72148e8360d40985c3` |
| `scripts/client-portal/cp2b_qa_cleanup_v2.sql` | `3ae04ea2425b3a0f305018e6c2aa71340bc9b2b9f0577f8537523dcbd70d95be` |
| `scripts/client-portal/cp2b_qa_failure_recovery_v2.sql` | `85e1926357fee9345c64eade16540a3dc3b6c67f6195fa848a8d8ad9d0aff0e9` |
| `scripts/client-portal/run-cp2b-qa-v2.mjs` | `e4bc77360b8a9b622c49f613de01ed2b9c599671404d9b1ec7514d1f34bd7aea` |
| `scripts/client-portal/run-cp2a1-local-proof.mjs` | `e368bfc7a72faaba4dc2a93b5383961f68070b5a93752aff3d48a9c9cb73891a` |
| `scripts/client-portal/cp2a1Package.test.mjs` | `8c8609970e85aa36187d691337990670ca2f689578a5d7cc72fc448a1f96e4e7` |

Machine-readable source of truth: `scripts/client-portal/cp2b_qa_package_v2.manifest.json`.

## Reused frozen hashes

| Artifact | SHA-256 |
|---|---|
| `supabase/migrations/20260723160000_client_portal_security_boundary.sql` | `ea10b4b3db30f6b27f60cd8fff6c8a7c711636e1d6ac439337966f5736cc6277` |
| `supabase/functions/_shared/portalContract.ts` | `3a474271ebe265ae53486c40407752370e7d7d4908dae975643ce0ef7548f271` |
| `supabase/functions/_shared/portalHandler.ts` | `5309116b26eec92044a3d86e7bab04f90ee82e6dd7729765e551f5b8c295f8c3` |
| `supabase/functions/portal-account-actions/index.ts` | `2c42f3ba84beb5ab766d38416fd969bc6a8e968ed39d3f758288148541cfffd9` |
| `supabase/functions/portal-service-actions/index.ts` | `6268365b2ffb3cfadde23c5fd52b2bf6e4fec9cf3e32053c3d649e0777b81024` |
| `supabase/functions/portal-member-actions/index.ts` | `d99f64e43787af5df56dafa736b2410621ced457163c4abacc18f2c737b40f3c` |
| `supabase/functions/portal-invoice-download/index.ts` | `aee337003adc848697febf2efc414996862b62ff46220e9214ad28478914ac43` |
| `scripts/client-portal/run-cp2a-local-proof.mjs` | `2d98909b9d55ada13bf036494ad18f7266bcca53f3c0f099d4a1019c97d1c891` |
| `scripts/client-portal/run-cp2b-qa.mjs` | `c0fd0806b8c7eb3fe47d732071435d4b0da2758a7659d7afaa861d6573ed1a66` |
| `scripts/client-portal/cp2a_rollback.sql` | `dfdc64a272bde2b8ddfcbab54f58ff4908f170057b4d110f77c27558b5826dee` |
| `scripts/client-portal/cp2a_fixtures.sql` | `acaf020adda30cb0f22a90195ccbf95a95017b2061a096df286fdbd8ddee504e` |
| `scripts/client-portal/cp2a_authorization_matrix.sql` | `f4734b4a91461dff7b97c68a0571c208193d4f362c7f7f1ed709baf893756845` |
| `scripts/client-portal/cp2a_cleanup.sql` | `9cbbc8c71274fdeccd4804e06e4f7fa365b177be406340689bdab5f6deab446e` |
| `scripts/client-portal/cp2b_catalog_snapshot.sql` | `ba470d3e113536d39a24cca5a42c227f8f16bf38134abcbdf1b750af51e8fce6` |
| `scripts/client-portal/cp2b_apply.sql` | `1b04a35d0e7a2a703ac36b86510d005044464236049dcf596590205dd6c914b5` |
| `supabase/config.toml` | `839c8ce0493969c851586b9768dbbfb12adf29566ad13283911b8fa58211bbd7` |

## Future private prerequisites

All nine private runtime inputs listed in the manifest must report `PRESENT`, valid format, exact QA match where applicable, and production rejection. The active staff UUID must be manually confirmed without printing it. Suspended staff is generated synthetically.

The private backup manifest path must point to JSON with:

- `version: 1`;
- `status: "COMPLETE"`;
- `projectRef` equal to QA;
- `gitHead` equal to the explicitly authorized HEAD;
- one or more private backup artifacts with absolute path and exact SHA-256.

Every backup artifact must exist and hash-match. Backup files, catalog snapshots, ledgers, Edge env files, reports, UUIDs, and secrets remain outside Git.

## Exact future commands

These commands remain inert until the separate authorization is recorded and private values are loaded without printing:

```text
npm run qa:client-portal:cp2b-v2-plan
npm run qa:client-portal:cp2b-v2-preflight
node scripts/client-portal/run-cp2b-qa-v2.mjs --execute
```

There is no npm execute alias. The last command fails unless all execution controls and private inputs pass. Do not paste values into command history or documentation.

## Expected QA mutations

Only after separate authorization:

1. Admin API creates ten synthetic Auth users and later deletes them by exact returned UUID.
2. Frozen migration creates the reviewed staff/portal schema, RLS/FORCE RLS, grants, narrow functions, and private bucket record.
3. Exact active/suspended staff membership boundary is established.
4. V2 SQL creates only ledger-owned synthetic fixtures.
5. Four frozen portal Edge Functions are deployed to QA.
6. Two synthetic non-fiscal PDF objects are uploaded to the private bucket and later deleted by exact key.
7. Transactional SQL matrix and non-mutating HTTP/Edge denial matrix execute.
8. Exact-ID/key/UUID cleanup proves zero synthetic residue.

No payment, closing, invoice sequence, migration history, real client, production, website, or CP-3 mutation is allowed.

## Stop conditions

Stop before mutation on any original/V2 hash mismatch, migration hash mismatch, unauthorized/dirty HEAD, target ambiguity, production appearance, invalid DB target, missing triple identity, missing/invalid backup, missing private input, non-empty ledger, inability to confirm active staff, or nonzero pre-existing synthetic collision.

Stop during execution on any unexpected table/policy/grant/function/bucket state, canonical exposure, cross-client allow, anonymous/inactive allow, document TTL/path mismatch, Edge generic-error mismatch, service-request side effect, sequence/financial drift, failed exact cleanup, failed Auth deletion, secret disclosure, or ledger inconsistency.

## Disable-first rollback and cleanup

On a failure after migration, the reviewed V2 recovery revokes only `portal_*` RPC execution from `authenticated`, performs exact-ID cleanup, invokes the frozen rollback, deletes exact Storage keys and Auth UUIDs, and records `blocked`. If any compensation cannot be proved, stop with the private ledger intact and do not improvise.

The prior Edge deployment cannot be automatically reconstructed; after database rollback, its portal RPC dependencies are unavailable. Any further Edge action requires explicit incident authorization.

## Mandatory evidence

- exact initial/final/remote HEAD and clean worktree;
- 16/16 original hashes and all V2 manifest hashes;
- triple target identity and production rejection;
- verified private backup and pre-state catalog;
- ledger transition record without secret material;
- dynamic Auth creation/deletion counts by role only;
- SQL and HTTP/Edge matrix totals;
- private Storage key creation/deletion counts;
- exact cleanup and zero-residue proof;
- staff regression and financial/sequence invariants;
- secret/PII/private-file scan;
- lint, build, specific and full-suite results.

Production, WordPress, and CP-3 remain prohibited regardless of CP-2B outcome.
