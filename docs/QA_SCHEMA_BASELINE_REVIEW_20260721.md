# QA Schema Baseline Review - 2026-07-21

## Verdict

`BLOCKED BEFORE PRODUCTION SCHEMA READ`

The user authorized a production schema-only export, but this work PC does not currently have a complete safe export channel. No production schema was read, no dump was obtained, and no baseline migration was created.

## Preflight Result

| Check | Result |
| --- | --- |
| Initial HEAD | `b14ec58f6642767a62660b5b2d889beca75071b0` |
| Supabase CLI | unavailable |
| `pg_dump` | unavailable |
| `psql` | unavailable |
| `supabase/config.toml` or local link metadata | absent |
| Production public URL | present privately |
| Production project ref | resolved privately and confirmed different from QA |
| Supabase access token | present privately |
| Database password | absent |
| Database connection string | absent |
| Existing repository export command | absent |
| Private export directories | created and confirmed ignored |

No values, project credentials, connection strings, or complete production URLs were printed.

## Export Method Used

None. The repository has no export wrapper and the required database tooling is unavailable. The existing access token was not used to guess, recover, rotate, or synthesize a database password.

Supabase documents `supabase db dump` as a schema dump by default, excluding managed schemas such as auth and storage. It requires a linked remote project or an explicit DB URL. A remote link/dump may request the database password. That prerequisite is not satisfied here.

## Safety Review

- Raw export obtained: no
- `INSERT INTO` scan: not applicable
- `COPY ... FROM stdin` scan: not applicable
- Personal-data pattern scan: not applicable
- Secret pattern scan: not applicable
- `CREATE TABLE`, functions, policies, and triggers inventoried from export: not applicable
- Data rows included: no, because no export was run

A private preflight report was written to `qa-reports/private/schema-export/schema-only-safety-review.md`; it remains ignored by Git.

## Baseline Migration

No `20260721_qa_baseline_schema.sql` migration was created. Producing one without the authoritative export would repeat the speculative reconstruction already rejected by the schema-gap audit.

Tables included: none. The required runtime inventory remains documented in `docs/QA_SANDBOX_SCHEMA_GAP_20260721.md`.

## Exact Authorized Manual Export Procedure

Use an authorized operator on this work PC or another controlled machine. Do not paste credentials into chat, source files, shell history, or versioned environment files.

1. Install the official Supabase CLI using a supported method, or make a compatible `pg_dump` available.
2. Work inside `.project-agent/private/schema-export/`; do not initialize/link Supabase at the repository root.
3. Authenticate interactively with the authorized production account.
4. Link the temporary private working directory to the production project using its private project ref. Confirm visibly that it is not QA ref `kpvvydthlxupjjqqdpxy`.
5. Enter the production database password only through the CLI's secure interactive prompt or an approved ephemeral secret mechanism.
6. Run the equivalent of:

   ```text
   supabase db dump --linked --schema public --file production-schema-only.sql
   ```

7. Do not add `--data-only`, `--use-copy`, `--include-seed`, or any option that exports rows.
8. Leave the raw file at `.project-agent/private/schema-export/production-schema-only.sql` and verify `git check-ignore` succeeds.
9. Do not run `db push`, `db reset`, `db pull`, migration repair, SQL Editor writes, or any command against QA in this gate.

Alternative with an authorized connection string:

```text
pg_dump --schema-only --schema=public --no-owner --file=production-schema-only.sql <private-connection>
```

The connection must be supplied privately and must never be embedded in the command saved to history, documentation, or Git.

## Required Review After The File Exists

Before creating a versioned baseline:

1. reject any top-level `COPY`, data `INSERT`, sequence `setval` tied to production state, or real row payload;
2. scan for emails, phone numbers, names, addresses, invoice values, tokens, passwords, and connection strings;
3. inventory tables, columns, types, defaults, PK/FK, indexes, constraints, functions, triggers, policies, grants, enums, extensions, and sequences;
4. distinguish SQL statements inside function bodies from exported table rows;
5. remove incompatible owners and production-specific grants only through a reviewed patch;
6. compare the export with the runtime contract and later reviewed SQL patches;
7. stop on financial-numbering state, production regularizations, ambiguous function versions, or any personal data.

Because application RPC bodies legitimately contain `INSERT INTO`, a literal match must trigger manual review and block automatic conversion; it must not be silently deleted or mistaken for exported rows.

## Production Safety

- Production schema read: no
- Production modified: no
- Production writes: 0
- Production invoices issued: 0
- Production payments recorded: 0
- Production financial writes: 0
- Full-submit: not executed
- Reset: not executed
- Secrets printed or versioned: 0

## Next Gate

Provide the schema-only file in the expected ignored path or make the official CLI plus authorized database password available interactively. The next sprint must perform the private safety review and may prepare—but must not apply—the ordered QA baseline migration.
