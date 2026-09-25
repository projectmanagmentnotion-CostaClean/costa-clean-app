# Dashboard Information Architecture — Analytics V1

## Product constraint

The canonical frontend blueprint defines Home as a daily cockpit, not a long report. Analytics V1 must improve business visibility without replacing fast operational decision-making with a passive BI page.

Recommended direction: **Business cockpit with analytics**, not “admin dashboard”.

## Proposed hierarchy

### Layer 1 — Header and period context

Contents:

- page title;
- selected period;
- compact comparison state;
- custom-range entry when enabled.

No large decorative header. The user should understand the temporal context before reading any number.

### Layer 2 — Primary financial KPIs

Initial four, pending the two cancellation semantics documented in the metric catalog:

1. Facturado.
2. Cobrado.
3. Pendiente de cobro.
4. Gastos.

Each KPI shows:

- label;
- value;
- previous-period comparison when valid;
- concise comparison label;
- accessible text equivalent;
- optional microtrend only if it adds information and does not require another query.

Do not show Resultado/Beneficio until M12 is verified.

### Layer 3 — Operational priority strip

Preserve the current Home priority concept, but keep it compact:

- critical/warning items only;
- maximum small bounded set;
- no duplicated alert feed;
- clear handoff action.

This prevents the analytics evolution from destroying the existing “what needs attention now?” contract.

### Layer 4 — Primary trend

One dominant chart answering:

**How did Facturado, Cobrado and Gastos evolve through this period?**

It must be visually dominant but not full-screen.

Result/profit is not a series.

### Layer 5 — Financial composition

Two complementary blocks when space permits:

- invoice financial state;
- expenses by category.

These answer different questions and can share a row on wider viewports.

### Layer 6 — Business concentration / operations

Candidate blocks:

- top clients by invoiced amount — gated by M01/M11 approval;
- completed services by period — safe when useful;
- new clients — gated by M10 approval.

Do not show all simultaneously by default. The product should choose the two highest-signal blocks after real-data review.

### Layer 7 — Recent/operational handoff

Optional compact recent financial activity may show:

- reference;
- client/relationship label;
- amount;
- date;
- state;
- link to existing detail.

This must reuse existing domain navigation and must not become a duplicate Invoices/Payments page.

## Mobile order

At 320–430px:

1. Header + period control.
2. KPI group.
3. Critical operational priority state.
4. Primary trend.
5. Invoice state.
6. Expense categories.
7. One business concentration block.
8. Optional recent activity/handoff.

No horizontal page overflow.

## Tablet order

At 768/820/1024:

- KPI grid may use 2 columns;
- primary chart remains full-width or dominant;
- secondary analytics may use two columns if labels remain legible;
- priority layer remains compact.

Tablet is not desktop compressed.

## Desktop order

At 1280/1440/1920:

- bounded content width following existing shell;
- four KPI cards can share a row when the design reference supports it;
- primary chart dominant;
- secondary analytics in balanced 2-column groups;
- avoid stretching low-density charts to 1920px.

## Navigation/drill-down rules

All analytics should hand off to existing modules:

- Facturado → Facturas.
- Cobrado → Cobros.
- Pendiente → Facturas with pending financial state where supported.
- Gastos → Gastos.
- Invoice state → Facturas.
- Expense category → Gastos; category prefilter only if the existing filter contract supports it.
- Client → Client Workspace.
- Service metric → Servicios.

If an exact filter cannot be passed safely with current navigation, open the correct module rather than inventing a route/query contract.

## Density limits

- Four primary financial KPIs are the default maximum first-row set.
- One dominant chart.
- Maximum two secondary chart blocks per desktop row.
- No more than one compact operational priority surface before the main chart.
- Do not repeat the same total in KPI, chart headline and separate summary card.
- Hide/omit empty low-value sections instead of filling them with zeros if that would add noise.

## Comparison behavior

Comparison is part of each relevant metric, not a separate “comparison dashboard”.

Allowed:

- current vs previous equivalent period;
- current year vs previous year only when selected and data exists.

Avoid:

- mixed comparison bases on the same screen;
- hidden comparison dates;
- green/red interpretation based solely on sign.

## Future “Resultado” placement

If a canonical result metric is later approved, it may either:

- replace one of the four primary KPIs, or
- become a clearly labeled secondary financial KPI.

It must not simply be appended as a fifth equally weighted card without re-evaluating hierarchy.
