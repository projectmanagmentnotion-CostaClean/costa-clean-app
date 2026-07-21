# Full-Flow QA Roadmap

## Status - 2026-07-21

- Current phase: Phase 2 baseline plus classification-C logical restore proof passed; bounded Phase 4 write-and-clean is the next separately authorized gate.
- Available: isolated QA target, applied schema, idempotent `QA_DEMO_20260721` seed, private post-seed baseline, private `public` dump, exact-marker cleanup proof, and authenticated browser profile.
- Missing: provider/full-dump restore execution and migration-history reconciliation before future `db push`.
- Executed: seed dry-run/apply/idempotence, temporary lead cleanup `2 -> 3 -> 2`, authenticated visual QA `360/360`, and non-writing sandbox dry-run `588/588` with zero flow-created entities.
- Not started: write-and-clean, full submit, and destructive reset.
- Production remained untouched; QA contains only 15 authorized synthetic seed rows.

## Phase 1 - Sandbox Provisioning

- Create a separate Supabase QA project or disposable branch manually.
- Apply reviewed schema, policies, functions, and migrations through the controlled path.
- Create `.env.qa.local` from `.env.qa.example` and configure a dedicated QA user.
- Verify project fingerprint and sandbox integrations.

Exit gate: sandbox wrapper validates configuration without printing values; production remains unchanged.

Current result: configuration, project separation, schema apply, REST visibility, RPC/policy/trigger verification, visual QA, and dry-run pass. Phase 1 is closed for the exported schema contract.

Initial repository audit result: classification `C`. The reviewed export, atomic QA apply, and post-apply verification now raise core-schema readiness to `A-`; all 17 exported tables are present and empty. The loose historical SQL folder remains prohibited as bootstrap input, and `recurring_invoice_plans` remains an explicit gap.

Export/apply result: obtained with `pg_dump 17.10`, reviewed, sanitized, and applied atomically to QA with `psql`. It contains no real data or secrets, production was not modified, and REST-backed QA now passes. `recurring_invoice_plans` remains absent from the authoritative schema and is not invented.

## Phase 2 - Demo Seed And Baseline

- Implement deterministic synthetic seed data.
- Configure sandbox-only fiscal/document series.
- Capture row-count, relationship, numbering, sequence, and integration baselines.
- Create the provider snapshot or baseline branch.

Exit gate: seed is repeatable and baseline is restorable.

Current result: deterministic seed and private post-seed count baseline pass. Supabase Free has no scheduled backup or PITR and no preview branch exists. A private QA `public` dump was captured, while deterministic marker cleanup was executed and returned the database to the 15-row baseline. This proves logical cleanup only; full provider/dump restorability remains unproven.

## Phase 3 - Sandbox Dry-Run

- Run auth, visual QA, and all current flow audits at mobile, tablet, and desktop sizes.
- Confirm every target flow opens, validates, and stops before submit.
- Include standalone job creation plus service creation from client and property workspaces.
- Keep service recurrence as an explicit policy skip until a real sandbox-backed contract exists.

Exit gate: all configured checks pass with zero writes.

## Phase 4 - Non-Fiscal Write-And-Clean

- Submit client, property, quote, expense, job, and recurring entities where cleanup contracts exist.
- Record every ID and verify downstream visibility.
- Require cleanup to affect at least one row.

Exit gate: all enabled entities are cleaned and zero run residue remains.

Authorization status: eligible as the next separate sandbox gate for non-financial flows with exact registry cleanup. It is not executed by the restore-proof sprint.

## Phase 5 - Full Sandbox Submit

- Enable the future full-submit command only after guard and reset implementation.
- Exercise quote, job/service, recurring schedule, sandbox invoice, sandbox payment, expense, and sandbox cancellation paths.
- Verify persisted relations, derived values, status transitions, numbering, previews, and exports.

Exit gate: `QA_ENV=sandbox`, both explicit allow flags, valid `qaRunId`, and approved reset strategy are proven.

## Phase 6 - Total Reset

- Restore the approved snapshot or discard/recreate the branch.
- Compare counts, IDs, relationships, numbering, sequences, integrations, and QA markers with baseline.

Exit gate: zero QA residue and exact baseline match.

## Phase 7 - Release Agent Gate

- Feed versioned evidence and private artifact references to the continuation agent.
- Require the agent to reject unsupported claims and block on any external credential, schema, deploy, auth, financial, or restoration approval.

Exit gate: agent verdict confirms that release evidence is complete and production is intact.
