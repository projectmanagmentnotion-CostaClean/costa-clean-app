# Costa Clean — UX Refinement R5 scalable lists

Status: R5 independently certified locally. Production deployment intentionally not performed.

## Scope and reviewed base

- Branch: `codex/v3-ux-refinement-r5-scalable-lists`
- Start/reviewed HEAD: `307390626017f884d560044ef8c5179415eed06c`
- No Supabase schema, query, auth, route or business-contract changes.
- No production deployment or production business mutation.

## Shared list architecture

`V3ListWorkspace` is now the single V3 containment primitive. It provides a labelled keyboard-focusable region, internal vertical scrolling with `overscroll-behavior: contain` and `-webkit-overflow-scrolling: touch`, a live result range, and 44px pagination controls. `useV3ListWindow` keeps the loaded data contract unchanged and renders a default maximum of 25 rows per page.

The strategy is client pagination because the existing data-loading contract loads each domain as a coherent read model. Server pagination, virtualization and new dependencies are deliberately not introduced in R5.

| Surface | Strategy | Search/filter/sort reset | Bulk/relationship behavior |
|---|---|---|---|
| Clients | Client page window, 25 | Search and filter reset page 1 | Existing client workspace/deep link preserved |
| Properties | Client page window, 25 | Search reset page 1 | Existing property workspace preserved |
| Leads | Client page window, 25 | Search and state reset page 1 | Existing lead workspace preserved |
| Invoices | Client page window, 25 | Search, state and sort reset page 1 | Selection still covers the full filtered set, not only the visible page |
| Quotes | Client page window, 25 | Search, state and sort reset page 1 | Selection still covers the full filtered set, not only the visible page |
| Services | Client page window, 25 | Search and status reset page 1 | Existing service workspace preserved |
| Payments | Client page window, 25 | Search, origin and sort reset page 1 | Existing payment workspace preserved |
| Expenses | Client page window, 25 | Search and sort reset page 1 | Existing expense workspace preserved |
| Alerts | Client page window, 25 | Alert filter resets page 1 | Priority grouping and alert actions preserved |
| Closings | Not a large collection list | Not applicable | Fiscal output remains unchanged |
| Recurring plans | Client page window, 25 | Client context resets page 1 | Existing plan flow/workspace preserved |

For 100, 500 and 1000 records the deterministic window contract renders 25 row items, reports the full result count, and clamps stale pages after a filter/search reduction. Empty results report `Mostrando 0 de 0`; error and empty states remain inside the contained workspace.

## Validation evidence

- Focused list tests: 10 passed.
- Full tests: 914 passed, 4 skipped across 174 files.
- Agents: 294/294 PASS.
- Lint: PASS.
- Build: PASS.
- `git diff --check`: PASS.
- Authenticated visual runner: 1847/1848 checks PASS across the repository viewport matrix. All R5 list surfaces covered by the runner passed at mobile, tablet and desktop widths. The one unrelated baseline finding is `ipad-820/home` header visibility; it does not touch R5 list surfaces and remains tracked as P2 outside this sprint.
- Additional authenticated structural QA at 390x844: Leads and Alerts both exposed the contained workspace, internal scroll region, no horizontal overflow and at most 25 rendered rows.
- Mobile CSS includes the iOS touch scrolling contract; no production JS scroll hack or scroll trap was added.

## Independent review

1. The list surfaces retain their existing information architecture and operational row semantics: PASS.
2. Business data remains loaded from the existing real-data read models: PASS.
3. Search, filter and sort semantics are preserved; changing them resets pagination deterministically: PASS.
4. Large arrays no longer create unbounded row DOM growth: PASS.
5. Error and empty states remain honest and contained: PASS.
6. Invoice and quote bulk selection still uses the complete filtered set, so pagination does not silently narrow a bulk action: PASS.
7. Mobile and tablet list density remains compact, with a bounded touch-scroll region and 44px pagination targets: PASS.
8. Desktop uses the available content width without introducing horizontal overflow: PASS.
9. Closings remains intentionally outside collection pagination because it is a fiscal output surface, not a large row collection: PASS.
10. No authentication, route, Supabase, invoice numbering, fiscal or financial-write regression was introduced: PASS.

## Severity matrix

- P0 = 0
- P1 = 0
- P2 = 1 — existing `ipad-820/home` authenticated visual baseline reports the Home header as not visible. This is outside R5 list scope and was not changed or downgraded.
- P3 = 0

## Final certification verdict

`R5_STATUS = PASS`

R5 is certified for the contained/scalable list architecture. The P2 above remains an explicit global baseline debt; it does not block R5 because no R5 surface regressed and all required list contracts passed.

`PRODUCTION_DEPLOY = NO`

`PRODUCTION_MUTATIONS = 0`

`SUPABASE_PRODUCTION_MUTATIONS = 0`

Global visual debts remain pending: single global brand lockup, branded preloader, stronger global color polish, premium chart polish, and strict monostep StepFlow architecture.
