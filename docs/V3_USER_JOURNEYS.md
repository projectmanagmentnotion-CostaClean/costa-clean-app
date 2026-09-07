# Costa Clean App V3 — User Journeys

Status: discovery baseline. Click counts are estimates from the current component structure and should be validated against approved Stitch prototypes before implementation.

## Journey scorecard

| Journey | Current estimated path | V3 target | Primary success signal |
| --- | ---: | ---: | --- |
| New request → review | 4–7 | 2–4 | reviewer sees context and next decision immediately |
| Lead → quote | 5–9 | 3–5 | quote starts with preserved lead/client context |
| Quote → service | 3–6 | 2–3 | accepted quote exposes `Crear servicio` as primary |
| Quote → invoice | 3–6 | 2–3 | accepted quote exposes invoice conversion without hunting |
| Invoice → paid | 3–6 | 1–3 | list or workspace exposes one clear collection action |
| Invoice → download | 2–4 | 1–2 | direct list/workspace document action |
| Service → complete → invoice | 5–9 | 3–5 | context stays visible through completion and billing |
| Client → property → service | 3–6 | 2–4 | client workspace reveals relevant relationship only |
| Expense → support/review | 4–7 | 2–4 | document support and fiscal risk are immediately legible |
| Alert → action → resolved | 3–6 | 2–4 | alert action opens exact target and decision state persists |
| Closing → missing support | 4–8 | 2–4 | primary incidence leads directly to the missing record |

## 1. Nueva solicitud

Current shape: public intake or lead context is opened, the reviewer navigates through the lead and related records, then decides whether to contact, convert or quote.

V3 flow: `Solicitud nueva → contexto esencial → Revisar/contactar → Convertir o crear presupuesto`.

- Primary decision: what should staff do next?
- Keep: intake/lead identity, request message, source, duplicate/review state and conversion relation.
- Hide until needed: raw internal IDs, unrelated KPI/checklist panels and empty relationship sections.
- Target: 2–4 meaningful taps after opening the request.

## 2. Lead → quote

V3 flow: `Lead workspace → Crear presupuesto → client/context prefilled → review → save/send`.

- Primary action: `Crear presupuesto` when the lead is quote-ready.
- Secondary: contact, mark reviewed, open related client.
- Protect: quote line/pricing RPC, fiscal assumptions, duplicate and unsaved-change guards.

## 3. Quote lifecycle

V3 flow: `Quote list → quote workspace → next commercial state`.

- Draft/sent: primary action is edit/send/follow up based on state.
- Accepted without service: primary action is `Crear servicio`.
- Accepted without invoice: primary action is invoice conversion.
- Document action: `Descargar` remains direct and does not require opening detail.
- Bulk mode: separate selection header and bottom action bar; never mix with normal navigation.

## 4. Invoice collection

V3 flow: `Invoice list → invoice workspace → Marcar pagada / Registrar cobro`.

- Pending: primary `Marcar pagada`; quick `Descargar`, `Compartir`; more contains edit/cobros/archive/etc.
- Partially paid: show total, paid and outstanding; primary settles only current outstanding through the existing financial contract.
- Paid: remove settlement CTA and lead with closed status and traceability.
- Protect: invoice numbering, payment amount, status refresh, audit and reload persistence.

## 5. Service execution

V3 flow: `Services list → service workspace → status/context → Completar → Facturar`.

- Primary action depends on lifecycle state.
- Keep client/property, schedule, service lines, notes and quote/invoice links in one readable workspace.
- Make completion consequence explicit; do not hide it behind a generic overflow menu.

## 6. Client relationship

V3 flow: `Clients list → client workspace → relevant relationship section`.

- Summary: identity, status, pending balance and next operational action.
- Tabs/sections: properties, services, quotes, invoices, payments only when non-empty or explicitly requested.
- One tap from a pending balance to the exact invoice workspace.

## 7. Expense review

V3 flow: `Expenses list → expense workspace → support/review → save`.

- Primary: add missing support or resolve fiscal review state.
- Show amount, supplier, date, category and support status before secondary metadata.
- Preserve document preview/download and closing links.

## 8. Alert resolution

V3 flow: `Alert queue → exact target → decision/action → resolved/dismissed`.

- The alert explains impact and exposes one direct action label.
- Read, acknowledge, dismiss and reopen states remain persisted.
- No alert should require understanding the underlying module structure first.

## 9. Closing review

V3 flow: `Closing → primary incidence → exact invoice/payment/expense list → fix/review → return to closing`.

- Keep period context visible.
- Move exports and internal studies into secondary destinations.
- Preserve snapshots, manager packs, dossier documents and AI/internal review contracts.

## Journey-wide rules

- One screen = one decision.
- One primary CTA = one consequence.
- Back returns to the previous list/workspace context without losing filters or unsaved-change protection.
- Any direct action must show loading, success and failure states without implying persistence before the backend confirms it.
- V3 must measure target clicks with real QA after implementation; these estimates are not acceptance evidence.
