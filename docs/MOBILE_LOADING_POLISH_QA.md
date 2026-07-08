# Mobile Loading Polish QA

## Scope

Sprint focused on reducing mobile/iPad loading noise without touching Supabase, SQL, RPC, migrations, auth, routes, `?view=`, `financialWriteApi`, numbering, fiscal logic, persistence, or data contracts.

## Target

- loading must stay discrete and stable on mobile
- no fake stacks of large cards during reload
- no `0` placeholders while data is still loading
- no premature empty states
- max `3` compact skeleton rows on mobile

## Code changes applied

- `AppShellViewRenderer` now uses a shared compact loading pattern instead of `hero + 3 cards + loading empty-state`
- a short delay avoids expanded loading UI during very fast transitions
- `DeferredContentFallback` and `DSLoadingState` now reuse the same compact inline loading primitive
- `DSEmptyState` gains a compact variant so empty states consume less height on mobile
- new shared primitive: `DSPageLoading`

## Real findings

- the previous shell loading pattern was the main regression source in mobile reloads because it rendered multiple large placeholder cards
- the old fallback pattern reused `empty-state` framing for loading, which made temporary states feel larger than real content
- empty states were visually heavier than necessary in narrow viewports

## QA status

### Technical validation

- `npm run lint` passed
- `npm run build` passed

### Live validation

- The in-app browser remained available as context, but browser automation against the current authenticated tab timed out repeatedly during reload/navigation attempts in this sprint.
- A secondary live check against the local app URL was still executed from a headless browser, but that browser did not inherit the authenticated in-app session and therefore only confirmed boot/auth behavior, not authenticated module content.
- Because of that limitation, authenticated live QA for `clients`, `properties`, `invoices`, `expenses`, `payments`, `jobs`, `quotes`, `dashboard`, and `fiscal_closing` remains partially blocked for this sprint and must be re-run when the authenticated browser surface responds again.

## Residual risk

- Authenticated visual confirmation of the new loading pattern inside `?view=clients` is still pending due browser automation timeouts on the live in-app tab.
- The code path changed is shared and low-risk, but final authenticated visual confirmation is still required.
