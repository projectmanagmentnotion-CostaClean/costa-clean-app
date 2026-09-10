# V3 Legacy Presentation Audit

Status: `V3-6R OPEN — P0 service creation migrated`

Scope: every surface reachable from `?v3=1`, separating reusable business
logic from visible legacy presentation. No Supabase, auth, route or production
contract is changed by this audit.

| Surface | Legacy component observed | Business logic reused | V3 replacement | Status |
| --- | --- | --- | --- | --- |
| Servicios / Nuevo | `JobCreateFlow`, `FullscreenStepFlow`, `ActionFlowOverlay` | `saveJobWithLines`, prefills, validators, duplicate engine | `V3JobCreateFlow` + V3 primitives | PASS |
| Facturas / Nuevo-edición | `InvoiceCreateFlow`, `FullscreenStepFlow`, legacy nested forms | Existing invoice write/PDF/validation contracts | Pending native V3 flow | OPEN |
| Presupuestos / Nuevo-edición | `QuoteCreateFlow`, `QuoteEditFlow`, legacy overlay | Existing quote lifecycle/PDF/share contracts | Pending native V3 flow | OPEN |
| Clientes / Nuevo-edición | `ClientCreateForm`, legacy detail/edit surfaces | Existing client writes/contact contracts | Pending native V3 flow | OPEN |
| Leads / Nuevo-edición | Legacy page flow surfaces | Existing lead lifecycle/conversion contracts | Pending native V3 flow | OPEN |
| Inmuebles / Nuevo-edición | `PropertyCreateFlow` where reached from parent wrappers | Existing property RPC/duplicate contracts | V3 list/workspace native; create entry audit pending | OPEN |
| Cobros / Nuevo-edición | `PaymentCreateFlow`, `ActionFlowOverlay` | Existing settlement/payment contracts | Pending native V3 flow | OPEN |
| Gastos / Nuevo-edición | `ExpenseCreateFlow`, `ExpenseEditFlow`, legacy overlay | Existing expense/support contracts | Pending native V3 flow | OPEN |
| Filtros, selección, alertas, cierres | V3 primitives | Existing filter/selection/decision/snapshot contracts | V3 primitives | PASS |

## Classification

- Headless logic and contracts are allowed to remain in `src/features`.
- Visual legacy components, legacy flow shells, old toolbars and old modal
  styles are not allowed in the V3 reachable tree.
- `V3JobCreateFlow` is the first migrated P0 surface. It preserves the real
  write RPC, prefill context, duplicate prevention and current data shape.
- V3-6R remains OPEN until all rows marked OPEN are migrated and re-certified.

## CSS and icons

V3 presentation comes from `src/v3/design/*` and V3 primitives. The shared
application still imports legacy CSS for non-V3 routes; that CSS is not
considered a V3 visual dependency until a V3 reachable component imports or
renders its selectors. V3 shell navigation now uses inline vector paths through
`V3NavIcon`; it does not use emoji or improvised Unicode symbols.
