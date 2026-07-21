# QA Sandbox Schema Gap - 2026-07-21

## Verdict

`C - SCHEMA NOT REPRODUCIBLE FROM THE REPOSITORY`

The isolated QA project is reachable and its fingerprint is valid, but the repository does not contain a complete reviewed migration history or schema dump capable of creating the application's database contract. No SQL, migration, RPC, policy, trigger, seed, or production export was applied in this sprint.

## Evidence And Target Guardrails

- Repository HEAD before the audit: `50df21bd65fe0aa6336975dec957dba4e0874e51`
- QA project ref: `kpvvydthlxupjjqqdpxy`
- `npm run qa:sandbox:check`: passed
- Reset strategy: `snapshot-restore`
- QA ref differs from the local reference project: yes
- `.env.qa.local`: present and ignored; values were not printed
- Supabase CLI: not installed
- `supabase/config.toml`: absent
- DB password, access token, connection string, service-role key, and secret key in the process environment: absent by variable-name check
- Production access/export: not attempted

## Runtime Tables Required By The App

The inventory below comes from actual REST paths, Supabase client calls, realtime subscriptions, and write APIs in `src/`. It is not inferred from product labels.

| Table or storage surface | Runtime use | Repository creation coverage |
| --- | --- | --- |
| `intake_submissions` | public intake and realtime invalidation | partial loose SQL |
| `lead_drafts` | authenticated intake review and conversion | partial loose SQL |
| `leads` | commercial list, create, lifecycle, conversion | missing base table |
| `clients` | list, create/update, fiscal identity, relations | missing base table |
| `properties` | list, create/update, client relation | missing base table |
| `quotes` | list, lifecycle and financial RPCs | missing base table |
| `quote_lines` | quote documents and financial RPCs | missing base table |
| `jobs` | service list, lifecycle and save RPC | missing base table |
| `job_lines` | service billing detail | loose SQL creates it, but depends on missing `jobs` |
| `invoices` | list, fiscal numbering, lifecycle and financial RPCs | missing base table |
| `invoice_lines` | invoice documents and save RPCs | loose SQL creates it, but depends on missing `invoices` |
| `payments` | payment list and settlement RPCs | missing base table |
| `expenses` | expense CRUD and fiscal review | loose SQL creates it |
| `recurring_invoice_plans` | recurring invoice planning | loose SQL creates it; deployment was previously marked pending preflight |
| `quarterly_closings` | fiscal snapshots | loose SQL creates it |
| `annual_closings` | fiscal snapshots | loose SQL creates it |
| `audit_events` | traceability via RPC | loose SQL creates it |
| `expense-receipts` | private receipt storage | loose SQL creates bucket/policies |
| `public_gym_manual_quiz_attempts` | separate public quiz feature | loose SQL creates it; not part of the operational full-flow gate |

`settings` and a user/profile mapping appear in conceptual documentation, but no active runtime query for them was found in the audited application paths. No runtime table reference was found for `recurring_services`, `service_reports`, `hour_entries`, `payroll`, or `payment_allocations`; they must not be invented for this deploy.

## Current QA Probe

A read-only REST probe requested only `id` with `limit=0`; no rows or secrets were printed. Every audited surface returned `404 missing-table` from the PostgREST schema cache:

- `intake_submissions`, `lead_drafts`, `leads`
- `clients`, `properties`
- `quotes`, `quote_lines`
- `jobs`, `job_lines`
- `invoices`, `invoice_lines`, `payments`
- `expenses`, `recurring_invoice_plans`
- `quarterly_closings`, `annual_closings`
- `audit_events`

The QA target therefore has no verified application schema, not merely the eight tables first exposed by the visual run.

## Relationships Required By Runtime Code

- properties belong to clients
- quotes may belong to a lead or client and may reference a property
- quote lines belong to quotes
- jobs belong to a client/property and may reference a quote
- job lines belong to jobs
- invoices belong to a client and may reference property, job, and quote
- invoice lines belong to invoices
- payments belong to invoices
- recurring invoice plans reference client and optionally property/quote
- lead drafts reference intake submissions and may resolve to leads
- audit events reference domain entity identifiers logically

