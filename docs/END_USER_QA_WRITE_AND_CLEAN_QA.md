# End-User QA Write-And-Clean QA

## Scope

Write-and-clean exists to verify a narrow set of real create flows while keeping cleanup explicit and reviewable.

Enabled in this sprint:

- `client-create`
- `property-create`
- `quote-create`
- `expense-create`

Dry-run only:

- `invoice-create`
- `payment-create`
- `job-create`
- `fiscal-closing`

## Required Gates

- `QA_ALLOW_WRITE_CLEAN=1` for non-local `QA_APP_URL`
- visible browser session
- authenticated QA profile already prepared
- Supabase public env available locally

## Private Artifacts

- `qa-reports/private/end-user-flow-agent-latest.md`
- `qa-reports/private/end-user-flow-agent-latest.json`
- `qa-reports/private/qa-cleanup-latest.md`
- `qa-reports/private/qa-cleanup-latest.json`
- `qa-reports/private/qa-created-entities-latest.json`

## Expected Outcome

For a successful write-enabled flow:

1. The form opens in a visible authenticated browser.
2. The runner writes deterministic QA data containing `qaRunId`.
3. The row is located through the cleanup registry.
4. Cleanup runs immediately.
5. The result is recorded as `cleaned`.

If any of those guarantees fail, the run must report `cleanup-not-available` or `cleanup-failed` rather than guessing.

## Current Policy - 2026-07-19

- Allowed and live-verified: `client-create`, `property-create`.
- Conditionally allowed after current-build validation: `quote-create`, `expense-create`.
- Always skipped for safety: `payment-create`, `job-create`, `fiscal-closing`.
- `invoice-create` is skipped as `production-build-outdated` while production serves the previous build, otherwise as `invoice-write-not-safe` until a dedicated sandbox contract exists.
- A successful submit must expose or resolve an exact entity id before cleanup. Cleanup must affect at least one registered QA row.
- Run `QA-AUTO-20260719-003838-THOX5J` created and cleaned six entities across client/property and all three viewports; no known QA residue remains.
