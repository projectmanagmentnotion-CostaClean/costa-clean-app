# Costa Clean App V3 — Visual Direction V2

Status: `V3-0B READY FOR HUMAN APPROVAL — NO IMPLEMENTATION`

## Objective

Reframe Costa Clean as a modern, simple, friendly, light and minimalist financial/admin product. The app should answer “cómo va mi negocio hoy” quickly, with invoices, quotes, receivables, payments, clients, services, leads, expenses, alerts and closings as the priority vocabulary. The former dark operational-center visual direction is rejected.

## Product guardrails

- Mobile-first is the primary contract, beginning at 390x844.
- One screen equals one decision; one primary action equals one consequence.
- Preserve routes, auth, Supabase, invoices, quotes, clients, services and financial logic.
- No GPS, telemetry, photos, fleet language, invented backend or real customer data.
- Avoid card soup, decorative charts, gradients, excessive pills and uppercase UI.
- Use compact lists, flat workspaces and sheets for advanced filters.

## Shared visual foundation

The three new Stitch canvases converge on: near-white/off-white background, white content surfaces, deep ink, muted gray, hairline borders, restrained Costa Clean teal and soft semantic states. Candidate references are `#F8F9FB`, `#FAFAF8` or `#FCFCFB`; `#111827`/`#1F2937`; `#6B7280`; `#E5E7EB`; plus green/amber/red semantic colors. The final token set and font remain pending human selection.

Typography candidates are Inter or Plus Jakarta Sans, with one coherent family per approved direction. Touch targets are preferably 48px, safe areas are mandatory and reduced motion is required.

## KPI and home hierarchy

Home uses a maximum of five compact decision blocks. Each KPI shows its name, value, period/trend and an explicit path to context. The hierarchy covers billing, receivables/collected, open quotes, services pending/unbilled, expenses and alerts without duplicating the same information in multiple cards.

## Entity hierarchy

- Invoice: total/status and `Marcar pagada` or equivalent primary action, then client, property, service, lines, payments, document and history.
- Quote: total/status and `Aceptar` or `Crear servicio`, then client, property, service, lines and follow-up context.
- Payments: client, invoice, date, amount and method; finance-first language.
- Client: identity, financial health, active properties and useful history; hide empty sections.
- Service: completion, billable state, margin/value and invoice action; no dispatch dashboard.
- Lead: person, request, service, date, status and next action; no giant photo treatment.

## Navigation alternatives

1. `Inicio · Trabajo · Clientes · Finanzas · Más`
2. `Inicio · Clientes · Servicios · Facturas · Más`

Finance Minimal is recommended because `Finanzas` is explicit and the financial workspaces are easiest to scan. The reviewer may select the second option if the generated Friendly Business shell proves faster for daily use.

## Stitch directions

| Direction | Project | Distinctive promise | Review verdict |
| --- | --- | --- | --- |
| Finance Minimal | [16933552908903861488](https://stitch.withgoogle.com/projects/16933552908903861488?hl=es&pli=1) | Finance-first hierarchy, compact operational density, invoice/receivable clarity | Recommended candidate |
| Friendly Business | [5385378961807597557](https://stitch.withgoogle.com/projects/5385378961807597557?hl=es&pli=1) | Warmest and most tactile native business shell | Strong alternative |
| Editorial SaaS | [6884707630640107069](https://stitch.withgoogle.com/projects/6884707630640107069?hl=es&pli=1) | Typographic hierarchy, flat documents and generous air | Strong alternative for a lighter tone |

Each project was prompted for the full 12-screen set: Home, Facturas list, Factura workspace, Presupuestos list, Presupuesto workspace, Clientes list, Cliente workspace, Servicios list, Lead workspace, filters bottom sheet, multi-selection and Nueva factura full-screen. Stitch has generated visible first batches and is continuing the remaining screens in the canvases; the human reviewer must mark every screen `PASS`, `PARTIAL` or `WAITING_FOR_STITCH`.

## Approval and next step

The only next step is human approval of one direction plus the screen-by-screen visual review at 390x844, 768x1024 and 1440x900. Until that gate closes, V3-1 implementation is not authorized and production remains untouched.
