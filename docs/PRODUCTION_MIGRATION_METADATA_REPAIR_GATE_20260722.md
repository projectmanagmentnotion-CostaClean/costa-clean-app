# Production Migration Metadata Repair Gate - 2026-07-22

## Verdict

PASS. Production `wfxnwfcdjainpojhbdri` was modified only by creating Supabase migration-history metadata and registering the three authorized canonical incrementals. QA `kpvvydthlxupjjqqdpxy` was not modified.

- Initial HEAD: `fe31eafccfd62bb51bd25f7d427d51edf5ce81f4`.
- Final HEAD: delivery commit reported at closeout.
- Production modified: yes, metadata only.
- Business schema modified: no.
- Business data modified: no.
- Migration bodies executed: 0.
- Real `db push`: no.
- Full-submit: no.
- Invoice/payment/closing writes: 0.
- QA modified: no.

## Target and authorization

The public Supabase host, private pooler username and live PostgreSQL session all resolved to the exact authorized production ref. QA and unknown refs were rejected. The user supplied separate explicit authorization limited to creating `supabase_migrations.schema_migrations` if absent and registering only the package allowlist.

PostgreSQL 17, `ON_ERROR_STOP`, one connection and one transaction were used. Connection strings, passwords and tokens were neither printed nor versioned.

## Fresh private backup

- Path: `.project-agent/private/migration-repair/prod-before-metadata-repair-20260722.sql`.
- Size: `1295` bytes.
- Timestamp: generated immediately before the production transaction.
- `COPY`: 0.
- Business-data `INSERT`: 0.
- Connection strings: 0.
- Git status: ignored, not versioned.

Production had no migration-history schema before the gate, so this artifact is an exact guarded restoration of that empty metadata state rather than a business-schema dump.

## Metadata before and after

Before:

- `supabase_migrations`: absent.
- `supabase_migrations.schema_migrations`: absent.
- registered versions: 0.

After:

| Version | Name | Statements | SHA-256 |
| --- | --- | ---: | --- |
| `20260707120336` | `fix_same_number_invoice_update_gap` | 1 | `39A435EECE213AE73553C7F33B346A1B957C2A090858EA8F29CAA1026C8EC33D` |
| `20260721183811` | `rls_clients_properties_jobs_write_fix` | 1 | `8D330B87CDFF30DF88346E67C8C2B72801661686A0883432D1BAEBBB4E89EFA2` |
| `20260722114751` | `close_anon_read_policies_qa_verified` | 1 | `000E04348CD7E1DBA4CC1FE3F9C9F42526C3F1D3D35C0AE9D7B2D714A4FB0C02` |

Each `statements` array stores the complete canonical file as one element solely to preserve and verify its hash. None of those SQL bodies was executed. Baseline `20260721134926` remains absent; unknown entries: 0.

## Public schema and business invariants

- Public schema SHA-256 before: `B4681AF0CD27471D5495E5A3C70A9916720F340653557EE6C46080B9C8C93847`.
- Public schema SHA-256 after: `B4681AF0CD27471D5495E5A3C70A9916720F340653557EE6C46080B9C8C93847`.
- Public tables before/after: `17 / 17`.
- Public sequences before/after: `9 / 9`, exact states unchanged.
- Invoice identifier fingerprint before/after: `96581D5534FF3F8542088970AE1BDA1B9C7E2B4B35764082811D6BE56284860E`.
- Material migration sentinels and policy counts: unchanged.

| Table | Before | After |
| --- | ---: | ---: |
| `annual_closings` | 1 | 1 |
| `audit_events` | 262 | 262 |
| `clients` | 29 | 29 |
| `expenses` | 29 | 29 |
| `intake_submissions` | 47 | 47 |
| `invoice_lines` | 67 | 67 |
| `invoices` | 52 | 52 |
| `job_lines` | 43 | 43 |
| `jobs` | 57 | 57 |
| `lead_drafts` | 47 | 47 |
| `leads` | 47 | 47 |
| `payments` | 51 | 51 |
| `properties` | 33 | 33 |
| `public_gym_manual_quiz_attempts` | 6 | 6 |
| `quarterly_closings` | 2 | 2 |
| `quote_lines` | 22 | 22 |
| `quotes` | 9 | 9 |

## Transaction and verification

The fail-closed runner `scripts/ops/run-production-migration-metadata-repair.mjs` performed a dry-run first. The authorized apply then:

1. Revalidated production identity, empty history, canonical hashes, public inventory, material sentinels, row counts, sequence state and invoice identifiers.
2. Created only `supabase_migrations.schema_migrations`.
3. Inserted only the three allowlisted metadata rows.
4. Verified exact versions, names, statement cardinality and server-side hashes.
5. Verified baseline/unknown entries absent and every protected invariant unchanged before commit.
6. Committed once all checks passed.

A fresh read-only connection repeated the complete verification after commit and passed.

## Authenticated application smoke

The visible authenticated visual runner loaded the application shell and audited every configured view/flow without submits. Result: `358/360` checks. Two visual checks failed: mobile Home `headerVisible` and desktop payment-create `actionFlowFirstFieldVisible`. No startup/load error occurred, and the post-smoke database verification proved all business counts, sequences and invoice identifiers unchanged. These two visual findings remain separate UI/harness debt and are not presented as a perfect visual PASS.

## Exact rollback

Rollback was not executed because final verification passed. If an authorized incident later requires it, the private rollback runs one transaction and aborts unless the target is exact production, the history contains exactly these three names/versions/hashes, the baseline and unknown entries are absent, and no unexpected relation exists in `supabase_migrations`. Only then may it drop the gate-created metadata schema. It never touches `public`, business rows, policies, sequences, invoices or fiscal numbering.

## Remaining risks and next gate

- The three entries do not reconstruct production history older than the repository migrations.
- The QA-only baseline remains physically beside incrementals and two filenames still share `20260721`.
- Metadata reconciliation does not prove that the current CLI directory produces a safe zero-SQL plan.
- Therefore `npm run db:push` and `npm run supabase:db:push` remain intentionally locked.
- The next active roadmap gate is Gate 3, Workspace / Tenancy / Ownership Security Model, read-only/documentary unless separately authorized.
