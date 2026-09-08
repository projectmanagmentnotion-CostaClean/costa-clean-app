# Stitch Visual QA

**Status:** `PASS`
**Rule:** no screen receives `PASS` while important visual differences remain.

This is the required comparison record for each completed screen. It must be
filled against the exact Stitch revision listed in `docs/stitch/DESIGN.md`.

## Required viewports

- `390x844` mobile
- `768x1024` tablet interpolation, unless a tablet Stitch reference exists
- `1440x900` desktop

## Per-screen record

```text
ROUTE:
STITCH REFERENCE:
VIEWPORT:
LAYOUT:
TYPOGRAPHY:
SPACING:
COLORS:
IMAGES:
CONTROLS:
NAVIGATION:
RESPONSIVE:
MOTION:
ACCESSIBILITY:
DIFFERENCES:
VERDICT: WAITING_FOR_STITCH | PASS | FAIL
EVIDENCE:
```

`PASS` requires functional behavior to remain compatible with the existing
route, state, auth and backend contracts, plus no material layout,
typography, spacing, imagery, responsive or motion discrepancy. Test both
normal motion and `prefers-reduced-motion: reduce`.

## FE-03 shell visual certification — 2026-09-08

Environment: fresh local QA preview at `http://127.0.0.1:4173/`, using the
existing QA credential fixture in memory only. The runtime resolved to
`kpvvydthlxupjjqqdpxy.supabase.co`; no production target was used.

- `390x844`: `PASS`; `scrollWidth=390`, `overflowX=false`.
- `768x1024`: `PASS`; `scrollWidth=768`, `overflowX=false`.
- `1024x768`: `PASS`; `scrollWidth=1024`, `overflowX=false`.
- `1440x900`: `PASS`; `scrollWidth=1440`, `overflowX=false`.
- Dark/light: `PASS` at `390x844` and `1440x900`.
- Mobile dock, primary navigation, `Mas` sheet, modal semantics, safe internal
  scrolling, focus trap, Escape close and focus restoration: `PASS`.
- Desktop grouped navigation, active state, account menu and unique logout:
  `PASS`.
- Public `/quote-request` isolation: `PASS`; the authenticated shell was absent.
- Reduced-motion media preference was exercised at every authenticated viewport.

Evidence is private and local at
`qa-reports/private/fe03-responsive-cert/`; `report.json` records every check.
No evidence files are committed. FE-03 is complete; FE-04 may now be planned,
but is not implemented by this certification.

## FE-04 shared primitives reference integration - 2026-09-08

Reference surface: authenticated `Clientes` list using the existing
`DSPageHeader`/`ExecutiveHeader` path. The page actions now render through the
shared `DSButton` contract; no list filtering or client workflow behavior was
changed.

- Reused: `DSCard`, `DSPageHeader`, `DSListControlBar`, `DSSearchInput`,
  `DSFilterChip`, `DSActiveFilters`, `DSConfirmDialog`, `DSEmptyState`,
  `DSErrorState`, `DSPageLoading`, `DSSkeleton`, `ToastProvider` and
  `DSBottomActionBar`.
- Extended: `DSButton` with primary, secondary, tertiary and danger semantic
  tones plus disabled/loading state; `DSBadge` with semantic danger mapping.
- `390x844`, `768x1024`, `1024x768`, `1440x900`: `PASS`; document
  `scrollWidth` stayed within the viewport.
- Dark/light: `PASS` at `390x844` and `1440x900`.
- Keyboard semantics: focused primitive model tests and existing dialog/shell
  keyboard behavior pass.
- Reduced motion: exercised at every reference viewport.
- Private visual evidence: `qa-reports/private/fe04-primitives/`.

Documented debt: timeline, duplicate-review shell and broad master-detail
migrations remain future slices. No duplicate component system was introduced.

## FE-05 entry and Home audit - 2026-09-08

Implementation scope reviewed: boot copy, authentication presentation and the
existing data-driven Home cockpit. Home already derives its KPI, alert and
quick-action surfaces from current application data and suppresses zero-value
metrics while those data sources are not meaningful.

