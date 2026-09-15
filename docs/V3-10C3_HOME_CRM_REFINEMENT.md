# V3-10C3 — Home + CRM Module Refinement

Status: `OPEN / AUTHENTICATED RUNTIME CERTIFICATION PENDING`

Starting HEAD: `18a8885a90a58c390d37ece02c918ac3cdc9c6d1`
Branch: `codex/app-v3-mobile-first-redesign`

Implementation checkpoint: `COMMITTED / PUSHED` (`4e3e1ed`)
Authenticated runtime: `PENDING`
Final C3 certification: `PENDING`

This slice refines module composition for Home, Clients, Leads and Properties.
It inherits the C2 token, navigation, control and accessibility contracts. It
does not change routes, persistence, business rules, Supabase, production or
GSAP motion.

## A. COMPLETED WITHOUT AUTH

The local checkpoint audit was completed from the certified C2 parent. The
implementation diff is limited to Home, Clients, Leads, Properties, their
module composition CSS, focused tests and this documentation. No persistence,
route, Supabase, V2 or business-contract file changed.

## Baseline findings

The C2 visual baseline showed four composition issues:

- Home placed the real attention queue below the KPI block, so the first mobile
  viewport could expose finance before the next operational action.
- Clients combined header filters with an additional search filter action and
  placed KPI summaries before the primary find-client task.
- Leads used the same KPI-before-search ordering and its rows had no dedicated
  composition hook for mobile hierarchy.
- Property rows gave the media, identity and status too little room to adapt at
  mobile widths; the workspace media also needed a bounded operational ratio.

Classification: `HOME`, `CLIENT_LIST`, `LEAD_LIST`, `PROPERTY_LIST`,
`SHARED_CRM`. No module-specific business contract was changed.

## Decisions

### Home

The existing alert/incident queue now appears immediately after the page title.
The existing billing KPI and secondary metrics remain available under a
`Lectura rápida` overview. No metric, trend, shortcut or data source was added.

### Clients

The existing client search/filter surface precedes the historical KPI summary.
The duplicate header-level filter button was removed; the existing filter
sheet remains reachable from the search controls. The existing single `Nuevo
cliente` action remains the page-level primary action.

### Leads

Search and visible-count context now precede the existing status KPIs. The
existing lead statuses, conversion actions, deep links and guards are
unchanged. Rows receive a semantic styling hook without exposing technical IDs.

### Properties

The existing property media remains recognition support. At mobile widths rows
use a compact media column and a second-line status/type treatment. Workspace
media is bounded to 150px on mobile so client, location and next action remain
near the first useful viewport. No property data or relation was changed.

## Relationship UX and state preservation

The existing list → workspace → action → back model remains intact. Client,
property, service, quote and invoice relationship callbacks are untouched.
Search, filters, deep links and hard reload behavior remain owned by their
existing navigation/data contracts.

## Responsive decisions

- Mobile (`320`, `390`, `430`): operational queue/search first, compact rows,
  bounded property media, 44px controls and preserved bottom-nav clearance.
- Tablet (`768`, `1024`): shared list/workspace structure remains unchanged;
  no desktop rail or module contract was rewritten.
- Desktop (`1280`, `1440`, `1920`): existing width and rail composition is
  preserved; KPI summaries no longer compete with the primary find/open task.

## Accessibility

Existing focus, keyboard, accessible names, status semantics, 44px target,
sheet/Escape and reduced-motion contracts remain in force. The new composition
test covers queue ordering, search priority, semantic row hooks and bounded
property media without relying on brittle pixel assertions.

## Before / after evidence

Private ignored baseline captured before C3:

- `qa-screenshots/private/2026-09-15T19-38-30`

The final C3 capture will be recorded here after the authenticated visual
runner completes. Customer/QA screenshots remain ignored and are not committed.

## Scorecard

Scores are provisional until the independent visual review compares the final
capture against the baseline.

| Module | Hierarchy | Scanability | Density | CTA clarity | Section structure | Relationship clarity | Mobile | Desktop | Brand | Polish |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home before | 3 | 3 | 3 | 3 | 3 | N/A | 2 | 3 | 3 | 3 |
| Clients before | 3 | 3 | 2 | 3 | 3 | 3 | 2 | 3 | 3 | 3 |
| Leads before | 3 | 3 | 2 | 3 | 3 | 3 | 2 | 3 | 3 | 3 |
| Properties before | 3 | 3 | 2 | 3 | 3 | 3 | 2 | 3 | 3 | 3 |
| After | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |

## Protected scope

No changes to client persistence, lead conversion, property persistence,
invoice/quote/payment/expense/job contracts, alerts, closings, recurring
invoices, PDF engines, duplicate protection, Supabase or production.

GSAP remains review-only and deferred to C7.

## Static checkpoint evidence

- Diff audit: PASS; changed-contract count: `0`.
- Home, Clients, Client Workspace, Leads, Lead Workspace, Properties and
  Property Workspace source review: PASS for the requested composition rules.
- Relationship tests: PASS for human-readable Client → Property output,
  navigation callback wiring and no raw relation id in rendered markup.
- Search tests: PASS for controlled query/filter contracts and empty-result
  state coverage; live match/miss/clear roundtrip remains runtime work.
- Deep-link/routing static coverage: existing Client and Lead deep-link tests
  remain PASS; Property workspace navigation contract remains unchanged.
- Empty/optional state tests: PASS for empty properties, missing client,
  missing notes and fallback media.
- Property media tests: PASS for canonical local assets and deterministic
  fallback/alt text.
- Accessibility static review: PASS for headings, labels, status roles,
  keyboard-aware list item primitive and preserved 44px shared controls.
- Responsive source audit: PASS; the C3 rules have no new fixed viewport
  widths, `100vw`, unbounded media, unsafe min-width or hard-coded large
  mobile heights. Rendered overflow and geometry remain runtime pending.
- C1/C2 static regression: PASS; canonical brand, 44px, feedback, semantic
  tokens, navigation and sheets are untouched by the C3 diff.
- Sensitive values committed: `0`.
- Local validation: `725 passed | 4 skipped`; QA agent validator `294/294`;
  lint PASS; build PASS; diff check PASS.

## B. AUTHENTICATED RUNTIME STILL REQUIRED

The authenticated visual runner could not be executed because the QA login is
not available on the current machine. Previous screenshots served by the
occupied 4177 process were verified as stale and were not accepted as C3
evidence. Therefore no rendered PASS is claimed for viewports, console/page
errors, network safety, overflow, UUIDs, broken images, deep-link reloads or
the before/after visual comparison.

The exact replay is recorded in
`docs/V3-10C3_AUTH_RUNTIME_PENDING.md`. C3 remains OPEN until that checklist
and the independent final gate are completed.

## Final gate

V3-10C3 closes only after the independent quality gate confirms module
composition, private before/after evidence, responsive runtime invariants,
accessibility, search/back/deep-link behavior, tests, lint, build and diff.
