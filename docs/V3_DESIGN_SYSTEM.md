# Costa Clean App V3 — Editorial Simplified Design System

Status: `V3-0E CLOSED / V3-1 ACTIVE`. The Editorial Simplified tokens below are now implemented behind the reversible `?v3=1` presentation flag. The repository remains authoritative for behavior, data and security.

## Directional intent

Editorial SaaS Simplified is the only V3 direction: flat document surfaces, strong typography, generous whitespace, compact operational rows and one decision per screen. V3-1 applies this to the shell and invoice vertical slice only.

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

## Implementation guardrails

The V3 shell is activated only by `?v3=1` during migration. No business state,
auth state or Supabase contract is stored in the flag. Share, contact actions,
work-report PDF and lead-review actions remain hidden until real contracts exist.
