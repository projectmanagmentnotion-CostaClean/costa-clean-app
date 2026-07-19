# Real Submit QA Failures - 2026-07-19

## Initial Evidence

- Clients: `3/3` created and cleaned.
- Properties: `3/3` created and cleaned.
- Quote desktop: created and cleaned.
- Quote mobile/tablet: blocked at `Inmueble`; no row created in those attempts.
- Expenses: submit returned to the list without durable confirmation or a captured entity id.
- Invoices: production served the previous build and retained the old direct-invoice blocker.
- No known QA residue remained after the initial run.

## Exact Causes And Fixes

### Quote Mobile/Tablet

The quote state did not require a property and did not diverge by viewport. The failure was layout geometry: `ActionFlowOverlay` rendered its own sticky close footer around `FullscreenStepFlow`, which already owns the operational footer. On constrained viewports the outer footer consumed the useful bottom area and left `Continuar` inaccessible or unreliable.

The overlay now supports an internal-footer mode, keeps the StepFlow within the available panel height, and omits the duplicate footer. Stable markers were added for `quote-property-step`, `quote-property-select`, `quote-property-option`, and `quote-next-button`; the agent uses the stable next-button marker first.

### Expense Confirmation

The insert API already returned the expense id, but `ExpenseCreateFlow` discarded it, refreshed through `completeFullViewActionFlow`, and the page handler refreshed again and immediately closed. This removed the only reliable point at which the agent could register the exact row before cleanup.

The flow now retains the id, publishes it before refresh, refreshes once, and shows a persistent `Gasto creado` confirmation with `data-entity-id`. The list also keeps a confirmation after closing. The agent reads that exact id first, with fingerprint lookup only as fallback.

### Invoice Build Gap

The invoice fix exists in the current repository, while `app.costacleanbcn.com` still serves the prior behavior. Local authenticated validation is unavailable because the required public Supabase variables are not configured. The runner therefore skips invoice write-and-clean as `production-build-outdated`; no production workaround or financial write was attempted.

## Safety Hardening

- Write-and-clean policy is enforced before custom flow runners execute.
- Invoice, payment, job, and fiscal writes are skipped with explicit reasons.
- Cleanup now fails when the mutation affects zero rows.
- Quote and expense success surfaces expose exact entity ids.
- No schema, SQL, RPC, migration, auth, numbering, or financial contract changed.

## Live Results

- Visible authenticated visual QA against production: `360/360`.
- Full production dry-run: `416/435`; all `19` failures are `invoice-create` against the old build.
- Restricted policy check: invoice/payment/job/fiscal skipped safely across all three viewports; no writes performed.
- Safe write-and-clean run `QA-AUTO-20260719-003838-THOX5J`: `132/132`, six entities created and six cleaned (three clients, three properties).
- No known QA residue remains.

Quote mobile/tablet and expense are fixed in source but are not declared live-green because production does not yet contain these changes. They must be rerun visibly on a deployed current build before enabling their final gate.

## Current Policy

- Live-proven write-and-clean: clients, properties.
- Conditional after current-build validation: quotes, expenses.
- Skipped for safety: invoices, payments, jobs, fiscal actions, cancellations, and any flow without deterministic cleanup.

## Remaining Blocker

Deploy the current build or provide a local authenticated environment with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then run quote/expense write-and-clean and invoice dry-run in `390x844`, `768x1024`, and `1366x900`. Commit and push remain blocked until that evidence is green.
