# Costa Clean — UX refinement roadmap

This roadmap extends the V3 visual foundation. It does not change business contracts, routes, authentication, Supabase schemas, or write APIs.

## R1 — Global visual foundation

Status: PASS — locally certified; no Production deployment performed.

- Global visual depth and semantic color hierarchy.
- Shared card language.
- Mobile header and single-brand contract.
- Safe-area and top-spacing governance.
- Canonical status chips.

## R2 — Executive Home / Dashboard

Status: CLOSED / CERTIFIED — R2.1 remediation and fresh authenticated visual certification passed; no Production deployment performed.

- KPI hierarchy.
- Real charts and growth context.
- VAT, expenses, receivables, and financial history.
- UX-03A one-brand-mark rule: GOVERNED and satisfied by the R1 shell foundation.

R3: CLOSED / CERTIFIED — canonical invoice and quote document preview parity passed independent review, focused/full gates, and authenticated visual QA; no Production deployment performed.

## R3 — Invoice and Quote document preview parity

Status: CLOSED / CERTIFIED.

- Shared canonical A4 preview primitive for invoice and quote workspaces.
- Existing open, download and share contracts preserved.
- Canonical PDF capture now supports multi-page documents without clipping.
- Fresh authenticated visual QA: 1320/1320 PASS across mobile, tablet and desktop.
- No Production deployment or Supabase mutation performed.

R4: CLOSED / CERTIFIED — Leads KPI layout and responsive commercial summary passed independent review, focused/full gates, and authenticated Leads visual QA; no Production deployment performed.

## R4 — Leads KPI layout and responsive information cards

Status: CLOSED / CERTIFIED.

- Shared V3 KPI primitive extended with governed semantic brand tones.
- Leads commercial summary uses deterministic counts from loaded lead data only.
- Responsive four-card composition: four columns on tablet/desktop, two columns on mobile.
- Authenticated Leads visual QA: 10/10 PASS across mobile, tablet and desktop.
- Full quality gates: 907 passed, 4 skipped; agents 294/294 PASS.
- No Production deployment or Supabase mutation performed.

R5: CLOSED / CERTIFIED — contained and scalable large-list architecture passed focused/full gates and authenticated visual QA; no Production deployment performed.

Global backlog remains explicit: UX-01A stronger global contrast/color, UX-02A premium dashboard charts, UX-03B single global brand lockup, UX-03C header/navbar differentiation and UX-07A strict no-scroll monostep StepFlows remain pending.

## R5 — Contained and large-list architecture

Status: CLOSED / CERTIFIED.

- Shared `V3ListWorkspace` with bounded internal scroll and accessible result pagination.
- Client pagination defaults to 25 rows; no server pagination or virtualization was introduced.
- Clients, Properties, Leads, Invoices, Quotes, Services, Payments, Expenses, Alerts and Recurring Plans are migrated; Closings is documented as a fiscal output surface with no large collection list.
- Full tests: 914 passed, 4 skipped; agents 294/294 PASS; lint/build/diff-check PASS.
- Authenticated visual QA: 1847/1848 checks PASS. One unrelated `ipad-820/home` header-visibility baseline finding remains explicit as P2 and outside R5 scope.
- No Production deployment or Supabase mutation performed.

Visual Polish Sprint: READY.

R5 does not close the global backlog. UX-01A stronger global contrast/color, UX-02A premium dashboard charts, UX-03B single global brand lockup, UX-03C header/navbar differentiation, UX-03E branded preloader, UX-07A strict no-scroll monostep StepFlows and the existing `ipad-820/home` baseline finding remain pending.

## R6 — Real mobile StepFlow architecture for long forms

Status: NOT_STARTED.
