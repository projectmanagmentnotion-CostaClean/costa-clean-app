# CP-2B exact QA authorization V3

Status: `PREPARED / NOT EXECUTED / AWAITING EXPLICIT AUTHORIZATION`
Prepared: 2026-07-27
Future authorized HEAD: no HEAD is authorized by this document. A future prompt must name the exact clean CP-2A.2 commit.

Allowed target: `kpvvydthlxupjjqqdpxy` only.
Prohibited production target: `wfxnwfcdjainpojhbdri`.
Authorization ID: `CP2B-V3-AUTHORIZATION-PENDING`.
WordPress, SiteGround, `/portal`, and CP-3: prohibited.

This document prepares but does not grant authorization. Environment variables, private files, a linked CLI, or an earlier V2 authorization do not authorize V3.

## V3 frozen hashes

| Artifact | SHA-256 |
|---|---|
| `scripts/client-portal/cp2b_command_launcher_v3.mjs` | `392bfc23a17a709a59a0e592366677be2554e81fe1d01d9553a7903b832fbb85` |
| `scripts/client-portal/cp2b_v3_preload.mjs` | `7fe7f172a71fc6cff4d6fdc080622c8a181f9c6430f5387ba0e8d5502fe8f256` |
| `scripts/client-portal/run-cp2b-qa-v3.mjs` | `77fbd921c8eea3d72aff41a6d43136cb60ed4220033351ae8c44e42e640534a6` |
| `scripts/client-portal/cp2bWindowsLauncherV3.test.mjs` | `e8a78d86248a6ae54ef281cdebd8f836df9a99e2a4bbdc545559c91f43668a92` |
| `scripts/client-portal/run-cp2a2-windows-proof.mjs` | `0a0eebb97c9577ccedf4078db296e1602c96b0a88de590cde79a9c7fece0e233` |

Machine-readable source of truth: `scripts/client-portal/cp2b_qa_package_v3.manifest.json`.

## Reused V2 hashes

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

## Reused original hashes

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

All nine inputs must be loaded without printing and report `PRESENT`:

- `CP2B_QA_DATABASE_URL`
- `CP2B_ACTIVE_STAFF_USER_ID`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORTAL_INVITATION_PEPPER`
- `PORTAL_RATE_LIMIT_PEPPER`
- `PORTAL_ALLOWED_ORIGIN`

The private backup manifest must be `COMPLETE`, identify only QA, match the future explicitly authorized HEAD, contain absolute private artifact paths, and verify every SHA-256. A fresh catalog snapshot and empty-ledger check are mandatory.

## Future commands

These commands are non-mutating:

```text
npm run qa:client-portal:cp2b-v3-plan
npm run qa:client-portal:cp2b-v3-preflight
```

Only a separate explicit authorization may permit:

```text
node scripts/client-portal/run-cp2b-qa-v3.mjs --execute
```

There is intentionally no npm execute alias.

## Future mutation scope

The permitted QA scope remains exactly the reviewed V2 scope: ten synthetic Auth users, frozen migration, exact active/suspended staff boundary, ledger-owned synthetic fixtures, four frozen Edge deployments, private `invoice-documents` bucket, two non-fiscal PDFs, SQL and HTTP denial matrices, exact cleanup, zero-residue proof, and reviewed disable-first recovery. V3 removes the private PostgreSQL URL from child arguments and supplies the parsed connection only through `PG*` environment variables.

Production, WordPress, SiteGround, `/portal`, CP-3, real users/data/PII, fiscal invoices, payments, closings, financial sequences, migration history, `db push`, `db pull`, repair, broad cleanup, email identity matching, and improvised SQL remain prohibited.

## Stop conditions

Stop before mutation on any wrong/dirty HEAD, target ambiguity, production appearance, original/V2/V3/migration hash mismatch, missing input, invalid backup, non-empty ledger, unconfirmed staff UUID, CLI/database/local-link mismatch, pre-existing collision, or secret exposure.

Stop during execution on any unexpected schema/policy/grant/function/bucket state, canonical exposure, cross-client allow, inactive/anonymous allow, invitation replay, document TTL/path mismatch, service-request side effect, financial/sequence drift, cleanup failure, Auth deletion failure, or ledger inconsistency.

## Recovery

After any mutation failure, the frozen V2 recovery remains authoritative: revoke portal RPC execution first, clean exact ledger IDs/keys/UUIDs, run the frozen rollback where applicable, preserve a `blocked` ledger, verify residue, and do not improvise or reconstruct an unknown prior Edge bundle.

Invitation delivery remains `NOT IMPLEMENTED`; a future run may validate token hash, expiry, revocation, and single-use but must not claim that an email was sent.