Exact types, nullability, defaults, cascades, constraints, and identifier-generation rules cannot be reconstructed safely from TypeScript alone.

## RPC And Function Contract

Active application code references at least:

- `save_quote_with_lines`
- `save_lead_quote_with_lines`
- `save_invoice_with_lines`
- `save_invoice_with_lines_v2`
- `save_job_with_lines`
- `save_payment_and_refresh_invoice`
- `settle_invoice_by_transfer`
- `refresh_invoice_payment_status`
- `update_quote_status`
- `update_invoice_status`
- `convert_lead_to_client`
- `accept_quote_workflow`
- `reassign_property_client`
- `record_audit_event`
- `backfill_invoice_fiscal_snapshots`
- `save_client_recurring_invoice_plan`
- `generate_invoice_from_recurring_plan`

Loose SQL contains versions of these functions, plus numbering and fiscal helpers. Several files replace the same financial functions over time, so applying them independently or alphabetically is not evidence of a reviewed final contract.

## Migration Audit

### Formal migration history

`supabase/migrations/` contains only:

- `20260707_fix_same_number_invoice_update_gap.sql`

That migration replaces an invoice RPC and assumes `invoices` and `invoice_lines` already exist. It cannot bootstrap the database.

### Loose historical SQL

The `sql/` directory contains incremental patches, production incident fixes, historical invoice regularizations, RPC replacements, partial table creation, RLS fragments, triggers, and storage setup. It is not a complete ordered migration history.

Tables created somewhere in loose SQL are limited to:

- `annual_closings`
- `audit_events`
- `expenses`
- `intake_submissions`
- `invoice_lines`
- `job_lines`
- `lead_drafts`
- `public_gym_manual_quiz_attempts`
- `quarterly_closings`
- `recurring_invoice_plans`

Core base tables absent from all versioned `CREATE TABLE` statements include:

- `leads`
- `clients`
- `properties`
- `quotes`
- `quote_lines`
- `jobs`
- `invoices`
- `payments`

Some loose scripts contain production-specific data corrections and numbering regularizations. They must not be used to initialize QA.

## RLS, Policies, Triggers, And Seed Gaps

- RLS/policy SQL exists only for a subset of later tables and storage. The complete policies and grants for core tables are absent.
- The repository security plan explicitly records that the real RLS/grant baseline was not fully audited from system catalogs.
- Trigger definitions exist for expense calculations, closing timestamps, public intake timestamps, and invoice-number synchronization, but the complete base trigger/default contract is absent.
- Financial numbering depends on multiple evolving functions and triggers; their safe final ordering is not represented as a migration chain.
- No executable deterministic sandbox seed or checked-in schema dump exists.
- No provider snapshot has been executed or verified from this work PC.

## Why No Schema Was Applied

Applying the loose SQL set would require guessing the missing base schema and the intended final order of repeated RPC replacements. It could also execute production-specific regularizations. This fails the repository's schema-readiness gate and the sprint's explicit stop condition.

## Required Next Gate

Obtain a reviewed **schema-only** export from the authoritative Supabase project or another known-good environment through an explicitly authorized read-only workflow. The export must exclude rows, auth users, storage objects, secrets, and production-specific data corrections. Before applying it to QA:

1. store it in a private review location first;
2. review tables, columns, types, defaults, constraints, foreign keys, indexes, functions, triggers, RLS, policies, grants, and storage bucket definitions;
3. split or sanitize any production-specific ownership, grants, extensions, and data statements;
4. compare it with runtime contracts and the later reviewed SQL patches;
5. create an ordered, reviewable migration baseline;
6. rerun the QA fingerprint checker immediately before any push;
7. require separate authorization for the external QA schema mutation.

Production was not read, exported, changed, or used as a migration destination in this sprint.
