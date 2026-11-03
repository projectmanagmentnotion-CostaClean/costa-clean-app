# V3 / P0 migration reconciliation — read-only snapshot

**Snapshot:** 2026-11-03. **Scope:** local Git evidence plus read-only ledgers/catalog metadata for Production `wfxnwfcdjainpojhbdri` and QA `kpvvydthlxupjjqqdpxy`. No migration, ledger repair, restore, deployment, or data query was run.

## Result

- Production ledger: 28 entries, ending `20260924100831`; QA ledger: 99 entries, ending `20261002135207`.
- PR #28 contributes 18 migration files. The exact source SQL for the first five is in the local V3 Git history. Production ledger entries under remapped versions have stored-statement MD5 values matching the source MD5s recorded in the release evidence. Read-only catalog checks confirm the principal N11/N21 relations and functions exist in Production. Those five are **VERIFIED as already represented in Production**; do not replay them or repair the ledger in this change.
- QA records related N11/N21 entries, but the stored-statement hashes differ from the PR source for all five. The corresponding principal objects exist. This establishes material presence, not SQL equivalence. Treat QA as a divergent migration lineage; do not skip/replay based on names.
- The other 13 PR #28 migrations are absent from the Production ledger. QA contains related migrations and current capture objects for most of them, but has different versions and/or SQL hashes. The final `expense_product_grant_hardening` entry is absent from both ledgers. See `supabase/qa/bootstrap/v3-p0-release-manifest.json` for every version, hash, object contract, dependency, and action.
- Production currently has no `expense_capture_sessions`, extraction, normalization, or confirmation relations. QA has those relations. No customer rows were inspected.

## Exact future SQL order (prepared, not authorized or executed)

Do not run PR #28’s first five files again against Production. After their exact Production ledger mapping is reviewed, the pending Production sequence is:

1. N51 smart expense capture.
2. N52 document extraction foundation.
3. N52 runtime R2 guards.
4. N52 runtime R2 owner parameter.
5. N52 R21 contract parity.
6. N52 R22 idempotency scope.
7. N53 normalization runtime.
8. N55 confirmation.
9. N55 concurrency hardening.
10. N55 OpenAI provider contract.
11. Invoice service-reference override.
12. N56 security hardening.
13. Expense product grant hardening.
14. P0 expense/RPC hardening, last.

This ordering follows dependencies and SQL chronology. The “first five already represented” finding applies to Production only. QA requires a separate exact-content/version reconciliation before a CLI operation. N56 recreates `expenses` policies and Storage rules; it must precede P0. P0 then applies the internal access wrapper, financial owner/admin/finance policy, and final authenticated privilege restrictions. Reversing that order reopens the reviewed risk.

## Baseline and duplicate prefix

The QA-only schema baseline has been moved byte-for-byte from `supabase/migrations` into `supabase/qa/bootstrap/`. Its SHA-256 remains `57B4DD8AE3A772394D77A44D6D0CBA81CD0BCE933120B152B97465F080799386`. Both live ledgers were checked for the baseline’s short filename version and its historically proposed alias; neither project records either version. It was historically applied to QA by `psql`, outside Supabase migration history. This makes it a bootstrap artifact, not an applied incremental migration. Ten local PostgreSQL proof harnesses and the local repair-proof runner now resolve it from the QA bootstrap path. Historical evidence documents keep their original path references as provenance.

The baseline is a public-schema-only snapshot. It excludes managed Auth/Storage state, rows, sequence state, owners, and ACLs, and is stale relative to current QA/Production. It is suitable only for historical/local bootstrap tests with additional explicit platform setup; it cannot reconstruct a faithful current Supabase environment and must never be passed to Production.

## Backup and restore rehearsal (not run)

Dashboard metadata showed six physical scheduled database backups; the latest observed timestamp was `2026-11-03 03:29:25 UTC`. Presence is verified; data completeness, integrity, point-in-time coverage, and successful restore are not. PITR was not enabled. Supabase states that database backups do not include Storage object bytes.

Before a Production migration, the owner must separately approve cost, privacy, and access for an isolated restore target. The rehearsal procedure is:

1. Select a known backup timestamp and record provider backup ID, project, region, retention window, and reported status without exporting it into a developer workspace.
2. Restore to a dedicated isolated non-production target with production app credentials, outbound integrations, emails, cron, and webhooks disabled. Restrict access to named operators; do not point the deployed app at the restore.
3. Verify restore completion and compare schema/ledger inventories, required tables/functions/triggers/extensions, RLS and grants, sequence state, and approved aggregate/count checks against a pre-backup reference. Do not emit client records into logs or reports.
4. Independently copy the exact Storage buckets/objects needed for rollback into encrypted, access-controlled, versioned object storage. Capture a non-sensitive manifest of bucket/key, size, checksum/ETag, content type, and backup time; verify object counts and checksums.
5. Restore a representative object set into an isolated bucket and compare checksums/metadata. A database-only restore is not sufficient if expense receipts or client media must survive rollback.
6. Record measured restore duration, missing-object handling, access controls, and cleanup authorization. Keep the target until the rehearsal evidence is reviewed; delete it only under a separate explicit authorization.

