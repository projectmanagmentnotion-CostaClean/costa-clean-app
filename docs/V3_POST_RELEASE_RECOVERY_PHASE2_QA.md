# Costa Clean V3 — Phase 2 authenticated QA summary

Status: sanitized aggregate evidence for the recovery candidate.

## Candidate and environment

- Candidate starting SHA: `4842f3da825a7bd542fa02abb8f8c0cba5d50558`.
- Candidate validated SHA: `57cb12a85282ba0d787411b4cd3feb42ee6621ba`.
- Verified local app URL: `http://127.0.0.1:4178/?v3=1`.
- Sanitized evidence provenance timestamp: `2026-09-19T23:18:58+02:00`.
- QA Supabase project ref: `kpvvydthlxupjjqqdpxy`.
- Authenticated browser methodology: persistent user-authenticated Google Chrome QA profile, reused across the audit; no credentials, cookies, JWTs, or profile files are committed.
- Audit mode: authenticated, read-only, no business writes.

## Matrix result

- Viewports: `10/10` — 320x568, 390x844, 430x932, 768x1024, 820x1180, 834x1194, 1024x1366, 1280x800, 1440x900, 1920x1080.
- Surface navigations: `120/120` across 12 surfaces and 10 viewports.
- Document navigations observed: `150`, HTTP 200: `150`.
- Authenticated viewports: `10/10`.
- Headings/readiness: `120/120`.
- Search miss assertions: `0` failures; search was `N/A` on surfaces without a search control.
- Escape open/close and focus restoration: `10/10`.
- Minimum measured interactive target: 44 CSS px.

## Safety and runtime

- Horizontal overflow: `0` viewports.
- Legacy markers: `0`.
- Broken images: `0`.
- Console errors: `0`.
- Page errors: `0`.
- Failed requests: `0`.
- QA writes: `0`.
- Production requests: `0`.
- Production writes: `0`.
- Non-QA Supabase requests: `0`.

## Modules audited

Dashboard/Negocio hoy, Clientes, Leads, Inmuebles, Presupuestos, Servicios, Facturas, Cobros, Gastos, Alertas, Cierres and Planes recurrentes. Recurring Plans was reached through the Clients workspace, matching the application route contract.

Known N/A states are limited to search assertions on surfaces without search controls and write-dependent business certification. Settlement QA writes, expense QA writes, AI provider behavior, and schema changes were not executed.

## Branding and responsive conclusions

- The existing V3 shell now presents the canonical Costa Clean logo and visible `Costa Clean` identity in the topbar and iPad/desktop navigation rail.
- Post-change authenticated smoke at 390x844, 768x1024, 820x1180, 834x1194, 1024x1366, 1440x900 and 1920x1080 showed the brand and logo present with no horizontal overflow.
- iPhone: the audit includes 320x568, 390x844 and 430x932; no overflow or runtime errors were observed.
- iPad/tablet: the audit includes 768x1024, 820x1180, 834x1194 and 1024x1366; no overflow or runtime errors were observed.
- Zero-legacy conclusion: no legacy V2 markers were observed in the audited V3 surfaces.

## User-reported defect coverage

The phase covers authenticated startup, responsive shell branding, navigation/readiness, keyboard escape/focus behavior, long-surface navigation and safe request isolation. It does not certify settlement writes, expense writes, AI receipt extraction, vendor matching/history, schema changes or production behavior.

## Stitch boundary

`STITCH UI DESIGN PENDING` remains authoritative for genuinely new Expenses/Vendors screens, receipt/photo AI extraction, vendor matching/history and related new visual flows. No generic replacement screens were introduced.
