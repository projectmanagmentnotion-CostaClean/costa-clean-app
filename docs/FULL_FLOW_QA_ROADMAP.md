# Full-Flow QA Roadmap

## Status - 2026-07-21

- Current phase: Phase 1 configuration and isolation passed; blocked on QA schema delivery.
- Available: isolated Supabase QA target, populated ignored `.env.qa.local`, matching fingerprint, `snapshot-restore` strategy, and isolated authenticated browser profile.
- Missing: an authorized reviewed schema-only baseline, complete ordered migrations, synthetic seed, baseline capture, and executed restore proof.
- Executed: sandbox visual structure check and non-writing dry-run. The dry-run stopped at `489/510` because required application tables are absent.
- Not started: seed/baseline, write-and-clean, full submit, and total reset.
- Production remained untouched and no QA entities were created.

## Phase 1 - Sandbox Provisioning

- Create a separate Supabase QA project or disposable branch manually.
- Apply reviewed schema, policies, functions, and migrations through the controlled path.
- Create `.env.qa.local` from `.env.qa.example` and configure a dedicated QA user.
- Verify project fingerprint and sandbox integrations.

Exit gate: sandbox wrapper validates configuration without printing values; production remains unchanged.

Current result: configuration and project separation pass, but Phase 1 cannot close until the reviewed application schema is present and its REST surface is verified.

Repository audit result: classification `C`. The repo does not contain the core base table definitions, and a read-only QA probe reports all audited application tables missing. The next action is an authorized schema-only export and review, not execution of the loose historical SQL folder.

## Phase 2 - Demo Seed And Baseline

- Implement deterministic synthetic seed data.
- Configure sandbox-only fiscal/document series.
- Capture row-count, relationship, numbering, sequence, and integration baselines.
- Create the provider snapshot or baseline branch.

Exit gate: seed is repeatable and baseline is restorable.

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
