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
- QA visual certification: `BLOCKED`. The isolated profile resolved to an
  unrelated account and the available QA credential fixture did not authenticate
  `qa.financial.runner@qa.invalid`. Therefore authenticated Home, reload,
  cross-tab and logout evidence cannot be truthfully certified in this run.
- Login error presentation: `PASS` in the unauthenticated isolated context;
  invalid credentials are localized and provider error details are not shown.
- No production, Supabase, notification, portal or route changes were made.