For a future release, prepare a provider snapshot plus the separate object backup first. If migration verification fails, stop rollout and restore the isolated rehearsal-tested backup/objects under the approved incident procedure. Do not improvise reverse SQL for destructive/security changes; P0 rollback may re-open financial access and therefore needs a separately reviewed security rollback, not an automatic down migration.

## Static validation

Run:

```powershell
node scripts/ops/validate-v3-production-migration-preflight.mjs
```

This local-only checker validates pinned source refs, all 18 ordered V3 files, the P0 source, baseline exclusion and hash, unique migration versions, and the required N56 → grant hardening → P0 suffix. It makes no network or database calls and is not a substitute for isolated PostgreSQL/Supabase execution.

## Frozen proof harnesses and test classification

The ten modified client-portal runners differ from the base commit only in the baseline path literal; the baseline bytes and SHA-256 are unchanged. This confirms the intended source transformation, but it does not authorize rewriting the old proof identities. The CP-2B V6 compatibility suite verifies transitive V5 artifact hashes, while the CP-3B.2A V6 runner compares protected worktree blobs against the authorized base commit `a9977eafa6e4873a5d3aae64c0bd4dc64c5cece2`. Refreshing V2–V5 manifests alone would leave those V6 guards failing and would make the prior proof chain appear newly certified without a new QA run. Therefore historical manifests and documentation pins remain unchanged; the moved-path edits are not certified by the old frozen chain.

The prior 22-failure run classifies as follows:

- 18 failures are downstream hash/proof-chain failures caused by the ten one-line runner path edits, including manifest cascades and V6’s authorized-blob guard. They are not product regressions, but cannot be cleared by editing old pins in place.
- 1 failure is environmental: `supabase_cli_target_missing`. No Supabase CLI executable or installed `node_modules/supabase/bin/supabase` target is available in this worktree. No installation was attempted.
- 2 failures are V3 recurring-plan UI assertions against older copy than the implementation on this `main` base; the relevant tests and component are part of the V3 tree and do not touch the reconciliation changes.
- 1 additional failure was the Windows Vitest temp-directory `EPERM` rename. Running serially with `TEMP`/`TMP` inside the worktree avoids that runner-level failure.

The affected portal suite before hash regeneration reported 222 passed, 20 failed, and 4 skipped. A temporary manifest recalculation reduced the count to 17 failures but triggered V6 frozen-chain/worktree integrity rejections; that experiment was discarded and all 14 generated manifest edits were restored. The final full run therefore remains the authoritative legacy result: 162 files, 150 passed and 12 failed; 867 tests passed, 22 failed and 4 skipped. The V3 recurring tests were not edited. The new vNext certificate below provides an independent local proof for the relocated baseline and migration-matrix metadata; it does not clear or replace the old V6 gate, which remains fail-closed against its authorized base.

## QA baseline vNext certificate

`scripts/ops/qa-baseline-vnext.mjs` and `scripts/ops/qa-baseline-vnext.test.mjs` provide an independent local certificate with manifest ID `COSTACLEAN-QA-BASELINE-VNEXT-20261103`. It reads the relocated baseline, Git's original baseline blob at `a9977eafa6e4873a5d3aae64c0bd4dc64c5cece2`, the 18-entry release manifest, and V6-named worktree blobs. It makes no network, database, migration, or deployment calls. Its four focused tests pass. This certifies the baseline relocation and matrix metadata only; `legacyV6Gate` remains `NOT_CERTIFIED_BY_VNEXT`, and the historical full suite still reports 22 failures as detailed above.

## Remaining evidence gates

1. Retrieve/review QA’s stored statement arrays for the hash-divergent same-version entries and compare their function bodies, grants, policies, triggers, and effective contracts against PR sources. Current principal-object existence is insufficient.
2. Reconstruct a faithful disposable Supabase prestate; the moved baseline alone is insufficient. No local PostgreSQL/Docker was available in prior verified attempts.
3. Run the complete ordered migration chain and P0 matrix on that isolated prestate, including real grants/RLS/RPC/Storage behavior and rollback.
4. Complete and review a data-bearing restore rehearsal, including Storage, and obtain explicit owner approval for any QA/Production writes.
5. Review GitHub workflow behavior and make the PR merge sequence explicit. PR #28 and #30 remain unchanged and unmerged by this preparation.
