# Costa Clean N2–N9 Release Candidate 1

## Status

`N2_N9_RC1_CONSOLIDATED` is a source/repository release-candidate status, not a deployment claim. The certified source chain starts at `6c323dfec6cffbb647b76f924554c6e3c06b39ac` and the pre-consolidation head is `cd0f78196c0b8ef14fad22fcc8039ab4dfa1c205`. The release manifest is anchored to that head as an ancestor so its own commit does not create a circular hash.

N2–N9 are frozen to the seven migrations listed in [`release/n2-n9-rc1.manifest.json`](../release/n2-n9-rc1.manifest.json). N3 is frontend-only and has no migration. Every listed migration is additive; rollback is by forward corrective migration, never by editing an applied migration.

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

`DEVELOPMENT COMPLETE != DEPLOYED`. No remote Supabase migration, production backup, restore, JIT mutation, tag, or CP51F execution is implied. CP51F remains `DEFERRED_NON_BLOCKING`; the manual backup system remains ready.

## Release gate and rollback

The next gate is an explicitly authorized deployment/release review after the source manifest, dependency audit and local QA are accepted. Production package preparation is separate from QA runtime preparation. Any rollback is a forward corrective migration or application revert approved by the release owner; no applied migration is rewritten.
