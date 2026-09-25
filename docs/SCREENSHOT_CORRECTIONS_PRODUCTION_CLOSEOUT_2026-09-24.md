# Screenshot Corrections — Production Closeout — 2026-09-25

## Release identity

- Product RC SHA: `2a773a918db0993a43884dbaf05b1704f81922bb`
- Branch: `codex/post-v3-screenshot-corrections`
- Vercel project: `costa-clean-app`
- Production deployment: `dpl_7QwBuiVxUXuVvBA9rgkja7hSasJb`
- Deployment URL: `https://costa-clean-2kxqewxoh.vercel.app`
- Canonical alias: `https://app.costacleanbcn.com`
- Previous rollback reference: `dpl_J8nfnXhZNadpGRh2mNtWZhDKuUoD`
- Deployment state: READY
- N5 files in release: 0

The existing READY deployment was promoted with `vercel promote`; no
replacement deployment, DNS change, or Production database migration was
performed in this closeout.

## Routing verification

The canonical domain served the RC entry asset `/assets/index-DwOO0tLt.js`.
The routing smoke passed:

- root: 200 HTML;
- existing JavaScript asset: 200 `application/javascript`;
- missing JavaScript and CSS assets: 404 plain text, not SPA HTML;
- missing API method: 405 JSON, not `index.html`;
- SPA deep link `/dashboard`: 200 app shell.

## Authenticated read-only smoke

Using the legitimate existing Production session, read-only navigation passed
for Home, Cierres, Facturas, Gastos, Alertas, Leads, Cobros, and Servicios.
The dashboard exposed Facturado, Cobrado, and Pendiente. Cierres exposed the
selected-period figures and Base imponible, IVA, and Total facturado. Expense
rows exposed the governed status states. No form was submitted and no business
record was created, edited, deleted, paid, or exported.

## Responsive evidence

Real browser checks were executed against the canonical domain at:

- 390x844: PASS;
- 768x1024: PASS;
- 1440x900: PASS.

Audited Home, Cierres, Facturas, and Gastos views reported no horizontal
overflow, no error boundary, and reachable content at all three sizes.

## Financial read-only evidence

The Production T3 2026 Cierres surface displayed the cohort-based values for
Facturado, Cobrado, and Pendiente and the separate Base/IVA/Total breakdown.
The displayed Cobrado text explicitly described payments linked to invoices
issued in the selected period. The deterministic calculation is authoritative;
the snapshot section is preparation context and does not replace it.

## Safety and deltas

- Production Supabase migrations: 0
- Production business writes: 0
- Production financial writes: 0
- Production snapshot writes: 0
- Production Auth changes: 0
- Production secret changes: 0
- Rollback: NO

## Verdict

`SCREENSHOT_CORRECTIONS = CLOSED/PASS`

`PRODUCTION_RELEASE = PASS`

This documentation is post-release metadata. It does not change the deployed
product. Its commit SHA must be reported separately from the product RC SHA.
