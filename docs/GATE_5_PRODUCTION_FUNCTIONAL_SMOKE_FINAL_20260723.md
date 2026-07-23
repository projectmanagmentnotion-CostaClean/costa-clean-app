# Gate 5 — Production Functional Smoke Final — 2026-07-23

## Verdict

- Gate: `5`
- Result: `PASS`
- Roadmap status: `CLOSED`
- Production target: `wfxnwfcdjainpojhbdri`
- Domain: `https://app.costacleanbcn.com`
- Production ready for normal operation: `YES`
- P0 open: `0`
- P1 open: `0`

## Scope and immutable boundaries

This corrective closeout changed only the authenticated frontend logout lifecycle, its account-menu presentation, regression tests and closeout documentation. It did not change Supabase Auth configuration, users, providers, RLS, RPCs, Edge Functions, secrets, SQL, migrations, migration history, schema, QA or business data.

No client, property, lead, quote, job, invoice, payment, expense, closing, recurring plan or quiz attempt was created, edited or deleted. Financial/fiscal writes, business writes, full-submit and real-data changes were all `0`.

## Git and deployment evidence

- Mandatory initial HEAD: `db3dd1a516f57de0504c7682e884c1e92dd33a3e`
- Runtime logout commit: `f2ba980e1b10c17a3c4f8441a54890e3839f01d9`
- Mobile viewport correction: `2d63f6bc1798ff5a2c79347730881b894f790253`
- Runtime pushes: `origin/main` confirmed after each commit.
- Vercel project: `costa-clean-app`
- Git-triggered production deployment for the final runtime state: `dpl_4DDzs7QFgBXEjY1SrANtPUwKVqYb`
- Deployment URL: `https://costa-clean-izq9143qo.vercel.app`
- Deployment status: `READY`
- Canonical domain: HTTP `200`
- Canonical deployed CSS: `assets/index-ZoQli6dg.css`, matching the final local build.
- No manual duplicate deployment was started because GitHub created the production deployment.
- DNS and Vercel environment variables: unchanged.

## Auth implementation

- The existing singleton Supabase client remains the only client.
- `client.auth.signOut()` is coordinated through one centralized logout flow.
- A concurrency guard returns `already-pending` and prevents a second provider call.
- Pending state disables the logout control.
- Successful logout uses the existing selective `clearStoredSupabaseSession()` helper, clears the React session and unmounts `AppShell`, thereby dropping authenticated in-memory data.
- The existing `onAuthStateChange` listener now handles `SIGNED_OUT` and clears only Supabase session storage.
- There is no `localStorage.clear()` or `sessionStorage.clear()`.
- Public standalone routes still return before the authenticated shell and never render the account menu.

## Account menu and accessibility

- Desktop and tablet expose one compact account trigger with the minimum identity (email or `Mi cuenta`).
- Mobile integrates the same logout flow into the existing `Mas` sheet; no new bar or duplicate panel was added.
- Each active viewport exposes exactly one visible logout control.
- Native buttons provide Tab and Enter behavior.
- Opening the menu moves focus to the logout/close control.
- `Escape` closes the menu and returns focus to its trigger.
- The pending label is `Cerrando sesión…`; the action is disabled until completion.
- Failure preserves the session and emits only: `No se pudo cerrar la sesión. Inténtalo de nuevo.`

## Production logout and login smoke

The production session was tested in visible Chrome on the canonical domain:

1. Account access appeared with minimum identity.
2. The menu opened; `Escape` closed it and returned focus.
3. Reopening and selecting `Cerrar sesión` removed the authenticated shell and dashboard immediately.
4. The public login screen appeared with no protected navigation.
5. Browser Back did not restore functional protected content.
6. A new navigation/reload of the canonical domain remained logged out.
7. The user completed the visible login personally; no password, MFA, cookie, token or storage state was read or persisted by the sprint.
8. Dashboard access returned and persisted after reload.

No console error was observed during logout, login, reload or the post-login matrix. The canonical domain stayed HTTP `200`; no persistent network error or `5xx` was observed.

## Authenticated module matrix

The following production modules were opened read-only. Every destination had the expected `?view=`, active navigation item and loaded shell content:

| Module | Result |
| --- | --- |
| Inicio / Dashboard | PASS |
| Leads | PASS |
| Clientes | PASS |
| Inmuebles | PASS |
| Presupuestos | PASS |
| Servicios | PASS |
| Facturas | PASS |
| Cobros / Pagos | PASS |
| Gastos | PASS |
| Cierre fiscal | PASS |

The public gym manual quiz also loaded on `/manual-quiz`, exposed no account control or authenticated navigation, and was not started or submitted.

## Responsive evidence

| Viewport | Evidence | Result |
| --- | --- | --- |
| Desktop `1440x900` | One logout; popover fully inside viewport; no horizontal overflow; Escape/focus return | PASS |
| Tablet `768x1024` | One logout; popover fully inside viewport; no horizontal overflow; Escape/focus return | PASS |
| Mobile `390x844` | One logout; sheet `top: 8`, `bottom: 844`; internal scroll; no horizontal overflow; Escape/focus return | PASS |

The first mobile production check found the expanded sheet extending above the viewport. The scoped correction added a viewport maximum and internal section scrolling, was committed, deployed and revalidated before this gate was closed.

## Automated quality evidence

- Auth/logout regression tests: `3/3` PASS.
- Full suite: `239/239` PASS across `49` files.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- Production bundle output: approximately `7.4 MB` total local `dist`; main JS gzip approximately `105.11 kB`.
- `git diff --check`: PASS.
- Import/type resolution: PASS through TypeScript/Vite production build.
- `npm run db:push`: intentional `exit 1`.
- `npm run supabase:db:push`: intentional `exit 1`.
- Versioned JWT/access-token values: `0`.
- Versioned private auth/QA artifacts: `0`; `.env.example` and `.env.qa.example` are public templates, not private artifacts.

## Preserved risks and deferred work

- `db push` remains fail-closed. Metadata repair did not prove the physical migration chain produces zero SQL.
- Remote disposable Supabase proof remains deferred; the local PostgreSQL proof is not Supabase Cloud equivalence.
- The current authorization model remains valid only for one mutually trusted internal Costa Clean workspace. Another company or differently trusted users require a new tenancy/ownership gate before onboarding.
- Providerless quiz protection reduces abuse but does not prove a human against distributed attackers.
- Turnstile remains deferred until real abuse metrics justify a separate provider/privacy gate.
- Optional A/B/C remain deferred.
- Financial full-submit remains unauthorized.

## Closeout

Gate 4B is `DONE`. Gate 4C is `DONE`. Gate 5 is `DONE`. The mandatory final roadmap is `CLOSED`; normal operation may begin under the preserved controls above.
