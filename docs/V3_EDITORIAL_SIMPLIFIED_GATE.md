# Costa Clean App V3 — V3-0C Editorial SaaS Simplified Gate

Status: `PARTIAL — WAITING_FOR_STITCH AND HUMAN FINAL APPROVAL`. No production implementation is authorized.

## Scope closed in this work block

V3-0C requests one final visual direction in the existing Stitch project:

- Project: [Costa Clean Editorial SaaS](https://stitch.withgoogle.com/projects/6884707630640107069?hl=es&pli=1)
- Viewport contract: `390x844` first; `768x1024`, `1440x900` and `320px` safe-failure remain required before implementation.
- Direction: `COSTA CLEAN V3 — EDITORIAL SIMPLIFIED`.
- Production code, routes, auth, Supabase and financial contracts: unchanged.

## Stitch evidence

The V3-0C prompt was submitted in the existing canvas. Stitch completed only a partial batch:

| Requested evidence | Stitch state | Gate |
| --- | --- | --- |
| Home simplified | Generated; KPI, receivables, open quotes, unbilled services and three operational actions visible | `PARTIAL` |
| Facturas list simplified | Generated; compact header, KPI, search, filters, tabs, rows, PDF and eligible “Marcar pagada” visible | `PARTIAL` |
| Invoice workspace | Not regenerated in the final batch; previous invented workspace remains visible | `WAITING_FOR_STITCH` |
| Quotes list/workspace | Not regenerated in the final batch | `WAITING_FOR_STITCH` |
| Clients list/workspace | Not regenerated in the final batch | `WAITING_FOR_STITCH` |
| Services list/workspace | Not regenerated in the final batch | `WAITING_FOR_STITCH` |
| Lead workspace | Not regenerated in the final batch | `WAITING_FOR_STITCH` |
| Filters | Not regenerated in the final batch | `WAITING_FOR_STITCH` |
| Bulk selection | Not regenerated in the final batch | `WAITING_FOR_STITCH` |
| New invoice StepFlow | Not regenerated in the final batch | `WAITING_FOR_STITCH` |

The generated Home still contains one copy/detail requiring human review (`cuadrillas`), so it is not a clean PASS despite the simplified structure. The generated Facturas list is the strongest evidence of the intended flat editorial pattern, but it cannot approve the remaining screens.

## Domain-contract review

This is a repository evidence review against `docs/V3_FUNCTIONAL_INVENTORY.md`, `docs/V3_USER_JOURNEYS.md` and `docs/UX_OPERATIONAL_MOBILE_V2_REGRESSION_MATRIX.md`. It is not an implementation claim and does not replace human approval.

| UI element/action | Real contract | Decision |
| --- | --- | --- |
| Home: monthly billing KPI | Yes | Keep |
| Home: receivables, open quotes, unbilled services | Yes | Keep |
| Home: priority deep-links to real work | Yes | Keep, maximum three |
| Invoice download PDF | Yes | Keep |
| Mark invoice paid | Yes, only for eligible invoice states | Keep conditionally |
| Share/WhatsApp read receipts/eIDAS/IBAN invented | No | Remove |
| Quote download | Yes | Keep |
| Quote accept/convert/create service or invoice | Conditional on real lifecycle/state | Keep contextually only |
| Client contact and related entities | Yes when data exists | Keep; hide empty sections |
| Client LTV, protocols, fake badges, mandatory images | No | Remove |
| Service job complete, invoice, open invoice | Yes, state-dependent | Keep contextually |
| Service tariff catalog as primary module | No | Remove |
| Lead review, contact, create quote | Yes, state/data-dependent | Keep contextually |
| Lead property value, estimates, verifications | No | Remove |
| Bulk invoice download and eligible settlement | Yes | Keep |
| Bulk reminders, SEPA XML, automatic collection | No | Remove |
| New invoice client, lines, amount, VAT, summary, create | Yes | Keep as StepFlow |
| New invoice bank, IBAN, automatic messaging, advanced accounting | No | Remove; advanced real fields stay collapsed |

## Exit condition

V3-1 remains blocked. Stitch must produce the missing requested screens, remove the remaining invented copy/actions, and the human reviewer must mark every screen `PASS` at the required anchors. Only then may a separate implementation plan be approved.
