# Acceptance Criteria — Dashboard Analytics V1

These criteria define the future implementation gate. They are not claims that implementation exists today.

## A. Metric truth

### AC-M01

For every shipped KPI, the implementation links to one metric-catalog definition and one source path.

### AC-M02

Facturado and Cobrado are separate labels, formulas and date sources.

### AC-M03

No `Resultado`, `Beneficio` or `Margen` value is shown unless M12/M15 move from UNVERIFIED to an approved canonical definition.

### AC-M04

No “Vencida” invoice state is shown unless a canonical due-date rule exists.

### AC-M05

Outstanding balance matches the existing payment aggregation/tolerance semantics for a controlled fixture set.

### AC-M06

No percentage comparison renders infinity/NaN. Previous value zero produces an explicit non-comparable state.

### AC-M07

Cancellation treatment for invoice and expense aggregates is documented, tested and matches H0 approval.

## B. Data architecture

### AC-D01

No chart/card component performs a direct Supabase query.

### AC-D02

Analytics calculations are centralized and reused by KPI/chart/ranking outputs.

### AC-D03

Initial implementation requires zero schema/RLS/RPC mutation unless a separately authorized DB gate supersedes this criterion.

### AC-D04

Partial domain failure does not hide unrelated, trustworthy analytics.

### AC-D05

No service-role secret or privileged key is added to client code.

## C. Product hierarchy

### AC-P01

Home still exposes the approved operational priority behavior and does not become an unbounded report.

### AC-P02

The first mobile reading contains period context and primary financial KPIs without decorative analytics before them.

### AC-P03

There is exactly one dominant temporal chart.

### AC-P04

Secondary analytics are limited to business questions approved in the information architecture.

### AC-P05

Details hand off to existing modules rather than duplicating complete invoice/payment/expense/client pages.

## D. Period controls

### AC-T01

Available presets include 30d, 3m, 6m, 12m, current year and custom.

### AC-T02

Every period-dependent block receives the same normalized range.

### AC-T03

A block using snapshot semantics instead of range semantics labels that difference clearly.

### AC-T04

Custom range rejects invalid end-before-start state and exposes clear error recovery.

### AC-T05

Calendar/date-only calculations do not shift a record into the wrong day due to UTC conversion.

## E. Responsive

For each width 320, 375, 390, 430, 768, 820, 1024, 1280, 1440, 1920:

### AC-R01

No involuntary page-level horizontal overflow.

### AC-R02

KPI values do not clip or overlap.

### AC-R03

Chart axes/labels/legend remain readable or transform to the documented mobile alternative.

### AC-R04

Tooltips/popovers stay usable inside viewport.

### AC-R05

Primary interactive controls meet 44px target rule unless a documented exception exists.

### AC-R06

Recent activity does not rely on a desktop-width table with generic horizontal scrolling.

## F. Accessibility

### AC-A01

Keyboard navigation reaches period controls, KPI drill-downs and chart controls in visual order.

### AC-A02

Focus is visibly rendered and returns to trigger after modal/sheet close.

### AC-A03

Charts have text equivalents sufficient to understand the main values without color/visual position alone.

### AC-A04

Status is communicated with text/shape in addition to color.

### AC-A05

`prefers-reduced-motion` disables non-essential animation.

### AC-A06

Dark and light modes meet applicable contrast requirements.

## G. State completeness

Each section has tested:

- loading;
- empty;
- error;
- partial;
- zero;
- large-value.

No zero is rendered as a fake loading placeholder.

## H. Performance

### AC-PERF01

No N+1 query is introduced by charts.

### AC-PERF02

A bundle delta is recorded before/after adding the chart runtime.

### AC-PERF03

Analytics model does not independently re-filter/re-bucket full data per card.

### AC-PERF04

No resize/render loop causes continuous chart rerenders.

### AC-PERF05

If current full-array loading fails measured targets, optimization follows the staged performance plan rather than an automatic schema rewrite.

## I. Testing and quality

Future implementation closes only when:

- focused analytics unit tests PASS;
- integration tests PASS;
- relevant finance regression PASS;
- E2E PASS;
- lint PASS;
- TypeScript/build PASS;
- visual QA PASS;
- accessibility checks PASS;
- relevant browser console errors = 0;
- no hidden test disabling or `@ts-ignore` shortcut is introduced.

## J. Security

- current RLS preserved;
- authenticated read scope preserved;
- no raw UUID displayed;
- no secrets in code/logs/screenshots/commits;
- production analytics smoke is read-only.

## K. Visual authority

Final styling cannot be marked visually complete until the approved repository design authority exists for the Home analytics composition or a human-approved alternative is documented.

“Looks professional” alone cannot satisfy this gate.
