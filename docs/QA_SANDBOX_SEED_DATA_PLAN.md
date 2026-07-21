# QA Sandbox Seed Data Plan

## Status

`IMPLEMENTED AND APPLIED TO QA - 2026-07-21`

The deterministic seed is implemented in `scripts/qa/seed-sandbox-demo.mjs` and targets only Supabase QA ref `kpvvydthlxupjjqqdpxy`. It requires the sandbox wrapper, validates the public fingerprint and private pooler login ref, rejects privileged frontend credentials, and never prints the DB URL or password.

## Commands

```text
npm run qa:sandbox:seed:dry-run
npm run qa:sandbox:seed:apply
```

Both commands require `QA_ENV=sandbox`. Apply uses PostgreSQL 17 `psql`, `ON_ERROR_STOP`, and an explicit transaction. Dry-run performs no writes.

## Marker And Ownership

- marker: `QA_DEMO_20260721`
- deterministic text ID prefix: `qa-demo-20260721-`
- expense marker: `QA_DEMO_20260721-EXP-001`
- per-run future records remain reserved for `QA-AUTO-<qaRunId>`

The script deletes/replaces only its exact deterministic IDs when the expected marker is also present. Collision guards abort before mutation when an ID belongs to an unmarked row.

## Applied Dataset

| Table | Count | Synthetic purpose |
| --- | ---: | --- |
| `leads` | 2 | one new lead and one contacted/convertible lead |
| `clients` | 2 | residential and company demo clients |
| `properties` | 2 | residential and office demo properties |
| `quotes` | 2 | one draft and one accepted quote |
| `quote_lines` | 2 | one line per quote |
| `jobs` | 2 | one scheduled and one completed service |
| `job_lines` | 2 | one line per service |
| `expenses` | 1 | small synthetic cleaning-supplies expense |

Total: 15 rows.

No invoice, payment, fiscal closing, auth user, storage object, or recurring plan is seeded. `recurring_invoice_plans` remains absent and was not invented.

## Synthetic Data Rules Proven

- emails use `example.com`
- phones use `000` prefixes
- addresses are `Calle QA Demo 1` and `Avenida Sandbox 2`
- names, tax IDs, references, notes, dates, and amounts are visibly QA/demo values
- all relations resolve only between deterministic seed IDs
- invoices, payments, and quarterly closings remain at zero
- production writes remain zero

## Verification

- initial dry-run: passed, 15 planned and 0 existing
- first apply: passed after correcting an identity-column insertion inside a rolled-back transaction
- idempotence dry-run: detected exactly 15 replaceable marker rows
- second apply: passed with unchanged counts
- QA visual: 360/360
- sandbox dry-run: 588/588, zero created entities
- private post-seed baseline: created under `qa-reports/private/`

## Next Gate

Capture a provider-supported snapshot or equivalent approved baseline and execute a separately authorized restore-proof comparison. Write-and-clean remains blocked until restorability is demonstrated.
