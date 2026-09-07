# Costa Clean App V3 — Design System V3-0C Editorial Simplified

Status: `PARTIAL CANDIDATE — HUMAN FINAL APPROVAL REQUIRED`. This document records the V3-0C Stitch evidence only. It is not an implementation contract yet. The old V3-0B alternatives and Direction B token set are superseded.

## Directional intent

Editorial SaaS Simplified is the only V3-0C direction under review: flat document surfaces, strong typography, generous whitespace, compact operational rows and one decision per screen. This is not approval for production.

## Candidate token evidence from new Stitch canvases

| Area | Candidate evidence | State |
| --- | --- | --- |
| Base surface | `#FCFCFB` / white | Candidate; human approval required |
| Ink | `#111827` | Candidate; human approval required |
| Muted text | `#6B7280` | Candidate |
| Structural border | `#E5E7EB`, hairline/1px separators | Candidate |
| Costa Clean accent | `#0D9488`, used sparingly for primary/active states | Candidate |
| Semantic states | Soft green success, soft amber pending/review, soft red risk/error; status never color-only | Constitutional requirement |
| Typography | Plus Jakarta Sans or Inter, one coherent family per approved direction | Human selection required |
| Controls | Minimum 44px, preferred 48px; safe-area aware | Constitutional requirement |
| Motion | Restrained functional motion with `prefers-reduced-motion` fallback | Constitutional requirement |

The V3-0C generated Stitch system exposes Plus Jakarta Sans for headlines, Inter for body/labels, `#0D9488` primary, `#059669` semantic success and `#111827` neutral. These values are evidence to review, not approved production tokens.

## Product hierarchy to preserve

- Home answers “cómo va mi negocio hoy” with no more than five compact decision blocks.
- Every KPI includes name, value, period/trend and a tap target to context.
- Invoices, quotes and payments are first-class financial surfaces.
- Entity workspaces are linear and flat: summary, identity, property/service, lines, payments, document and history; empty sections stay hidden.
- Secondary actions collapse into `Más`; no essential action depends on hover.
- Filters open in a bottom sheet. Multi-selection uses a compact selection bar.
- New invoice opens full-screen/StepFlow with the first actionable field immediately visible.

## Navigation candidates for review

1. `Inicio · Trabajo · Clientes · Finanzas · Más`
2. `Inicio · Facturas · Clientes · Servicios · Más`

V3-0C asks Stitch to compare both patterns and prioritize one-tap access to Facturas, Clientes and Servicios. The reviewer must approve the final navigation before V3-1.

## Approval gate

Do not implement these tokens, directions or navigation candidates in the productive shell until Stitch completes the requested screen set, invented content is removed, the human reviewer completes the visual review and the regression contract is confirmed. V3-1 remains blocked by design approval, not by an implementation defect.