- Boot: existing session bootstrap, recoverable-error handling and explicit
  logout boundaries preserved; copy remains short and truthful.
- Login: `DSInput`, `DSButton`, `DSErrorState`, autocomplete attributes,
  loading/disabled state, normalized Spanish errors, focus restoration and
  single form submission are implemented.
- Home: existing priority, financial and quick-action composition retained;
  no queries or business calculations changed.
- QA runtime: `PASS` in the existing normal Chrome session at
  `http://127.0.0.1:4174`, targeting the QA Supabase host. The visible account
  was `qa.financial.runner@qa.invalid`.
- Authenticated Home, reload persistence, same-origin cross-tab persistence,
  mobile account access and public `/quote-request` isolation: `PASS`.
- Responsive measurements: `390x844` (`scrollWidth=375`), `768x1024`
  (`scrollWidth=753`), `1024x768` (`scrollWidth=1009`) and `1440x900`
  (`scrollWidth=1425`); all had `overflowX=false`.
- Dark/light visual checks passed at `390x844` and `1440x900`; reduced motion
  was exercised. Direct logout was not run against the live QA tab.
- Login error presentation: `PASS` in the unauthenticated isolated context;
  invalid credentials are localized and provider error details are not shown.
- Stitch evidence debt: `DESIGN.md` remains `WAITING_FOR_STITCH`. The only
  open Stitch project was a client-portal project and was not accepted as the
  CRM FE-05 reference; no new Stitch screen was created.
- No production, Supabase, notification, portal or route changes were made.
# CP-3B.2 authenticated portal implementation evidence

Status: `BLOCKED_FOR_AUTHENTICATED_QA`

- Stitch project: Costa Clean Client Portal (`7915940018854753326`)
- Approved iPhone references: `PORTAL_IPHONE_PROFILE_V2`, `PORTAL_IPHONE_PROPERTIES_LIST_V2`, `PORTAL_IPHONE_PROPERTY_DETAIL_V2`, `PORTAL_IPHONE_PROPERTY_CORRECTION_V2`
- Canonical viewport: `390x844`
- Scope: Profile, Properties List, Property Detail and reviewed Property Correction only
- Design approval: `OWNER_APPROVED`
- Authenticated browser evidence: `NOT_EXECUTED` (no QA portal tab was available in the existing browser session)
- Runtime visual evidence at `390x844`: `NOT_EXECUTED`
- Tablet and desktop evidence: `NOT_IN_SCOPE`
- Production evidence: `NOT_EXECUTED`

The Stitch copy-cleanup request was submitted against only the four approved V2 frames. No legacy frame was edited or deleted by the repository work.

## CP-3B.2B-QA authenticated iPhone certification

Status: `BLOCKED_PENDING_PORTAL_AUTH`

- Runtime bundle verification: `PASS`; the QA build targets `kpvvydthlxupjjqqdpxy.supabase.co` and does not target production.
- Browser: existing normal Chrome profile, no isolated profile or incognito.
- Portal route: `/portal` redirected to `/portal/login`; the available browser session was authenticated for the CRM surface, not the client portal.
- Profile, properties, detail and reviewed-change checks: `NOT_EXECUTED` because portal authentication was unavailable.
- Mobile measurements and console/network certification: `NOT_EXECUTED`.
- No remote writes, user creation, password reset, backend change or production request was made.

## CP-3B.2B-QA fixture authorization result

- QA-only fixture created in `kpvvydthlxupjjqqdpxy`: one synthetic client
  (`QA-CP3B2B-PORTAL-20260908-CLIENT`), two synthetic properties and one
  active `client_admin` membership for the existing QA user.
- Portal authorization: `PASS`; `/portal` no longer shows `Acceso no asignado`.
- Profile and account bootstrap: `PASS`; the synthetic client profile loads.
- Properties certification: `BLOCKED`; the current remote
  `portal_list_properties` and `portal_get_property` RPC responses omit the
  `publicRef` field required by the existing portal read adapter. No backend
  contract or schema change was made in this block.
- Property detail, correction flow, mobile certification and regression remain
  `NOT_EXECUTED` until that contract mismatch is resolved through its own
  authorized backend block.

