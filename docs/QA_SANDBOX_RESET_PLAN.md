# QA Sandbox Reset Plan

## Reset Contract

Reset means restoring the entire QA datastore to a known baseline. Soft-archiving selected rows is insufficient for full-flow QA because numbered documents, relations, sequences, audit rows, and asynchronous side effects can remain.

## Initial Snapshot

After schema deployment and seed verification, capture a restorable snapshot or create a disposable branch from the approved baseline. Record privately:

- QA project fingerprint and schema version
- snapshot or branch identifier
- baseline timestamp
- counts by table and active/archive state
- maximum document number and sequence state by family
- deterministic checksums of stable fixture IDs and relationships
- configured sandbox integration modes

Do not store credentials, tokens, cookies, or row payloads in the manifest.

Current baseline: the private `sandbox-baseline-post-seed-latest` manifest records 15 deterministic `QA_DEMO_20260721` rows across eight tables, with invoices, payments, and closings at zero. A private PostgreSQL 17 plain-format dump of the QA `public` schema and those rows now exists at the ignored restore path. The dump excludes managed schemas such as `auth` and remains non-versionable.

## Reset Methods

Preferred method: discard the disposable database branch and recreate it from the baseline branch/snapshot. Alternative method: use the provider-supported atomic snapshot restore against the QA project only. Ad hoc delete loops, manual SQL cleanup, and production sequence updates are prohibited.

## Available Mechanism Classification - 2026-07-21

- A, provider snapshot/restore: unavailable on the current Supabase Free plan. Scheduled backups and PITR both require an upgrade; there is no existing preview branch.
- B, private dump/restore: capture is viable and completed for QA `public`, but a full restore was not executed. Restoring the dump over the live schema would be destructive and requires a separate explicit gate.
- C, deterministic logical reset: proven for a single non-financial lead owned by `QA_RESTORE_PROOF_20260721`.

The C proof inserted exactly one temporary lead and deleted exactly that row in a transaction-guarded cleanup. Leads returned `2 -> 3 -> 2`, all public rows returned `15 -> 16 -> 15`, the seed marker stayed at 15 rows, and invoices/payments/closings stayed `0/0/0`. This is not a full datastore restore and does not rewind sequences or external side effects.

## Post-Reset Verification

The reset passes only when all of these match the baseline:

1. Table counts and active/archive counts.
2. Stable fixture IDs and relationship checksums.
3. Numbering maxima and underlying sequence state for every document family.
4. Zero records containing the completed `qaRunId` or `QA-AUTO` run prefix.
5. Zero queued sandbox emails, payments, exports, webhooks, or fiscal jobs from the run.
6. Authentication and policies still permit the dedicated QA user to run the baseline dry-run.

Any mismatch is critical and blocks further QA.

## Cleanup Failure Handling

If registry cleanup affects zero rows, targets an unexpected row, leaves a relation, or cannot resolve a created ID, stop the flow immediately. Preserve private diagnostics, do not attempt speculative SQL repair, and invoke the full sandbox reset procedure.

## Private Evidence

Keep the following under ignored private paths:

- pre-run baseline manifest
- created-entity registry
- cleanup results
- reset provider operation metadata
- post-reset comparison
- screenshots and browser reports
- failure logs with secrets redacted at source

The final versioned report records only counts, verdicts, commands, and artifact paths.

## Production Boundary

Never point reset tooling at production, localhost with unverified production configuration, or an unknown project. The future reset command must require `QA_ENV=sandbox`, matching `QA_SANDBOX_PROJECT_REF`, explicit operator approval, and one of the allowed strategies: `snapshot-restore` or `branch-discard`.

## Current Authorization Boundary

`npm run qa:sandbox:restore-proof` reproduces the guarded QA-only dump capture and one-row logical cleanup proof without printing credentials. The post-cleanup visual and dry-run baselines pass `360/360` and `588/588`.

This evidence permits proposing bounded non-financial write-and-clean as the next separately authorized gate only where the cleanup registry identifies and removes the exact created row. It does not authorize destructive reset, full-submit, invoices, payments, fiscal writes, sequence repair, provider restore, full-dump restore, migration-history repair, or `db push`.
