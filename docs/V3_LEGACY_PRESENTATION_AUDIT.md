# V3 Legacy Presentation Audit

Status: `V3-6R FINANCIAL ZERO-LEGACY CLOSED / CERTIFIED — CRM surfaces remain open`

Scope: every surface reachable from `?v3=1`, separating reusable business
logic from visible legacy presentation. No Supabase, auth, route or production
contract is changed by this audit.

| Surface | Legacy component observed | Business logic reused | V3 replacement | Status |
| --- | --- | --- | --- | --- |
| Servicios / Nuevo | `JobCreateFlow`, `FullscreenStepFlow`, `ActionFlowOverlay` | `saveJobWithLines`, prefills, validators, duplicate engine | `V3JobCreateFlow` + V3 primitives | PASS |
| Facturas / Nuevo-edición | V2 orchestration imports remain after the V3 branch | Existing invoice write/PDF/validation contracts | `V3InvoiceCreateFlow` + `V3InvoiceEditFlow` | PASS |
| Presupuestos / Nuevo-edición | V2 orchestration imports remain after the V3 branch | Existing quote lifecycle/PDF/share contracts | `V3QuoteCreateFlow` + `V3QuoteEditFlow` | PASS |
| Clientes / Nuevo-edición | `ClientCreateForm`, legacy detail/edit surfaces | Existing client writes/contact contracts | Pending native V3 flow | OPEN |
| Leads / Nuevo-edición | Legacy page flow surfaces | Existing lead lifecycle/conversion contracts | Pending native V3 flow | OPEN |
| Inmuebles / Nuevo-edición | `PropertyCreateFlow` where reached from parent wrappers | Existing property RPC/duplicate contracts | V3 list/workspace native; create entry audit pending | OPEN |
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
  return are not V3 reachability failures. CRM rows remain open.

## CSS and icons

V3 presentation comes from `src/v3/design/*` and V3 primitives. The shared
application still imports legacy CSS for non-V3 routes; that CSS is not
considered a V3 visual dependency until a V3 reachable component imports or
renders its selectors. Runtime audit of financial V3 list, workspace and create
surfaces found all required legacy DOM markers at `0`. V3 shell navigation
now uses inline vector paths through `V3NavIcon`; it does not use emoji or
improvised Unicode symbols.
