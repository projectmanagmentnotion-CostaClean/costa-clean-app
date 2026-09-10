# Costa Clean App V3 — Editorial Simplified Design System

Status: `V3-3D CLOSED / CERTIFIED`. The Editorial Simplified tokens below are implemented behind the reversible `?v3=1` presentation flag. The repository remains authoritative for behavior, data and security. Mobile main legacy surfaces: `0`.

## Directional intent

Editorial SaaS Simplified is the only V3 direction: flat document surfaces, strong typography, generous whitespace, compact operational rows and one decision per screen. V3-2D applies the same approved primitives to services without changing business contracts. Work Report PDF is an operational summary, not a certification or tracking surface.

## Candidate token evidence from new Stitch canvases

| Area | Candidate evidence | State |
| --- | --- | --- |
| Base surface | `#FCFCFB` / white | Implemented in `src/v3/design/tokens.css` |
| Ink | `#111827` | Implemented in `src/v3/design/tokens.css` |
| Muted text | `#6B7280` | Implemented in `src/v3/design/tokens.css` |
| Structural border | `#E5E7EB`, hairline/1px separators | Implemented in `src/v3/design/tokens.css` |
| Costa Clean accent | `#0D9488`, used sparingly for primary/active states | Implemented in `src/v3/design/tokens.css` |
| Semantic states | Soft green success, soft amber pending/review, soft red risk/error; status never color-only | Constitutional requirement |
| Typography | Plus Jakarta Sans or Inter, one coherent family per approved direction | Human selection required |
| Controls | Minimum 44px, preferred 48px; safe-area aware | Constitutional requirement |
| Motion | Restrained functional motion with `prefers-reduced-motion` fallback | Constitutional requirement |

V3-1 selects Inter as the coherent family. Plus Jakarta Sans is not introduced in
this slice. Financial values use tabular numerals and the accent remains limited
to primary/active states.

V3-3A Home uses the Negocio hoy hierarchy: one hero financial decision, exactly
three compact secondary actions and one capped priority queue. It does not add
dashboard card duplication, GSAP dashboard motion, targets, margins or
synthetic executive metrics.

## Product hierarchy to preserve

- Home answers “cómo va mi negocio hoy” with no more than five compact decision blocks.
- Every KPI includes name, value, period/trend and a tap target to context.
- Invoices, quotes and payments are first-class financial surfaces.
- Entity workspaces are linear and flat: summary, identity, property/service, lines, payments, document and history; empty sections stay hidden.
- Secondary actions collapse into `Más`; no essential action depends on hover.
- Filters open in a bottom sheet. Multi-selection uses a compact selection bar.
- New invoice opens full-screen/StepFlow with the first actionable field immediately visible.

## Navigation contract

1. `Inicio · Trabajo · Clientes · Finanzas · Más`
2. `Inicio · Facturas · Clientes · Servicios · Más`

V3-1 uses `Inicio · Facturas · Clientes · Servicios · Más` on mobile. Existing
secondary `AppView` routes remain available through Más; no route is removed.

The V3 invoice vertical slice uses dedicated `V3InvoiceRow`,
`V3InvoiceWorkspace`, `V3Section`, `V3Status` and V3 action primitives. It does
not reuse the legacy master/detail or operational-card composition. The V3
quote surface uses the same approved row, status, section, workspace and
document-action primitives. Quote PDF, native share fallback and conversion
are real contracts; delivery/read/tracking claims remain excluded.

The V3 lead surface uses the same approved row, status, section, workspace,
contact and bottom-sheet primitives. Draft review means only the real
`lead_drafts.ai_draft_status` review; it must not be presented as business-lead
review without a separate source-of-truth contract.

The V3 Home surface uses `V3HomeHeroKpi`, `V3HomeMetric` and
`V3HomePriorityQueue` from `src/v3/home/`. Its KPI actions route through the
existing module filter contracts and its priority actions route through the
existing alert/operational action handlers.

V3-3B derives Payments and Expenses from the certified invoice, client and
workspace geometry. Both modules use flat entity rows, one small KPI area,
token-backed filters and the same full-screen workspace sections. No new card,
shadow, radius, status family, header or sheet geometry is introduced.

## Implementation guardrails

The V3 shell is activated only by `?v3=1` during migration. No business state,
auth state or Supabase contract is stored in the flag. Share and contact
actions are real local/browser actions; work-report PDF and business-lead
review claims remain hidden until real contracts exist.

## V3-4A selection surfaces

The selection trigger, checkbox, action bar, action sheet, confirmation sheet
and result sheet are token-backed V3 primitives. The action bar sits above
`--v3-bottom-nav-clearance`; it does not introduce a second dock or fixed magic
height. Selection controls retain accessible checkbox semantics and support an
indeterminate state.

The V3-4B audit does not add new selection visuals. The certified foundation is
used only by Invoices and Quotes; all remaining modules keep their compact
single-record rows and workspaces.

## V3-5 iPad adaptation — CLOSED / CERTIFIED

The iPad shell uses `--v3-nav-rail-width`, `--v3-content-gutter-tablet` and
`--v3-ipad-content-max`. The rail is a navigation presentation of the existing
five primary entries, not a new routing system. Authenticated certification
passed `384/384` checks across the required iPad, landscape and mobile
regression viewports.
