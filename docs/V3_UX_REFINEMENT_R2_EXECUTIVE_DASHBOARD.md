# Costa Clean — UX Refinement R2 executive dashboard

Status: R2.1 remediated and independently certified locally; Production deployment intentionally not performed.

## Readiness decision

`R2_READY=YES` is confirmed on branch `codex/v3-ux-refinement-r2-dashboard`, based on R1 HEAD `5def9eac410a639d656b878150d6527fa36cc900`.

`R2_READINESS_ROOT_CAUSE`: the R1 certificate marked R2 as `NO` because R2 was deliberately deferred from the R1 scope. The roadmap retained `R2 NOT_STARTED`; this was a sequencing/documentation state, not a technical blocker or failed dependency.

## Data contract ledger

The dashboard consumes arrays already loaded by `AppShell`; it adds no Supabase query, schema, policy, migration, auth or write contract.

| Domain | Source | Period basis | Dashboard use |
| --- | --- | --- | --- |
| Invoices | `InvoiceListItem` | `issue_date` | total, outstanding, IVA repercutido |
| Payments | `PaymentListItem` | `payment_date` | collected; linked to any visible, non-cancelled invoice regardless of invoice issue period |
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
- Compact operational KPI grid with restored direct Home actions.
- Period-scoped attention queue for selected-period receivables, unbilled jobs and unsupported expenses, separated from the clearly labelled current/global queue.
- Truthful financial empty values: zero data remains zero, and comparisons remain `N/A` when unsupported.

## R2.1 remediation evidence

- Remediation branch: `codex/v3-ux-refinement-r2-remediation`, based on exact `88479a3f5972971494a363e2921432a930a1c9fd`.
- Focused dashboard model and priority tests: 12/12 PASS.
- Full tests: 897 passed, 4 skipped.
- Deterministic coverage includes same-period, cross-month/quarter/year payments, multiple partial payments, cancellation/unknown invoice rejection, outstanding balance, empty periods, and period-selector attention rebuilding.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm run qa:agents`: PASS — 294/294.
- `git diff --check`: PASS.
- The trend renderer adds no dependency or separate chart bundle to the initial build.
- Authenticated visual QA: PASS — fresh isolated Edge profile on `http://127.0.0.1:4178/?v3=1`, 10 required viewports, 1320 checks, 0 failures.
- Viewports: 320x568, 390x844, 430x932, 768x1024, 820x1180, 834x1194, 1024x1366, 1280x800, 1440x900 and 1920x1080; Home and representative modules all loaded without audit failures.
- Sanitized runtime evidence: HOME/CLIENTS loaded, no auth redirect, no loading stall, no failed requests, console errors or page errors reported by the QA harness; no business-write scenario was submitted. Production requests and mutations: 0.
- No Production deployment or Supabase mutation performed.

## Independent review result

- P1-1 collection semantics: RESOLVED. Collection is based on `payment_date`, validated only against visible non-cancelled invoices.
- P1-2 attention scope: RESOLVED in code. Selected-period attention is rebuilt from the selected model; current/global alerts remain separate and labelled `Estado actual`.
- P1-3 Home actions: RESOLVED in code. Historical direct actions were restored for invoiced, collected, outstanding, expenses, open quotes, unbilled jobs and attention items.
- P2-1 mobile density: RESOLVED in code. Home executive KPIs use a compact two-column layout at mobile widths, with odd-card handling.
- P2-2 design tokens: RESOLVED in code. Trend strokes now use semantic CSS variables rather than raw hex values.

### Severity matrix

`P0 = 0`  
`P1 = 0`  
`P2 = 0 known reproducible product defects; fresh visual evidence unavailable`  
`P3 = 0`

Fresh independent review: PASS. Screenshots at mobile, tablet and desktop confirm one logo, separated shell/page context, compact mobile KPI grid, readable trend chart, semantic colors, card hierarchy, section separation, safe-area navigation, no text overlap or horizontal overflow, and usable touch targets. Direct Home actions were exercised as open-only routes; no save or business mutation was performed.

## Final certification verdict

`R2.1_STATUS = PASS`
`R2 = CLOSED / CERTIFIED`
`R3 = READY`
`PRODUCTION_DEPLOY = NO`  
`SUPABASE_PRODUCTION_MUTATIONS = 0`

## Next sprint

R3 is ready for the next sprint: invoice and quote document preview parity. R3 is not implemented by this certification.
