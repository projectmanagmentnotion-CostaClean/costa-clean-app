# Costa Clean N2–N9 Release Candidates

## Status

`N2_N9_RC1_CONSOLIDATED` is a source/repository release-candidate status, not a deployment claim. The certified source chain starts at `6c323dfec6cffbb647b76f924554c6e3c06b39ac` and the pre-consolidation head is `cd0f78196c0b8ef14fad22fcc8039ab4dfa1c205`. The release manifest is anchored to that head as an ancestor so its own commit does not create a circular hash.

N2–N9 are frozen to the seven migrations listed in [`release/n2-n9-rc1.manifest.json`](../release/n2-n9-rc1.manifest.json). N3 is frontend-only and has no migration. Every listed migration is additive; rollback is by forward corrective migration, never by editing an applied migration.

RC3 defines a new fresh-install path in [`release/n2-n9-rc3.manifest.json`](../release/n2-n9-rc3.manifest.json): N2, N4, N5, N6, N7, N8, followed by `20260923230000_n9_recurring_operational_templates_v2.sql`. It intentionally excludes the historical original N9 and the RC2 forward correction from the RC3 runtime chain. A manifest-driven installer must select the exact RC3 list; this is source packaging, not migration-history rewriting.

## Capability chain

N2 provides the idempotent atomic invoice/service/payment write boundary. N3 productizes that flow in the frontend. N4 adds recurring service plans and occurrence generation. N5 adds guarded team planning and time capture. N6 exposes planned and actual operational profitability. N7 adds material master/movement control. N8 allocates direct expenses and extends final profitability. N9 adds recurring team/material templates, planned material requirements, occurrence planning, and forecasts.

The N8/N9 boundary is intentional: N8 defines `get_job_final_profitability_base` and its N8 wrapper without referencing N9 tables; N9 replaces the public wrapper only after `job_material_requirements` exists. This prevents N8 from depending on a table created by a later migration.

## Security and source-of-truth audit

| Area | Source of truth | Boundary |
|---|---|---|
| Financial writes | `create_atomic_financial_operation` and `financialWriteApi.ts` | guarded RPC, idempotency key, no scattered invoice/payment writes |
| Recurring plans | N4 RPCs and `recurringServiceApi.ts` | internal staff guard; occurrence generation is transactional |
| Team/material operations | N5/N7 RPCs and operational APIs | internal staff guard; authenticated read policies |
| Expense allocation | N8 RPCs and `expenseAllocationApi.ts` | allocation writes through guarded RPC; totals remain derived |
| N9 planning | N9 RPCs and `recurringOperationalApi.ts` | planned rows are separate from actual time, stock and fiscal activity |
| Frontend | feature components call the API wrappers | no production schema is inferred from UI state |

Security-definer functions use the repository's active internal staff guards and restricted search paths. Tables with internal-read policies are not treated as public API. No new secret, PAT, migration application, or production write is part of RC1.

## QA and runtime boundary

The RC1 checks include focused N2–N9 contracts, cross-contract synthetic lifecycle checks, existing QA, lint, TypeScript, build and diff checks. A disposable PostgreSQL proof is attempted only through an existing supported local executor; if unavailable, it is reported as `BLOCKED_BY_EXECUTOR_ENVIRONMENT` and does not become a fabricated pass.

The full-suite baseline retains four unrelated historical failures/timeouts from CP-3B.2A and portal invitation coverage. They are outside this diff and must remain unchanged; RC1 does not weaken or hide them.

## RC1 runtime result and RC2 correction

RC1 QA application was attempted against the authorized QA project only. The transaction rolled back completely at N9 because PostgreSQL rejected `get_team_workload_forecast(date)` for nested aggregate calls. The old partial N4 QA surface remained intact, with zero rows and zero RC1 migration-history writes.

RC2 preserves the seven RC1 migrations byte-for-byte and adds only `20260923220000_n9_fix_team_workload_forecast_aggregate.sql`. The correction uses a grouped `workload` CTE followed by `jsonb_agg`, preserving the function signature, security-definer search path, internal-staff filter, and grants. RC2 requires a new, separate QA runtime authorization; no remote retry is implied by this source change.

## RC3 fresh-install correction

The original N9 migration is retained unchanged as immutable provenance. Its `get_team_workload_forecast(date)` definition is rejected by PostgreSQL because it nests `sum(...)` inside `jsonb_agg(...)` at the same query level. RC2's forward correction was therefore unreachable on a fresh install: PostgreSQL aborts while compiling original N9 before RC2 can run.

RC3 replaces the install artifact rather than pretending the old migration was valid. `20260923230000_n9_recurring_operational_templates_v2.sql` reproduces the original N9 tables, policies, grants, profitability extension and RPC behavior, with the two-stage workload aggregation built in. The RC2 correction remains unchanged and is excluded from RC3. RC1 and RC2 manifests and migration files remain independently verifiable historical evidence.

The first RC3 QA transaction reached successful PostgreSQL creation of the RC3 objects, including N9 V2, but rolled back at the certifier because it incorrectly required `FORCE ROW LEVEL SECURITY` on every table. The N2 idempotency ledger intentionally declares `ENABLE ROW LEVEL SECURITY` only; the corrected certifier now derives `relforcerowsecurity` expectations table by table. QA runtime tests were not executed, and QA returned to its empty prestate with zero residue and zero migration-history writes.

The subsequent authorized retry also rolled back before commit because its ephemeral postcondition list incorrectly required two obsolete N4 RPCs that RC3 intentionally excludes. Those RPCs are now covered by the tracked contract as absent; the QA schema remains at the original empty N4 prestate and still has zero migration-history writes.

`DEVELOPMENT COMPLETE != DEPLOYED`. No remote Supabase migration, production backup, restore, JIT mutation, tag, or CP51F execution is implied. CP51F remains `DEFERRED_NON_BLOCKING`; the manual backup system remains ready.

## Release gate and rollback

The next gate is an explicitly authorized deployment/release review after the source manifest, dependency audit and local QA are accepted. Production package preparation is separate from QA runtime preparation. Any rollback is a forward corrective migration or application revert approved by the release owner; no applied migration is rewritten.
