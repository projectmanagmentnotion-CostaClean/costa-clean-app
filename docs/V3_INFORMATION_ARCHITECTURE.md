# Costa Clean App V3 — Mobile Information Architecture

Status: recommended hypothesis pending Stitch approval. Mobile is the source of truth; iPad and desktop adaptations are explicitly deferred.

## Proposed shell

Bottom navigation with five stable destinations:

1. `Inicio` — priorities, alerts and next actions.
2. `Trabajo` — Leads, Presupuestos and Servicios.
3. `Clientes` — Clientes and Inmuebles.
4. `Finanzas` — Facturas, Cobros and Gastos.
5. `Más` — Alertas, Cierres, Configuración, audit/duplicates and lower-frequency tools.

This is a hypothesis, not a blind implementation decision. Stitch directions must test whether `Trabajo` and `Finanzas` labels are understandable to staff and whether alerts belong in `Inicio`, `Más`, or both as a badge/shortcut.

## Navigation model

```text
Bottom shell
├── Inicio
│   ├── Priority queue
│   ├── Alert shortcut
│   └── Recent / pending work
├── Trabajo
│   ├── Leads
│   ├── Presupuestos
│   └── Servicios
├── Clientes
│   ├── Clientes
│   └── Inmuebles
├── Finanzas
│   ├── Facturas
│   ├── Cobros
│   └── Gastos
└── Más
    ├── Alertas
    ├── Cierres
    ├── Configuración / cuenta
    ├── Duplicados / auditoría
    └── Secundarios
```

## Entity navigation

Every operational module follows:

`List → full-screen Entity Workspace → action or relationship`.

Mobile never renders a persistent master-detail split. A workspace has a back affordance, entity identity, status, one primary action, at most three quick actions and quiet detail sections.

## Search and filters

- Search is always the first control in a list.
- `Filtros` opens a bottom sheet containing status, date and sort options.
- Applied state is summarized in one compact control; advanced fields are not permanently stacked below search.
- Reset returns to the module default without losing the current navigation context.

## Selection mode

Normal list mode and selection mode are separate states.

- Entry: `Seleccionar` or a long-press enhancement where discoverable.
- Contextual header: back/cancel, selected count, select all.
- Sticky bottom actions: only actions valid for the selected entities.
- Exiting selection restores normal row navigation.

## Create/edit model

Create and edit are full-screen mobile flows with the first actionable field immediately visible.

```text
Open create
→ first required field
→ core fields in decision order
→ review / validation
→ save
```

Advanced fields live under `Más opciones`. Existing step flows, RPC payloads, validation, numbering and unsaved-change guards remain unchanged underneath the new shell.

## Deep links and back stack

- Direct links must open the correct module/workspace and preserve the existing query contract.
- Back from a workspace returns to the originating list with search/filter/selection context when safe.
- Unsaved changes still intercept navigation with the existing guard.
- Alerts, invoice/payment relations and document screens remain addressable from their source context.

## Desktop and iPad deferral

No desktop-first layout is approved in V3-0. The visual system will be proven at 390x844 and 430x932 first; iPad and desktop composition follows after mobile approval.
