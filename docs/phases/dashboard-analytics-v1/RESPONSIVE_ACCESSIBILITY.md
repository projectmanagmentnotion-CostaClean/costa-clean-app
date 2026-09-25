# Responsive & Accessibility Plan — Dashboard Analytics V1

## Primary rule

Mobile-first is the product contract.

The future implementation must validate at:

- 320px;
- 375px;
- 390px;
- 430px;
- 768px;
- 820px;
- 1024px;
- 1280px;
- 1440px;
- 1920px.

Existing mandatory repository anchors remain especially important:

- 390x844;
- 768x1024;
- 1440x900.

## 320–430px

### Layout

- one primary content column;
- KPI cards: one column or two only when the approved design reference proves legibility;
- period selector remains fully usable without horizontal scroll;
- chart legends wrap or transform into compact accessible rows;
- no chart receives an arbitrary minimum width that causes page overflow;
- top-client/category labels use truncation only with full accessible name.

### Interaction

- 44x44px minimum interactive target unless documented exception;
- no hover-only chart information;
- touch tooltip interaction must not trap scrolling;
- filters use existing sheet/popover conventions where appropriate;
- drill-down targets clearly labeled.

### Tables

Do not solve mobile by placing a wide desktop table inside `overflow-x-auto`.

For recent activity:

- transform to compact rows/cards;
- show only essential columns;
- keep reference/client/amount/status/date readable;
- secondary metadata can collapse.

## 768–1024px

- treat tablet as an independent layout;
- 2-column analytics only when each block remains readable;
- avoid inherited desktop sidebar/chart width assumptions;
- tooltip/popover placement stays inside viewport;
- filters remain reachable with keyboard and touch;
- primary chart generally remains dominant/full-row.

## 1280–1920px

- respect the existing shell/content max width;
- do not stretch bars/lines across empty 1920px space without need;
- four primary KPIs may form one row;
- use 2-column secondary analytics;
- maintain readable line length and chart height.

## Typography and numbers

- use tabular numbers if provided by existing tokens/styles;
- currency abbreviation may use locale-aware compact formatting only when exact value remains available via tooltip/accessible text;
- avoid silently rounding a KPI in a way that changes business meaning;
- percent changes use localized decimal formatting.

## WCAG 2.2 AA target

Future implementation should verify:

- color contrast;
- visible focus;
- logical tab order;
- headings;
- labels for period/filter controls;
- button accessible names;
- selected states;
- touch size;
- reduced motion;
- error/empty/loading announcements where appropriate.

## Charts

A chart is supplemental visual encoding, not the sole representation.

Each chart must have:

- visible title;
- short business-purpose description where helpful;
- accessible text summary;
- legend/series labels;
- exact tooltip values;
- state labels not encoded by color only.

For complex SVG accessibility, the implementation may expose an adjacent semantic summary/table rather than forcing every SVG primitive into the accessibility tree.

## Invoice states

Use text labels in addition to semantic color:

- Pendiente;
- Parcialmente pagada;
- Pagada;
- Cancelada.

## Reduced motion

If `prefers-reduced-motion: reduce`:

- no animated chart path drawing;
- no spring layout transitions;
- values render directly to final state;
- tooltip/focus interaction remains available.

## Keyboard

Required future checks:

- period presets reachable and selectable;
- custom range dialog/sheet has correct focus entry/return;
- KPI drill-down is keyboard operable if rendered interactive;
- legend toggles, if any, are buttons with state;
- no chart captures arrow keys without documented purpose;
- Escape closes overlays and returns focus.

## Loading

- skeleton mirrors final structure;
- no zero values used as temporary loading content;
- no giant spinner;
- partial loaded state may progressively reveal independent blocks.

## Empty

Examples:

- Facturado: “Sin facturas emitidas en este periodo.”
- Cobrado: “Sin cobros registrados en este periodo.”
- Gastos: “Sin gastos registrados en este periodo.”
- Invoice status: “No hay facturas para este periodo.”

Empty state must not be shown before loading is known complete.

## Error

Domain failures should state impact:

- “No se pudo cargar Cobros. Facturación y Gastos siguen disponibles.”

Retry should use the existing refresh path where feasible.

## Visual QA matrix

For each viewport, inspect:

- header and period control;
- KPI wrapping;
- priority strip;
- primary chart;
- axes/ticks;
- tooltip;
- legend;
- secondary charts;
- drill-down controls;
- mobile activity rows;
- dark/light;
- loading;
- empty;
- error;
- large numbers;
- zero values;
- negative values where technically possible;
- browser console;
- horizontal overflow.

A desktop PASS cannot override a mobile FAIL.
