# Production Migration Metadata Repair Authorization Package - 2026-07-22

## Decision

The package is complete and read-only. Production `wfxnwfcdjainpojhbdri` was inspected but not modified. QA `kpvvydthlxupjjqqdpxy` was not contacted or modified. This package does not authorize a repair.

- Production modified in this sprint: **NO**.
- QA modified in this sprint: **NO**.
- Production schema/data modified: **NO**.
- Migration SQL executed: **NO**.
- Real `db push`: **NO**.
- Full-submit, invoice, payment or closing operations: **NO**.

## Exact destination and identity gate

The only future authorized destination may be the production ref `wfxnwfcdjainpojhbdri`. The future runner must require all three identities to agree before any write:

1. Public Supabase host resolves exactly to `wfxnwfcdjainpojhbdri`.
2. Private pooler username resolves exactly to `postgres.wfxnwfcdjainpojhbdri`.
3. The live PostgreSQL session is accepted only as the pooler-mapped `postgres` or the exact ref-scoped role.

Abort before mutation if any identity is absent, if the target is QA `kpvvydthlxupjjqqdpxy`, if another ref appears, or if public/private/session identities disagree. Connection strings, passwords and tokens must never be printed or committed.

## Read-only production evidence

The production preflight ran inside `BEGIN READ ONLY ... ROLLBACK` and returned:

- `supabase_migrations` schema: absent.
- `supabase_migrations.schema_migrations`: absent.
- Public tables: 17 with the exact canonical inventory.
- PostgreSQL server major: 17.
- Invoice same-number-update sentinel: `1`.
- RLS/RPC migration function set: `7/7`.
- Removed RLS legacy policies remaining: `0/6`.
- Anonymous-closure function set: `3/3`.
- `Authenticated read access` policies: `10`.
- Scoped legacy anonymous write policies: `0`.
- Scoped anonymous SELECT policies: `0`.
- Current schema-only `public` SHA-256: `B4681AF0CD27471D5495E5A3C70A9916720F340653557EE6C46080B9C8C93847`.
- Schema-only bytes: `131798`; `COPY: 0`, top-level data `INSERT: 0`, `setval: 0`.

These postconditions establish that all three incremental migration effects are materially present and that their SQL bodies are not needed for the proposed metadata repair. This is not a general Supabase CLI zero-SQL plan: the repository still mixes a QA baseline with incrementals and retains ambiguous physical filenames, so `db push` remains unsafe and prohibited.

The QA-only baseline was exported from an earlier production schema, so non-execution cannot be inferred from object similarity. What can be established is that production has no migration history entry for it and the future transaction must never register or execute it.

## Proposed history entries

| Version | Logical name | Canonical file | SHA-256 |
| --- | --- | --- | --- |
| `20260707120336` | `fix_same_number_invoice_update_gap` | `20260707_fix_same_number_invoice_update_gap.sql` | `39A435EECE213AE73553C7F33B346A1B957C2A090858EA8F29CAA1026C8EC33D` |
| `20260721183811` | `rls_clients_properties_jobs_write_fix` | `20260721_rls_clients_properties_jobs_write_fix.sql` | `8D330B87CDFF30DF88346E67C8C2B72801661686A0883432D1BAEBBB4E89EFA2` |
| `20260722114751` | `close_anon_read_policies_qa_verified` | `20260722_close_anon_read_policies_qa_verified.sql` | `000E04348CD7E1DBA4CC1FE3F9C9F42526C3F1D3D35C0AE9D7B2D714A4FB0C02` |

Excluded permanently: QA-only baseline `20260721134926`, file `20260721_qa_baseline_schema.sql`, SHA-256 `721F29026F4224DF3FEA68BCB086FB6C559599114CDE4FC9637CA0CDE5E44E57`, flag `never-push`.

## Mandatory checks for the future repair sprint

Immediately before mutation, repeat and save privately:

