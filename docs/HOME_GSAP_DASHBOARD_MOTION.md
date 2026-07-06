# Home GSAP Dashboard Motion

## Estado anterior

Antes de esta fase, `Home` ya era una pantalla mas limpia y decision-first tras Sprint 5, pero seguia apoyandose sobre:

- una prioridad principal
- una banda de dinero pendiente
- quick actions compactas
- cola operativa corta
- revision fiscal y alertas

La lectura era mejor que en el estado original, pero faltaba una capa visual mas operativa para:

- detectar rapido frentes fiscales
- leer carga inmediata
- ver soporte documental sin abrir otra pantalla

## Datos usados

Solo se usan datos ya presentes en `src/pages/HomePage.tsx` y ya calculados por `src/app/dashboardMetrics.ts`:

- `jobsScheduledTodayCount`
- `jobsScheduledTomorrowCount`
- `agenda.upcomingJobs.length`
- `outstandingReceivablesTotal`
- `pendingInvoicesCount`
- `completedJobsWithoutInvoiceCount`
- `completedJobsWithoutInvoiceOlderThan2DaysCount`
- `expensesThisMonthTotal`
- `expensesWithReceiptCount`
- `expensesCount`
- `expensesWithoutReceiptCount`
- `fiscalReviewExpensesCount`
- `expensesMissingValidVatInvoiceCount`
- `fiscalRiskExpensesCount`

No se inventan datos ni se crean agregados de negocio nuevos.

## Acciones rapidas finales

- `Nueva factura`
- `Ver pendientes de cobro`
- `Nuevo presupuesto`
- `Nuevo servicio`
- `Nuevo gasto`
- `Revisar cierre fiscal`

La lista sigue filtrando duplicados contra la prioridad principal del hero.

## KPIs finales

- `Pendiente de cobro`
- `Trabajo sin facturar`
- `Gasto del mes`
- `Revision fiscal abierta`

Todos reutilizan callbacks ya existentes del Home.

## Graficos creados

- `SvgLineChart`
  - serie corta real: `Hoy`, `Manana`, `Proximos`
- `SvgBarChart`
  - conteos fiscales reales: `Revision`, `Sin IVA`, `Riesgo`
- `SvgRadialProgress`
  - completitud documental real: gastos con soporte / gastos del periodo

## Componentes y hooks motion usados

Componentes:

- `HomeQuickActionsPanel`
- `HomeFiscalKpiGrid`
- `HomeGsapChartCard`
- `SvgLineChart`
- `SvgBarChart`
- `SvgRadialProgress`
- `HomeMotionSection`

Hooks y helpers:

- `useGsapEntrance`
- `useGSAP`
- `useReducedMotion`
- `createScrollTriggerOnce()`
- `killScopedScrollTriggers()`
- `drawSvgPath()`

## ScrollTrigger usage

- uso solo en `HomeMotionSection`
- `once: true`
- reveal corto
- `start: top 88%`
- sin `pin`
- sin `scrub`
- sin scroll hijacking

No se aplica `ScrollTrigger` global ni sobre listas largas.

## SVG draw fallback

- `SvgLineChart` y `SvgRadialProgress` usan `drawSvgPath()`
- si `DrawSVGPlugin` no esta disponible, la capa compartida cae al fallback de `stroke-dasharray` / `stroke-dashoffset`
- no se instala plugin premium ni wrapper externo

## Reduced motion

- `useGsapEntrance` resuelve el estado final sin transicion innecesaria
- `HomeMotionSection` no crea `ScrollTrigger` si hay `prefers-reduced-motion`
- charts SVG renderizan el estado final sin depender de animacion

## Performance safeguards

- solo SVG nativo, sin librerias de charts
- sin canvas
- sin scroll hijacking
- sin pinning agresivo
- sin scrub pesado
- sin timelines largas
- sin animar importes ni warnings fiscales
- sin recalcular datos dentro de la animacion
- sin animar listas largas del Home

## Que no se toco

- Supabase
- SQL
- RPC
- migrations
- auth
- rutas
- `?view=`
- `appDataApi`
- `financialWriteApi`
- numeracion
- fiscalidad
- calculos de negocio
- persistencia
- contratos de datos

## Riesgos pendientes

- `HomePage.tsx` sigue siendo una superficie de composicion importante aunque ahora delega mas bloques.
- El dashboard sigue condicionado por agregados cross-module existentes.
- La serie de linea del Home es operativa y corta; no sustituye una analitica temporal mas profunda.
- La adopcion GSAP aun no se extiende a primitives compartidas ni overlays fuera de Home.

## Recomendaciones futuras

1. Llevar motion compartida a overlays y StepFlow antes de listas densas.
2. Mantener charts solo cuando haya dato real y accion clara asociada.
3. No extender `ScrollTrigger` a dominios criticos sin sprint separado.
4. Revisar posteriormente si `HomePage.tsx` necesita extraer mas builders de datos sin mezclarlo con write paths.
