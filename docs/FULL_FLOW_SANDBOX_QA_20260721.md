# Full-Flow Sandbox QA - Schema Applied - 2026-07-21

## Verdict

`QA SCHEMA AND DETERMINISTIC SEED VERIFIED; RESTORE-PROOF GATE NEXT`

The reviewed baseline was applied only to Supabase QA project `kpvvydthlxupjjqqdpxy`. The target was validated from the sandbox fingerprint, the private pooler login ref, and a live authenticated database session before mutation. Production was not targeted or modified.

## Apply Result

| Gate | Result |
| --- | --- |
| Initial HEAD | `e91d815658cf255eb79b30de1756c3cb9fe84cc2` |
| QA project ref | `kpvvydthlxupjjqqdpxy` |
| Baseline | `supabase/migrations/20260721_qa_baseline_schema.sql` |
| Method | PostgreSQL 17 `psql` |
| Transaction | atomic, `ON_ERROR_STOP`, single transaction |
| Baseline applied to QA | yes |
| Production touched | no |
| Real data included | no |
| Full-submit | no |
| Destructive reset | no |

The earlier reviewed invoice-function migration and the baseline were applied in repository order in the same transaction. The direct `psql` method did not write Supabase CLI migration-history metadata; any later `db push` or history repair requires a separate reviewed gate.

## Post-Apply Schema Verification

- expected tables: 17/17 present
- required RPC names: all present
- public functions: 41
- non-internal triggers: 15
- policies: 45
- RLS-enabled tables: 17
- sequences: 9 effective sequences
- enums: 0
- initial rows: 0 across all 17 tables

Essential tables verified: `leads`, `clients`, `properties`, `quotes`, `quote_lines`, `jobs`, `invoices`, `payments`, `expenses`, and `quarterly_closings`.

The authoritative gap remains: `recurring_invoice_plans` is absent from production and QA. It was not invented during the apply.

## Deterministic Synthetic Seed

- script: `scripts/qa/seed-sandbox-demo.mjs`
- commands: `qa:sandbox:seed:dry-run` and `qa:sandbox:seed:apply`
- marker: `QA_DEMO_20260721`
- dry-run: passed before apply
- apply: passed in an atomic transaction
- idempotence: passed by dry-run plus second apply against the 15 existing marker rows
- populated tables: `leads`, `clients`, `properties`, `quotes`, `quote_lines`, `jobs`, `job_lines`, `expenses`
- counts: 2 / 2 / 2 / 2 / 2 / 2 / 2 / 1, for 15 total rows
- invoices, payments, and quarterly closings: 0
- real data: no

All emails use `example.com`; phones use the `000` range; names, tax IDs, addresses, dates, references, notes, and amounts are explicitly synthetic. Collision guards abort if a deterministic ID belongs to an unmarked record.

## Visual And Dry-Run Evidence

- authenticated visual QA: `360/360`, 42 scenarios/results across mobile, tablet, and desktop
- sandbox dry-run: `588/588`, improved from the previous `489/510`
- skipped actions: 3 guarded dry-run actions
- created entities: 0
- invoices created: 0
- payments created: 0
- post-dry-run row counts: all zero
- QA residue: 0

The first launcher attempts failed before inspection because new CDP endpoints did not start. Reusing the already healthy `.auth/sandbox` CDP session produced the successful results above. This was a harness-launch issue, not a schema or REST failure.

Private reports remain ignored under `qa-reports/private/`, and screenshots remain ignored under `qa-screenshots/private/`.

## Validation

- `npm run lint`: passed
- `npm run build`: passed, 372 modules transformed
- `npm run test`: passed, 175/175
- `npm run qa:sandbox:check`: passed
- sandbox fingerprint differs from production reference: yes
- reset strategy: `snapshot-restore`

## Safety Accounting

- production invoices issued: 0
- production payments recorded: 0
- production financial writes: 0
- production schema writes: 0
- QA financial writes: 0
- secrets printed or versioned: 0

## Next Gate

Authorize provider snapshot capture and an executed restore-proof comparison against the private post-seed baseline. Write-and-clean, destructive reset, full-submit, invoice issue, and payment registration remain separate blocked gates.