- exact three-factor production identity and explicit QA rejection;
- clean repository and immutable canonical file hashes;
- fresh schema-only `public` dump and SHA-256 with zero rows/credentials;
- current history absence; any newly present schema/table/version aborts;
- exact 17-table inventory and material sentinel matrix above;
- business row counts before the transaction;
- absence of the baseline version and any unknown history entry;
- PostgreSQL digest capability for server-side verification of stored statements.

Any difference from this package requires a new diagnosis and authorization; it is not permission to adapt the write automatically.

## Proposed transaction

The next sprint may prepare a versioned fail-closed runner, but may execute it only after receiving the exact authorization below. The transaction must:

1. `BEGIN`, set short lock and statement timeouts.
2. Revalidate production identity, history absence, schema fingerprint, table inventory and every material sentinel.
3. Create only `supabase_migrations` and the CLI-compatible `schema_migrations(version text primary key, statements text[], name text)` table.
4. Store the complete canonical text of only the three incremental files, without executing any migration body.
5. Verify exactly three unique versions, logical names, statement cardinality and server-side SHA-256 values.
6. Verify baseline `20260721134926` and all unknown versions are absent.
7. Verify public schema fingerprint, business row counts and sentinels remain unchanged.
8. `COMMIT` only when every in-transaction check passes; otherwise `ROLLBACK`.

No `supabase migration repair`, `db push`, migration apply, schema DDL outside the metadata schema, business DML or frontend service-role use is allowed.

## Exact rollback design

Because production history is currently absent, the exact pre-state is restored by removing only the gate-created `supabase_migrations` schema. The future sprint must first create a private rollback artifact and must not execute it unless the repair transaction committed and later verification proves the metadata state invalid.

Rollback must run in one transaction and abort unless:

- target identity is exact production and explicitly not QA;
- the metadata table contains exactly the three proposed versions, hashes and names;
- the baseline and unknown versions are absent;
- `supabase_migrations` contains no relation except the gate-created history table;
- public schema fingerprint and business row counts still equal the saved pre-repair evidence.

Only after those guards may it drop the metadata schema. It must never restore or alter business schema, sequences, invoice numbering, rows, policies or migration bodies. If any guard diverges, stop as an incident instead of improvising compensation.

## Abort criteria

Abort without writing when:

- target identity is QA, unknown, missing or inconsistent;
- production history appears or differs from the expected empty state;
- any canonical hash changes;
- any material sentinel, table inventory, schema fingerprint or business count diverges;
- the baseline appears in history or in the proposed insert set;
- the transaction would need to execute migration SQL or change business schema/data;
- a connection secret would be exposed or a private artifact would be staged;
- the operation requires `db push`, full-submit, financial/fiscal writes or another approval.

## Residual risks

- Production has legacy schema history older than the three repository incrementals; these entries do not create a complete bootstrap history.
- Physical migration filenames still collide at `20260721` and the QA baseline remains in the migration directory.
- Material postconditions prove the incremental bodies are unnecessary now, but do not make the current CLI directory safe for `db push`.
- A metadata repair may change how future tooling interprets pending migrations; the global push lock must remain active afterward.
- The remote disposable Supabase proof remains deferred; QA metadata repair is the closest provider-runtime evidence but is not production authorization.

## Exact authorization required for the next sprint

The next sprint must not execute until the user provides a new instruction materially equivalent to:

> I explicitly authorize a metadata-only migration history repair exclusively in Supabase production `wfxnwfcdjainpojhbdri`. The authorization is limited to creating `supabase_migrations.schema_migrations` if still absent and registering only `20260707120336`, `20260721183811` and `20260722114751` with the canonical names, statements and SHA-256 hashes in this package. Baseline `20260721134926` must remain excluded. I do not authorize migration SQL execution, `db push`, business schema/data changes, invoice/payment/closing writes, full-submit, QA changes, or any other production mutation. The operation must use a fresh private backup, exact target guards, one transaction, pre-commit verification and the exact guarded rollback described in the package.

Until that authorization is received, verdict is `blocked`. `npm run db:push` and `npm run supabase:db:push` remain intentionally locked.
