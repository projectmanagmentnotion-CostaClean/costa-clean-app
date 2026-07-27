# CP-2B exact QA authorization V4

Status: `PREPARED / NOT EXECUTED / AWAITING EXPLICIT AUTHORIZATION`
Prepared: 2026-07-27
Authorization ID: `CP2B-V4-AUTHORIZATION-PENDING`

This document does not authorize CP-2B. A future user prompt must name and authorize the exact clean CP-2A.3 commit that contains these hashes. A commit cannot safely authorize itself.

Allowed QA target: `kpvvydthlxupjjqqdpxy`
Prohibited production target: `wfxnwfcdjainpojhbdri`

WordPress, SiteGround, `/portal`, CP-3, real customer data, financial/fiscal writes and migration-history operations remain prohibited.

## V4 immutable hashes

| Artifact | SHA-256 |
|---|---|
| `scripts/client-portal/cp2b_apply_v4.sql` | `d8e9ca99f4ea3727afb0b8a3546db21f94a15988595b4ee4165a5f6a5af620cf` |
| `scripts/client-portal/run-cp2b-qa-v4.mjs` | `1846725f09f4dd18fa60a8becac60db7a613ad3d1ebcf508f32a96f363f33c66` |
| `scripts/client-portal/run-cp2a3-bootstrap-proof.mjs` | `ba7bbb9a1ad23c6328579a626925603542286196670fe5a594ff8ccbc861d826` |
| `scripts/client-portal/cp2a3BootstrapV4.test.mjs` | `089783b9b527e4feed30e1ff33bdfcfba97b8f76c025f6ffbaa562f13dd3091a` |

Machine-readable source: `scripts/client-portal/cp2b_qa_package_v4.manifest.json`.

The manifest also freezes:

- 5/5 V3 hashes;
- 8/8 V2 hashes;
- 16/16 original hashes;
- migration SHA-256 `ea10b4b3db30f6b27f60cd8fff6c8a7c711636e1d6ac439337966f5736cc6277`.

## Future HEAD and private backup

No HEAD is authorized by this document.

Before any future `--execute`:

1. the user must name the exact clean CP-2A.3 commit;
2. local HEAD and `origin/main` must equal that commit;
3. a fresh private schema backup and catalog snapshot must be created against QA;
4. the private backup manifest must be `COMPLETE`, reference only QA, and bind exactly to that authorized HEAD;
5. the prior blocked incident ledger must remain preserved and must never be reused;
6. the new run must start with a new empty ledger path.

All private material stays under `.git/cp2b-private/` or another ignored private location.

## Nine private inputs

All must be loaded without printing:

- `CP2B_QA_DATABASE_URL`
- `CP2B_ACTIVE_STAFF_USER_ID`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORTAL_INVITATION_PEPPER`
- `PORTAL_RATE_LIMIT_PEPPER`
- `PORTAL_ALLOWED_ORIGIN`

Future V4 controls must exist only in the authorized process:

- `CP2B_PROJECT_REF=kpvvydthlxupjjqqdpxy`
- `CP2B_EXECUTION_AUTHORIZED=true`
- `CP2B_V4_AUTHORIZATION_ID=CP2B-V4-AUTHORIZATION-PENDING`
- `CP2B_V4_AUTHORIZED_HEAD=<exact explicitly authorized commit>`
- `CP2B_PRIVATE_BACKUP_MANIFEST=<new private manifest for that commit>`

## Non-mutating commands

```text
npm run qa:client-portal:cp2b-v4-plan
npm run qa:client-portal:cp2b-v4-preflight
```

CP-2A.3 executed only the non-mutating commands and local/disposable proofs.

## Future execution command

Only a new explicit V4 authorization may permit:

```text
node scripts/client-portal/run-cp2b-qa-v4.mjs --execute
```

There is intentionally no npm execute alias. V2 and V3 prompts cannot authorize V4.

## Future QA-only scope

The future authorized scope is limited to:

- ten synthetic Auth users with runtime UUIDs;
- V4 apply of the immutable migration;
- exactly one real active internal-staff bootstrap;
- synthetic suspended staff inserted only by frozen V2 fixtures;
- ledger-owned fixtures;
- four frozen Edge Functions;
- private `invoice-documents` bucket;
- two synthetic non-fiscal PDFs;
- SQL and HTTP denial matrices;
- exact ID/key/UUID cleanup;
- zero-residue proof.

## Stop conditions

Stop before mutation for:

- wrong branch, HEAD, remote HEAD or dirty worktree;
- missing or ambiguous V4 authorization;
- any production target or production-linked CLI;
- any original, V2, V3, V4 or migration hash mismatch;
- invalid or stale private backup;
- missing private input;
- unconfirmed active staff identity;
- non-QA database, CLI or local link;
- a pre-existing ledger selected for the new run;
- synthetic collision or secret exposure.

Stop during execution for any unexpected schema, policy, grant, RPC, Edge, Storage, tenancy, invitation, document, service-request, financial, sequence, cleanup or ledger result.

## Recovery

On any failure after mutation:

1. use only the frozen V2 recovery;
2. revoke portal RPC execution first;
3. delete Storage objects by exact ledger keys;
4. delete fixtures by exact IDs;
5. delete Auth users by exact UUIDs;
6. apply the frozen rollback only when the migration was applied;
7. preserve a `blocked` ledger;
8. verify zero residue;
9. do not retry automatically.

Invitation delivery remains `NOT IMPLEMENTED`.
