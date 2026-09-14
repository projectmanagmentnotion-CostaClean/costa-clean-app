# V3 Legacy Presentation Audit

Status: `V3-6R GLOBAL CLOSED / CERTIFIED — exact viewport matrix deferred to V3-8`

Scope: every surface reachable from `?v3=1`, separating reusable business
logic from visible legacy presentation. No Supabase, auth, route or production
contract is changed by this audit.

| Surface | Legacy component observed | Business logic reused | V3 replacement | Status |
| --- | --- | --- | --- | --- |
| Servicios / Nuevo | `JobCreateFlow`, `FullscreenStepFlow`, `ActionFlowOverlay` | `saveJobWithLines`, prefills, validators, duplicate engine | `V3JobCreateFlow` + V3 primitives | PASS |
| Facturas / Nuevo-edición | V2 orchestration imports remain after the V3 branch | Existing invoice write/PDF/validation contracts | `V3InvoiceCreateFlow` + `V3InvoiceEditFlow` | PASS |
| Presupuestos / Nuevo-edición | V2 orchestration imports remain after the V3 branch | Existing quote lifecycle/PDF/share contracts | `V3QuoteCreateFlow` + `V3QuoteEditFlow` | PASS |
| Clientes / Nuevo-edición | `ClientCreateForm`, legacy detail/edit surfaces | Existing client writes/contact contracts | `V3ClientWriteFlow` + V3 workspace | PASS |
| Leads / Nuevo-edición | Legacy page flow surfaces | Existing lead lifecycle/conversion contracts | `V3LeadCreateFlow` + V3 workspace | PASS |
| Inmuebles / Nuevo-edición | `PropertyCreateFlow` where reached from parent wrappers | Existing property RPC/duplicate contracts | V3 list/workspace/create/edit native boundary | PASS |
| Cobros / Nuevo-edición | V2 orchestration imports remain after the V3 branch | Existing settlement/payment contracts | `V3PaymentCreateFlow` + `V3DuplicateReviewSheet` | PASS |
| Gastos / Nuevo-edición | V2 orchestration imports remain after the V3 branch | Existing expense/support contracts | `V3ExpenseFormFlow` create/edit | PASS |
| Filtros, selección, alertas, cierres | V3 primitives | Existing filter/selection/decision/snapshot contracts | V3 primitives | PASS |

## Classification

- Headless logic and contracts are allowed to remain in `src/features`.
- Visual legacy components, legacy flow shells, old toolbars and old modal
  styles are not allowed in the V3 reachable tree.
- `V3JobCreateFlow` is the first migrated P0 surface. It preserves the real
  write RPC, prefill context, duplicate prevention and current data shape.
- Financial V3-6R is closed because runtime reachability checks found native V3
  presentation for the financial surfaces and zero required legacy markers.
- Legacy implementations may remain for V2; their imports after a `v3Mode`
  return are not V3 reachability failures.

## V3-6R CRM zero-legacy closure

Authenticated QA reached Clients, Leads, Properties and nested Services through
native V3 list, workspace and action surfaces. Client create/persistence, lead
create/detail, property create/edit/reload, duplicate protection, service
prefill/persistence, relations, deep links and back navigation passed without
new fixtures or production writes. Legacy CRM runtime markers, visible UUIDs,
accessible/ARIA UUIDs and Unicode-as-icon candidates are all `0`.

Static responsive safety is `PASS`: the CRM changes introduce no new breakpoint
system, hardcoded page-width contract, `min-width` overflow dependency,
desktop-only fork, viewport-specific router or absolute-positioned responsive
architecture. CRM continues to use the certified V3 shell and primitives:
bottom navigation below `1024px`, rail at `1024px+`, and expanded desktop
treatment at `1280px+`.

The exact `390x844`, `768x1024`, `1280x800` and `1920x1080` matrix is deferred
to `V3-8 — Global E2E / Release` because this controlled-browser environment
does not expose deterministic viewport resizing or CDP/device metrics. This is
not an application failure and is not recorded as a viewport PASS.

`V3-6R CRM ZERO-LEGACY` and `V3-6R GLOBAL` are therefore `CLOSED / CERTIFIED`
with the exact responsive matrix deferred to V3-8.

## CSS and icons

V3 presentation comes from `src/v3/design/*` and V3 primitives. The shared
application still imports legacy CSS for non-V3 routes; that CSS is not
considered a V3 visual dependency until a V3 reachable component imports or
renders its selectors. Runtime audit of financial V3 list, workspace and create
surfaces found all required legacy DOM markers at `0`. V3 shell navigation
now uses inline vector paths through `V3NavIcon`; it does not use emoji or
improvised Unicode symbols.

## V3-6R GLOBAL closure audit

The global presentation boundary is now explicit and limited to `?v3=1`:

| Area | Result | Evidence |
| --- | --- | --- |
| Root/background ownership | PASS | V3 tokens own `html`, `body` and `#root`; V2 pseudo-elements are suppressed only under the V3 marker |
| Boot/preload/auth restoration | PASS | Native V3 loading/error/auth states; session behavior unchanged |
| AppView/lazy/Suspense fallbacks | PASS | V3 status/loading primitives; no V2 loader card in the V3 branch |
| Deep-link/recovery presentation | PASS | Existing navigation and preload recovery contracts preserved |
| Notifications/global confirmation | PASS | Toast state unchanged; V3 confirmation remains `V3ConfirmSheet` |
| Legacy global runtime | `0` | Static sweep plus controlled-browser smoke |
| Visible/accessibility UUID | `0` / `0` | No new global presentation leaks |
| Unicode-as-icon | `0` | Toast close control and V3 states use vector markup or no icon |
| Reduced motion/accessibility | PASS | Scoped V3 reduced-motion rule and semantic status/alert states |

Authenticated QA reload persisted the session. Non-destructive smoke passed for
Home, Invoices, Clients, Services, Payments and Expenses. Exact viewport matrix
remains `DEFERRED TO V3-8`; production and Supabase production were untouched.

`V3-6R GLOBAL` is `CLOSED / CERTIFIED`. Do not start V3-7A in this slice.
