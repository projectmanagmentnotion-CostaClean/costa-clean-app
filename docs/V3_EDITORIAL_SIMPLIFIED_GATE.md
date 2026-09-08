# Costa Clean App V3 — V3-0E Clean Final Stitch Export Gate

Status: `READY FOR HUMAN FINAL APPROVAL`. No production implementation is authorized.

## Scope closed in this work block

V3-0E is an export/cleanup gate only. The approved Stitch canvas now contains the
13 final V3 screens plus the optional Editorial Monogram design-system frame.
Obsolete frames were removed from the active canvas and are excluded from the
clean ZIP artifact. No production code, routes, auth, Supabase or financial
contracts were changed.

V3-0C requests one final visual direction in the existing Stitch project:

- Project: [Costa Clean Editorial SaaS](https://stitch.withgoogle.com/projects/6884707630640107069?hl=es&pli=1)
- Viewport contract: `390x844` first; `768x1024`, `1440x900` and `320px` safe-failure remain required before implementation.
- Direction: `COSTA CLEAN V3 — EDITORIAL SIMPLIFIED`.
- Production code, routes, auth, Supabase and financial contracts: unchanged.

## Stitch evidence

| Final V3 screen | Result |
| --- | --- |
| Home — Negocio Hoy (Simplificado) | `PASS` |
| Facturas — Listado (Simplificado) | `PASS` |
| Factura FAC-2024-108 (Workspace Final) | `PASS` |
| Presupuestos — Listado Final | `PASS` |
| Presupuesto PRES-2024-041 (Workspace Final) | `PASS` |
| Clientes — Listado Final | `PASS` |
| Cliente — Dra. Elena Vázquez (Workspace Final) | `PASS` |
| Servicios — Listado Final | `PASS` |
| Servicio SRV-2024-089 (Workspace Final) | `PASS` |
| Lead — Carlos Montero (Workspace Final) | `PASS` |
| Filtros Facturas — Final | `PASS` |
| Facturas — Selección Múltiple Final | `PASS` |
| Nueva Factura — Final | `PASS` |

The optional `Costa Clean Editorial Monogram` frame is included only as the
visual reference/design-system companion. The native Stitch export retained
historical artifacts, so the final ZIP was rebuilt from the verified final
screen folders and re-inventoried. Obsolete screen folders in the final ZIP: 0.

The earlier V3-0C prompt was submitted in the existing canvas. Its partial state is historical evidence only:

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

## V3_USEFUL_STITCH_FEATURE_BACKLOG

The new V3 rule allows Stitch to propose useful functionality. Each proposal was
audited against existing repository contracts, user value and implementation
risk. None is implemented in V3-0E.

| Feature | User value | Existing contract | Needed work | Risk | Class | Target V3 slice |
| --- | --- | --- | --- | --- | --- | --- |
| WhatsApp client action | Fast contextual contact from a client/lead workspace | Client/lead phone fields exist; no delivery/read state contract | Normalize E.164, show only valid numbers, `wa.me`/WhatsApp Web with safe fallback and tests | Medium: malformed numbers or implied delivery state | `B` | V3-2 client/lead workspace actions |
| Call client action | Start a real phone call from available contact data | `clients.phone`/`leads.phone` are real fields | `tel:` action, validation and mobile/desktop accessibility tests | Low; phone normalization still matters | `B` | V3-2 client/lead workspace actions |
| Email client action | Open the user's mail client with contextual recipient | Client/lead email fields exist | `mailto:` action, valid-email guard and safe empty-state tests | Low; never imply sent/delivered | `B` | V3-2 client/lead workspace actions |
| Share PDF/document | Share a real invoice/quote/service document with a fallback | Existing PDF generators/download flows; no shared-document action contract | Web Share API capability check, generated PDF handoff, download/open fallback and tests | Medium: browser capability and document privacy | `C` | V3-3 documents/share contract |
| Contextual invoice action | Settle, register a payment or download the real invoice without hunting | `settle_invoice_by_transfer`, payment refresh, invoice PDF and lifecycle contracts exist | Connect contextual UI to existing guarded actions; preserve eligibility and audit tests | High if UI bypasses financial guards | `A` | V3-2 invoice workspace |
| Contextual quote conversion | Convert an accepted quote without losing quote/invoice relation | `accept_quote_workflow` supports lifecycle and optional invoice creation | Surface only for valid quote states and wire existing workflow with regression tests | High: duplicate invoice or invalid lifecycle | `A` | V3-2 quote workspace |
| Contextual service invoicing | Invoice completed/billable work while keeping service context | Jobs/services relate to quote/invoice; invoice creation is state-dependent | Define the UI entry point and guard against duplicate/missing service relation; add contract tests | High: duplicate or premature billing | `B` | V3-2 service workspace |

Rejected unless a later real source of truth exists: WhatsApp read/verified state,
eIDAS claims, biometrics, GPS, tracking, telemetry, SEPA XML, automatic
collection, invented LTV, invented margins and invented certifications.

## Exit condition

V3-1 remains blocked until the human reviewer approves this complete export gate.
The next implementation slice must be separately authorized; V3-0E itself does
not implement the backlog.
