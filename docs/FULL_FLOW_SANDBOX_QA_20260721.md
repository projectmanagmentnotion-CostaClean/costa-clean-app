# Full-Flow Sandbox QA - Schema Blocker - 2026-07-21

## Verdict

`SANDBOX ISOLATION VALIDATED; BLOCKED ON INCOMPLETE QA SCHEMA`

The isolated Supabase QA target is configured and reachable. Authentication and the responsive application shell were validated, but the target does not contain the required application tables. The dry-run therefore did not pass and no baseline, write-clean, full-submit, destructive reset, invoice, payment, or fiscal write was attempted.

## Schema Baseline Follow-Up

A later authorized read-only gate obtained a production schema-only export with `pg_dump 17.10`. Its private safety review passed and the sanitized baseline `supabase/migrations/20260721_qa_baseline_schema.sql` was created. It contains no real data or secrets, production was not modified, and the migration has not been applied to QA.

The next gate is a separately authorized baseline apply to the isolated QA target, followed by REST/grant verification. Full-submit, invoices, payments, seed, and reset remain blocked. The authoritative export does not contain `recurring_invoice_plans`, so that runtime surface remains an explicit schema gap.

## Repository And Environment

- Branch: `main`
- Initial synchronized HEAD: `1a4a196f5e4c22949aba9898cc27230655182fbf`
- Initial worktree: clean
- `.env.qa.local`: present and ignored; values were not printed or versioned
- Required public variable names: present and non-empty
- QA project ref: `kpvvydthlxupjjqqdpxy`
- URL/ref consistency: passed
- Fingerprint differs from the local reference project: passed
- Reset strategy: `snapshot-restore`
- Privileged/service-role credential names: absent
- `npm run qa:sandbox:check`: passed

The checker proves configuration separation only. It does not prove schema completeness, seed safety, baseline availability, or restoration.

## Technical Validation

- `npm run lint`: passed
- `npm run build`: passed (`372` modules transformed)
- `npm run test`: `175/175` passed across 38 files
- QA preview: reachable at `http://127.0.0.1:4174/`, built with the sandbox wrapper
- Auth: authenticated shell detected with four shell markers and no startup-error marker
- Auth storage: isolated under ignored `.auth/sandbox/`; only local metadata was saved

## Visual And Dry-Run Evidence

The authenticated visual runner completed all 42 structural viewport/scenario checks across mobile, tablet, and desktop. This is not a data-readiness pass: the screenshots and captured viewport text show REST 404 schema-cache errors.

Observed missing QA tables:

- `public.clients`
- `public.properties`
- `public.quotes`
- `public.jobs`
- `public.invoices`
- `public.expenses`
- `public.payments`
- `public.quarterly_closings`

The sandbox dry-run completed without submissions or created entities, with `489/510` checks passing and `21` failing. The failures repeat consistently across all three viewports:

- invoice creation: embedded property subflow unavailable
- property creation: first actionable field not visible
- service from client: no context record available
- service from property: no context record available

The missing context records and unavailable dependent flows are consistent with the absent schema. The visual runner's structural success must not be interpreted as a functional sandbox pass while visible REST errors exist.

## Baseline And Safety Result

| Gate | Result |
| --- | --- |
| Sandbox configuration/fingerprint | Passed |
| Authenticated shell | Passed |
| Structural responsive checks | 42/42 passed |
| Data-backed visual readiness | Failed: required tables absent |
| Sandbox dry-run | Failed: 489/510 checks |
| Created sandbox entities | 0 |
| Baseline proof | Reviewed schema-only migration prepared; not applied to QA |
| Write-and-clean | Not run |
| Full-submit | Not run |
| Destructive reset | Not run |
| QA residue created by this block | 0 |

## Production Safety

- Production touched: no
- Production invoices issued: 0
- Production payments recorded: 0
- Production financial writes: 0
- Production data deleted: 0
- Production schema, SQL, RPC, migrations, auth, numbering, `invoice_number`, and `display_code` changed: no
- Secrets printed: 0
- Secrets versioned: 0

## Next Gate

An authorized schema-delivery step must deploy a reviewed, complete application schema to the isolated QA project through the normal controlled path. Do not apply the repository's loose historical SQL inventory speculatively. After schema verification, add deterministic synthetic seed data, capture a private baseline, and prove snapshot restoration before enabling any write-and-clean or full-submit path.

No full-submit or destructive reset command is authorized by this result.

## Schema Reproducibility Audit

The initial repository audit classified schema reproducibility as `C - not reproducible from the repository`. The later reviewed export raises readiness to `B - baseline prepared; QA not yet mutated`.

- The sole formal migration only replaces an invoice RPC and assumes the base schema.
- Loose SQL creates some later tables, functions, triggers, and policies, but does not create the core base tables.
- A safe read-only QA probe confirmed all 17 audited application tables are absent from the REST schema cache.
- The original audit lacked tooling and a reviewed schema dump; `pg_dump 17.10` and a private Session pooler input later closed the export prerequisite.
- No schema was applied and no post-schema visual QA or dry-run rerun was performed. The baseline file is prepared only.

Detailed evidence and the controlled schema-only export gate are in `docs/QA_SANDBOX_SCHEMA_GAP_20260721.md`.

The authorized read-only export later succeeded, the private safety review passed, and the sanitized baseline was produced. QA apply, visual rerun, dry-run rerun, seed, full-submit, and reset remain pending separate gates. See `docs/QA_SCHEMA_BASELINE_REVIEW_20260721.md`.
