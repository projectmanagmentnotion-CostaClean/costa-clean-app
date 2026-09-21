# Costa Clean — UX Refinement R2 executive dashboard

Status: implementation complete locally; Production deployment intentionally not performed.

## Readiness decision

`R2_READY=YES` is confirmed on branch `codex/v3-ux-refinement-r2-dashboard`, based on R1 HEAD `5def9eac410a639d656b878150d6527fa36cc900`.

`R2_READINESS_ROOT_CAUSE`: the R1 certificate marked R2 as `NO` because R2 was deliberately deferred from the R1 scope. The roadmap retained `R2 NOT_STARTED`; this was a sequencing/documentation state, not a technical blocker or failed dependency.

## Data contract ledger

The dashboard consumes arrays already loaded by `AppShell`; it adds no Supabase query, schema, policy, migration, auth or write contract.

| Domain | Source | Period basis | Dashboard use |
| --- | --- | --- | --- |
| Invoices | `InvoiceListItem` | `issue_date` | total, outstanding, IVA repercutido |
| Payments | `PaymentListItem` | `payment_date` | collected; only payments linked to invoices in the selected period |
| Expenses | `ExpenseListItem` | `expense_date` | total, result, support and IVA soportado elegible |
| Jobs | `JobListItem` | `scheduled_date` | scheduled, completed, completed without invoice |
| Quotes | `QuoteListItem` | `created_at` | open and accepted |
| Alerts | existing automation/operational builders | existing rule semantics | limited attention queue and active-alert count |

Cancelled, archived and deleted entities are excluded. Money is rounded to cents at model boundaries. `Resultado estimado = facturado - gastos`. `IVA estimado = IVA repercutido - IVA soportado elegible`; supported input VAT uses the existing deterministic fiscal helper and valid invoice support. The VAT figure is explicitly operational and is not an official tax liability.

Growth compares the selected period with the immediately preceding period of the same kind. If the previous period has no data or a zero denominator, the UI reports `N/A`; it never invents `0%`.

## Implemented surface

- Six executive KPIs: facturado, cobrado, pendiente, gastos, resultado estimado and IVA estimado.
- Month/quarter/year selector without a full reload.
- Six-period historical trend for invoiced, collected and expenses using a dependency-free SVG renderer; this avoids changing the repository's frozen package-contract artifacts while keeping the chart small and accessible.
- Accessible text summary for the chart and reduced-motion-safe configuration.
- Compact operational KPI grid and the existing real attention queue.
- Truthful financial empty values: zero data remains zero, and comparisons remain `N/A` when unsupported.

## Quality evidence

- Focused dashboard model tests: 3/3 PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- The trend renderer adds no dependency or separate chart bundle to the initial build.
- Authenticated Edge QA: PASS — 10 required viewports, 1320 checks, 0 failures; final run included Home, all protected modules and create flows.
- Final visual review: Home inspected at `320x568` and `820x1180`; no overflow, overlap, duplicate brand mark or unreadable chart surface observed.
- No Production deployment or Supabase mutation performed.

## Scope risks retained

The existing attention queue builders are operationally global and do not expose per-alert event dates. R2 keeps that trusted alert logic and presents it unchanged; the financial KPIs and chart are period-scoped. A future alert contract enhancement can add date-aware filtering without weakening current routing semantics.

## Next sprint

R3 remains pending: invoice and quote document preview parity.
