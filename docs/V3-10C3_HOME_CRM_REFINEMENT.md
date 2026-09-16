# V3-10C3 — Home + CRM Module Refinement

Status: `CLOSED / CERTIFIED`

Starting HEAD: `18a8885a90a58c390d37ece02c918ac3cdc9c6d1`
Branch: `codex/app-v3-mobile-first-redesign`

Implementation checkpoint: `COMMITTED / PUSHED` (`4e3e1ed`)
Authenticated runtime: `PASS`
Final C3 certification: `PASS`

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

Final private/ignored evidence was captured at 390x844, 768x1024 and
1440x900. Customer/QA screenshots remain ignored and are not committed.

## Scorecard

The independent visual review compared the final captures with the recorded
baseline. The score changes reflect improved operational ordering, scanability
and bounded property media; no category decreased.

| Module | Hierarchy | Scanability | Density | CTA clarity | Section structure | Relationship clarity | Mobile | Desktop | Brand | Polish |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home before | 3 | 3 | 3 | 3 | 3 | N/A | 2 | 3 | 3 | 3 |
| Clients before | 3 | 3 | 2 | 3 | 3 | 3 | 2 | 3 | 3 | 3 |
| Leads before | 3 | 3 | 2 | 3 | 3 | 3 | 2 | 3 | 3 | 3 |
| Properties before | 3 | 3 | 2 | 3 | 3 | 3 | 2 | 3 | 3 | 3 |
| Home after | 4 | 4 | 4 | 4 | 4 | N/A | 4 | 4 | 4 | 4 |
| Clients after | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| Leads after | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| Properties after | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |

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

## B. Authenticated runtime evidence

The final read-only QA replay ran against `http://127.0.0.1:4178/?v3=1` using
the canonical `costaclean-v3` profile. It passed all eight required viewports
and all 32 selected C3 surfaces (Home, Clients, Leads and Properties):

- authentication, direct navigation, workspace opening, hard reload and Back:
  PASS;
- Clients/Leads/Properties search miss and clear/restoration: PASS where rows
  existed; 12 empty-state checks are recorded as N/A, with no failed check;
- More, keyboard Escape and close behavior: PASS across all eight viewports;
- a focused live replay at 390x844, 768x1024 and 1440x900 confirms that More
  now returns focus to the opener after Escape;
- production requests, non-QA Supabase requests and QA mutations: `0`;
- console errors, page errors, failed requests, overflow, UUID exposure,
  Unicode-as-icon, legacy markers and broken images: `0`.

The minimum contact-action geometry observed in the replay was `54.84 × 44`
CSS px across 176 measurements. Private ignored evidence is retained under
`qa-screenshots/private/v3-10c3-2026-09-16T08-46-16` and
`qa-screenshots/private/v3-10c3-2026-09-16T11-06-00`; it is not committed.
The sanitized command evidence is recorded in
`docs/V3-10C3_AUTHENTICATED_RUNTIME_CERTIFICATION.md`.

## Final gate

The evidence review confirmed the requested module composition, private visual
evidence, responsive invariants, keyboard/focus behavior, search/back/deep-link
behavior and protected-contract freeze. The independent quality checklist is
PASS, subject to the recorded commands in the certification evidence.
