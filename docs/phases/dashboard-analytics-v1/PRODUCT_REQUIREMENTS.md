# Product Requirements — Dashboard Analytics & Business Insights V1

## Product objective

Give Costa Clean a fast, trustworthy business reading inside the existing Home/Dashboard so the owner can answer:

- How much has been invoiced in the selected period?
- How much cash has actually been collected?
- How much remains outstanding?
- How much expense has been recorded?
- How are those values evolving?
- Which invoice states require attention?
- Where are expenses concentrated?
- Which clients contribute the most invoiced value?
- How many services and new clients were created/completed, when definitions are verified?

The product must remain operationally useful, not become a passive reporting wall.

## Product principles

1. Data truth before visual richness.
2. Facturado and cobrado never share ambiguous “income” wording.
3. No metric appears without a documented definition and source.
4. No chart exists only because the library supports it.
5. Home remains a cockpit: analytics summarizes and hands off detail.
6. One shared period model drives all compatible cards/charts.
7. Exceptions are explicit when a metric has different temporal semantics.
8. Empty/partial/error states are first-class.
9. Mobile is the primary composition contract.
10. Current business/security boundaries remain unchanged.

## Primary KPI recommendation

### 1. Facturado

Question: “¿Qué importe legal total tienen las facturas emitidas en este periodo según la semántica actual?”

Source date: invoice `issue_date`.

Caveat: current period engines include period invoices without explicitly excluding cancelled records. This must be resolved before final KPI certification.

### 2. Cobrado

Question: “¿Cuánto dinero se ha registrado como cobrado durante este periodo?”

Source date: payment `payment_date`.

### 3. Pendiente de cobro

Preferred period interpretation: “¿Qué saldo sigue abierto hoy en facturas emitidas dentro del periodo seleccionado?”

A separate all-time current balance may be shown only with explicit labeling.

### 4. Gastos

Question: “¿Qué total de gastos registrados pertenece al periodo según las reglas existentes?”

Source date/fiscal assignment: current closing semantics.

## KPI deliberately not primary yet

### Resultado / beneficio

Status: UNVERIFIED.

It cannot be shown until the product chooses and documents a canonical definition. Candidate formulas have materially different meanings:

- facturado - gastos;
- cobrado - gastos;
- base net of VAT - deductible costs;
- operational contribution after payroll;
- accounting profit.

The repository currently cannot justify choosing one.

## Secondary metrics

Candidate secondary metrics:

- invoice count by financial status;
- completed services in period;
- new clients in period, after product confirmation;
- current active client count;
- expense category concentration;
- top clients by invoiced amount, after invoice inclusion semantics are accepted.

## Main visualization

Recommended analytical question:

“How did invoicing, collections and expenses move through the selected range?”

Recommended visualization:

- temporal multi-series chart;
- explicit labels “Facturado”, “Cobrado”, “Gastos”;
- no generic “Ingresos” label;
- granularity chosen from the period (day/week/month);
- comparison to previous equivalent period where meaningful.

Do not plot a profit/result series until its definition is verified.

## Invoice financial-state view

Use existing financial states:

- Pendiente;
- Parcialmente pagada;
- Pagada;
- Cancelada.

Do not invent “Vencida”.

The visualization should support both count and monetary value only when the UI remains legible. If one representation is primary, amount has higher business value for the financial cockpit and count can be secondary text.

## Expense-category view

Use actual `ExpenseCategory` values and existing label helper.

Chart choice rule:

- few dominant categories: donut can work;
- many non-zero categories: horizontal bars are preferred;
- aggregate minor categories into “Otros” only if the transformation is documented and does not overwrite the underlying category identity.

## Top clients

Candidate question:

“¿Qué clientes concentran más facturación durante el periodo?”

Requires:

- accepted invoice inclusion semantics;
- join invoice `client_id` to client label;
- deterministic sorting;
- tie handling;
- safe fallback label;
- no raw UUID rendering.

## Client evolution

Not a V1 commitment until semantics are approved.

The repository can identify client records created in a period. It cannot reconstruct historical “active client” state without an event/status history. A chart labeled “clientes activos por mes” would therefore be misleading if based only on current status.

Safe initial alternative:

- “Clientes nuevos” by `created_at`, after product confirmation;
- current active-client total as a snapshot, not historical time series.

## Period filters

Required analytical presets:

- 30 days;
- 3 months;
- 6 months;
- 12 months;
- current year;
- custom range.

Optional after UX review:

- previous month;
- previous year.

Period model requirements:

- normalized inclusive start/end dates;
- Europe/Madrid business timezone;
- previous-period comparison of equal length or calendar-equivalent period;
- explicit granularity;
- no divide-by-zero percentage;
- zero/empty/null distinction;
- custom range validation.

## Comparisons

For KPI comparison:

- show absolute current value;
- percentage only if previous-period denominator is meaningful;
- if previous period = 0 and current > 0, display “sin base comparable” instead of an infinite percentage;
- show direction only where higher/lower has clear semantics;
- never color a decrease green/red automatically for every metric. For expenses, direction is not inherently good/bad without context.

## Drill-down

Recommended navigation:

- Facturado → invoices filtered to period if existing filter contract supports it; otherwise invoices module with documented handoff.
- Cobrado → payments.
- Pendiente → invoices pending.
- Gastos → expenses.
- Invoice financial-state segment → invoices with matching financial state.
- Client ranking row → client workspace.
- Service metric → jobs/services.

No duplicate detail pages.

## Information density

First mobile viewport priority:

1. title + period control;
2. primary KPI reading;
3. compact operational priority/alert state if present;
4. main temporal chart.

Secondary sections follow below.

Desktop may place compatible secondary charts side by side, but the page should retain bounded content width and avoid stretching charts purely to fill space.

## States

Every analytical block must define:

- loading;
- empty;
- error;
- partial data;
- zero;
- large values;
- unavailable/unverified.

Loading uses skeletons shaped like the real content, not giant spinners.

Partial-domain failure must not blank the entire dashboard if unaffected metrics can still be trusted.

## Security/privacy

- use authenticated user read paths only;
- preserve current RLS;
- never use service role in the browser;
- never log tokens or private document URLs;
- raw IDs are internal only;
- analytics drill-down cannot broaden visibility beyond existing module permissions.

## Non-goals for V1

- accounting/legal profit statement;
- forecasting;
- AI financial advice;
- trading-style charts;
- candlesticks;
- live websocket market-like animation;
- new tenancy or role model;
- payroll/hours analytics;
- schema redesign;
- fiscal automation beyond existing closing contracts;
- separate BI product or repository.
