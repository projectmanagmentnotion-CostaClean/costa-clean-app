# QA Schema Baseline Review - 2026-07-21

## Verdict

`PASS - REVIEWED QA BASELINE APPLIED AND VERIFIED`

An authorized production schema-only export was obtained with `pg_dump 17.10`. The raw artifacts and connection inputs remain private and ignored. No rows were exported and production received no writes. The reviewed baseline was later applied only to QA ref `kpvvydthlxupjjqqdpxy` through an atomic `psql` transaction.

## Export Result

| Check | Result |
| --- | --- |
| Tool | `pg_dump 17.10` |
| Full schema-only export | obtained privately |
| Reviewed source | `public` schema-only export |
| Flags | `--schema-only --schema=public --no-owner --no-privileges` |
| Full dump size | 278388 bytes |
| Public-only dump size | 116651 bytes |
| Data rows exported | 0 |
| Production modified | no |
| QA modified | yes, reviewed schema only |

Credentials were supplied only through temporary process environment variables read from the ignored private input. They were not written to the command line, documentation, Git, or the baseline.

## Private Safety Review

Result: `PASS`.

- top-level `INSERT INTO`: 0
- `COPY ... FROM stdin`: 0
- data sections: 0
- sequence `setval`: 0
- emails, JWTs, connection strings, private keys, and secret assignments: 0
- auth users and storage row data: 0
- owners and ACLs: excluded by export flags

The reviewed dump contains 13 `INSERT INTO` occurrences inside PL/pgSQL function bodies. These are application RPC definitions, not exported rows and not data statements executed while installing the schema.

The private report is stored at `qa-reports/private/schema-export/schema-only-safety-review.md` and remains ignored.

## Versioned Baseline

Created: `supabase/migrations/20260721_qa_baseline_schema.sql`.

The baseline contains:

- 17 `public` tables
- 40 functions, plus `save_invoice_with_lines(jsonb, jsonb)` supplied by the earlier `20260707` migration
- 8 sequences with no production sequence state
- 43 indexes
- 45 RLS policies
- 15 triggers

Sanitization removed PostgreSQL 17 client metacommands, `CREATE SCHEMA public`, the PostgreSQL 17-only `transaction_timeout` setting, and the duplicate invoice function. Managed Supabase schemas, owners, ACLs, credentials, connection strings, tokens, row data, and production sequence values are absent.

## Known Gap And Apply Preconditions

The authoritative production `public` schema does not contain `recurring_invoice_plans`, although current runtime code references it. The baseline does not invent the missing contract. Recurring-invoice functionality must remain blocked or receive a separately reviewed schema decision.

Because the requested export excluded privileges, the QA apply gate must verify the effective Supabase default privileges and REST access after migration. A baseline file is not proof that QA is ready.

## Safety Accounting

- production writes: 0
- production invoices issued: 0
- production payments recorded: 0
- financial writes: 0
- data rows exported: 0
- secrets versioned: 0
- full-submit: not executed
- reset: not executed

## QA Apply Verification

- method: PostgreSQL 17 `psql`, `ON_ERROR_STOP`, single transaction
- expected tables: 17/17
- functions: 41
- triggers: 15
- policies: 45
- RLS-enabled tables: 17
- effective sequences: 9
- initial and post-dry-run row counts: all zero
- authenticated visual QA: 360/360
- sandbox dry-run: 588/588, 0 created entities
- full-submit: no
- destructive reset: no
- production touched: no

The apply used direct `psql`, so Supabase CLI migration-history metadata was not modified. A future `db push` must not be attempted until migration history is reconciled in a separate gate.

## Next Gate

Prepare a deterministic synthetic demo seed in a separate authorized gate. Do not write-and-clean, full-submit, issue invoices, record payments, repair migration history, or reset until their later gates are explicitly approved.
