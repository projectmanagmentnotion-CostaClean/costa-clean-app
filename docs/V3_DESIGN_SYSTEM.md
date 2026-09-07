# Costa Clean App V3 — Design System V3-0B Candidate

Status: `CANDIDATE — HUMAN APPROVAL REQUIRED`. This document records the new Stitch evidence only. It is not an implementation contract yet. The old Direction B token set is rejected and must not be used as a visual base.

## Directional intent

- Finance Minimal: strongest financial hierarchy and invoice/receivable scanability.
- Friendly Business: warmest, most approachable shell and clearest tactile affordances.
- Editorial SaaS: flattest surfaces, strongest typography and most generous whitespace.

The recommended working candidate is Finance Minimal, with Friendly Business warmth and Editorial SaaS flatness as review references. This recommendation is not approval.

## Candidate token evidence from new Stitch canvases

| Area | Candidate evidence | State |
| --- | --- | --- |
| Base surface | `#F8F9FB` / white in Finance Minimal; `#FAFAF8` / white in Friendly Business; `#FCFCFB` / white in Editorial SaaS | Human selection required |
| Ink | `#111827` / deep ink; Friendly Business also exposes `#1F2937` | Human selection required |
| Muted text | `#6B7280` | Candidate |
| Structural border | `#E5E7EB`, hairline/1px separators | Candidate |
| Costa Clean accent | Teal, used sparingly for primary/active states | Candidate |
| Semantic states | Soft green success, soft amber pending/review, soft red risk/error; status never color-only | Constitutional requirement |
| Typography | Plus Jakarta Sans or Inter, one coherent family per approved direction | Human selection required |
| Controls | Minimum 44px, preferred 48px; safe-area aware | Constitutional requirement |
| Motion | Restrained functional motion with `prefers-reduced-motion` fallback | Constitutional requirement |

Finance Minimal additionally exposed a generated Stitch system named `Nordic Operational Clarity` with Plus Jakarta Sans headline, Inter body/labels, `#1E3A8A` primary, `#2563EB` secondary, `#059669` tertiary and `#111827` neutral. These values are evidence to review, not approved production tokens.

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
2. `Inicio · Clientes · Servicios · Facturas · Más`

Finance Minimal is the current recommendation for making `Finanzas` explicit. The reviewer must select the final navigation before V3-1.

## Approval gate

Do not implement these tokens, directions or navigation candidates in the productive shell until the human reviewer approves one Stitch direction, completes the 12-screen visual review and confirms the regression contract. V3-1 remains blocked by design approval, not by an implementation defect.
