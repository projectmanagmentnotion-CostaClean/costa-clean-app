# Screenshot Corrections — Production Closeout — 2026-09-28

## Release identity

- Product RC SHA: `2d81aff8893fbc89ab041c38e9e657e632aec38a`
- Branch: `codex/post-v3-screenshot-corrections`
- Vercel project: `costa-clean-app`
- Production deployment: `dpl_sEgCM6rhbRfsYEbJnb8A7WatZT7u`
- Deployment URL: `https://costa-clean-qjb72vqdw.vercel.app`
- Canonical alias: `https://app.costacleanbcn.com`
- Previous rollback reference: `dpl_2REP4Ag62HnxgP4ja5V5qnQRvPx5`
- Deployment state: READY
- N5 files in release: 0

The exact RC was built with the repaired Production Vercel variables and
promoted with `vercel promote`. No replacement build was created after the
promotion, no DNS change was made, and no Supabase schema or migration was
run.

## Environment and routing verification

The deployed bundle references Production Supabase project
`wfxnwfcdjainpojhbdri`, contains an active `sb_publishable_` key prefix, and
contains no QA project reference. The canonical domain resolved to
`dpl_sEgCM6rhbRfsYEbJnb8A7WatZT7u`.

Routing smoke passed:

- root: 200 HTML;
- existing JavaScript asset: 200 `application/javascript`;
- missing JavaScript and CSS assets: 404 plain text, not SPA HTML;
- missing API path: 404 plain text;
- existing API route without its required method: 405 JSON, not `index.html`;
- SPA deep link: 200 app shell.

## Authenticated read-only smoke

Using the legitimate authenticated Edge CDP session, read-only navigation
passed for Home, Cierres, Facturas, Gastos, Alertas, Leads, Cobros, and
Servicios. No form was submitted and no business record was created, edited,
deleted, paid, exported, or snapshot-saved.

## Responsive and Cierres evidence

Real browser checks against the canonical domain passed at:

- 390x844;
- 768x1024;
- 1440x900.

Cierres rendered `Cifras Calculadas` without character fragmentation at all
three viewports. Horizontal overflow was zero and no audited action control
was outside the viewport.

## Financial read-only evidence

For T3 2026, the canonical Production responses contained 18 invoices in the
issue-date cohort and 18 linked payments. Independent in-memory calculation
produced:

- Facturado: `14.090,44 €` gross invoice total;
- Cobrado: `14.090,44 €` linked payments;
- Pendiente: `0,00 €`.

The displayed Cierres values matched those calculations. The selected-period
copy identifies Cobrado as payments linked to invoices issued in the period.

## Safety and deltas

- Production Supabase migrations: 0
- Production business writes: 0
- Production financial writes: 0
- Production snapshot writes: 0
- Production Auth changes: 0
- Production DNS changes: 0
- N5 mutations: 0
- Rollback: NO

## Verdict

`SCREENSHOT_CORRECTIONS = CLOSED/PASS`

`PRODUCTION_RELEASE = PASS`

This file is post-release documentation only; it does not change the deployed
product. Its documentation commit SHA is reported separately from the product
RC SHA.