## CP-3B.2B-CONTRACT QA closeout evidence

Status: `PARTIAL — BLOCKED_PENDING_390X844_VISUAL_QA`

- Root cause: the QA `portal_list_properties` and `portal_get_property` RPCs
  omitted the required customer-safe `publicRef` field.
- Canonical source: `public.properties.display_code`, protected by the
  existing unique partial index. No new identifier source was introduced.
- QA contract patch: `PASS`; both RPCs now return `publicRef` and preserve the
  existing membership/property filters, `security definer` boundary and
  `search_path`. The versioned SQL is
  `supabase/migrations/20260908115621_portal_property_public_ref_contract_alignment.sql`.
- Production contract patch: `NOT APPLIED`; production ref was not queried or
  modified.
- QA fixture list/detail: `PASS`; `PRO-0074` and `PRO-0075` are returned and
  link to the matching property routes.
- Property correction flow: `PASS`; the request was submitted as
  `pending_review` with a public request reference, while the canonical
  property address remained unchanged.
- Session reload: `PASS`; the authenticated portal session persisted after a
  full same-origin navigation.
- Unknown public reference: `PASS`; an unknown ref returned the authorized
  property directory without exposing a property detail.
- Frontend fixes: property detail now derives its correction route from the
  selected `publicRef`, and property correction routes resolve under
  `/portal/properties/{publicRef}/correction/...`.
- Exact `390x844` responsive measurements, console/network capture and
  touch/safe-area visual certification: `NOT_EXECUTED` because the available
  normal Chrome control surface did not expose responsive viewport or
  DevTools telemetry APIs. No isolated browser or incognito context was used.
- Production requests: `0`. CRM UI, RLS, notification code and Supabase Auth
  were not modified.

## CP-3B.2B-FINAL-VISUAL execution record

Status: `PARTIAL — BLOCKED_PENDING_EXACT_390X844`

- Browser: existing authenticated QA session in normal Chrome; no incognito or
  isolated automation context.
- Functional visual pass at the currently visible portal session: Profile/
  Account, Properties List, Property Detail, Property Correction fields and
  Services navigation are reachable and render the expected customer-facing
  labels. Mobile bottom navigation and correction StepFlow are present.
- QA properties observed: `PRO-0074` and `PRO-0075`; no new rows were created.
- Exact CSS viewport metrics (`innerWidth`, `innerHeight`, `scrollWidth`,
  `scrollHeight`), console error capture, network capture, touch-target pixel
  measurement, keyboard simulation and safe-area measurement:
  `NOT_EXECUTED`. The available normal-Chrome control surface did not expose
  DevTools or responsive viewport controls, so these values are not claimed.
- No visual code fix was necessary during this certification attempt.
- Production requests: `0`; backend, RPCs, CRM and production were not
  modified.

## CP-3B.2B-FINAL-FIX execution record

Status: `PARTIAL — PENDING_DEVTOOLS_METRICS`

- Confirmed responsive root cause: the authenticated workspace used
  `portal-workspace__*` classes, while the existing mobile layout rules only
  covered `portal-shell__*`. The workspace therefore retained its desktop
  layout assumptions at mobile width; additionally, the frozen decision-block
  selector overrode the generic mobile one-column rule.
- Minimal frontend fix: mobile workspace layout now switches to a single
  column, mobile workspace header spacing/context are constrained, flexible
  children can shrink, headings wrap, and the Home decision CTA occupies the
  available column width. No overflow mask was added.
- Normal Chrome QA visual retest: Home, Account, Properties, Property Detail,
  Property Correction and Services remain reachable; QA properties remain
  `PRO-0074` and `PRO-0075`; no new remote data was created.
- The owner-provided exact `390x844` Device Toolbar context was used for the
  visible retest, but this control surface still did not expose console
  execution or numeric `innerWidth`/`scrollWidth` readings. Exact metric,
  console, network, keyboard, safe-area and pixel touch-target evidence remain
  `NOT_EXECUTED`; `CP-3B.2B` is not marked `DONE` without those measurements.
- Production requests: `0`. Auth, membership, RPC semantics, RLS, CRM and
  production were not modified.
