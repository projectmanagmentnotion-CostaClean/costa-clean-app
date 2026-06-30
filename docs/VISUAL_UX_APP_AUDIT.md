# Auditoría Visual UX Global

## 1. Resumen ejecutivo

La app ya tiene una base visual y operativa más coherente de lo que parecía a primera vista. El patrón real dominante no es "dashboard genérico", sino una combinación de hero corto, métricas de contexto, lista o workspace principal y flujos dedicados en overlay para crear o editar. Eso ya existe en producción interna del código y no conviene romperlo.

Las superficies más maduras hoy son `HomePage` y `FiscalClosingPage`. Ambas ya marcan la dirección correcta: priorización de acción, lenguaje prudente, lectura rápida y foco en incidencias reales. El principal cuello de botella visual no es falta de datos, sino inconsistencia entre módulos al presentar prioridad, KPIs y acciones. Varios módulos siguen enseñando recuentos y texto antes de dejar claro qué está bloqueado, qué implica y qué debe hacerse ahora.

Conclusión operativa: el siguiente roadmap visual debería apoyarse en patrones reutilizables sobre la shell actual, no en una reescritura global. Hay base suficiente para estandarizar sin rehacer navegación, modelo de datos ni superficies vivas.

Nota de alcance: esta auditoría es de código y arquitectura visual real. No se ha hecho QA visual en navegador ni validación device-by-device en este sprint.

## 2. Navegación viva y superficies reales

| Vista | Estado | Archivo | Riesgo | Observación |
| --- | --- | --- | --- | --- |
| Home | Viva | `src/pages/HomePage.tsx` | Bajo | Superficie más madura y más cercana al patrón objetivo action-first. |
| Alertas | Viva | `src/pages/AlertsCenterPage.tsx` | Bajo | Buena agrupación por prioridad; puede compactarse algo la densidad vertical. |
| Cierre fiscal | Viva | `src/pages/FiscalClosingPage.tsx` | Medio | Muy sólida funcionalmente; todavía algo larga y con severidad mejorable a nivel visual. |
| Leads | Viva | `src/pages/LeadsPage.tsx` | Medio | Útil pero más list/filter-first que decision-first. |
| Clientes | Viva | `src/pages/ClientsPage.tsx` | Medio | El workspace activo tiene sentido; el estado inicial es correcto pero menos expresivo. |
| Propiedades | Viva | `src/pages/PropertiesPage.tsx` | Medio | Directorio claro + workspace real; copy y jerarquía todavía bastante neutras. |
| Presupuestos | Viva | `src/pages/QuotesPage.tsx` | Medio | Muchas capacidades reales, pero la conversión a trabajo no domina visualmente. |
| Servicios | Viva | `src/pages/JobsPage.tsx` | Medio | Workspace operativo sólido; antes de entrar, la portada sigue siendo algo descriptiva. |
| Facturas | Viva | `src/pages/InvoicesPage.tsx` | Medio | Demasiados modos secundarios alrededor de una lista principal; falta más foco en cobro. |
| Cobros | Viva | `src/pages/PaymentsPage.tsx` | Medio | Página secundaria bien acotada, pero visualmente puede parecer demasiado equivalente a facturas. |
| Gastos | Viva | `src/pages/ExpensesPage.tsx` | Bajo | De las más limpias tras Home y cierre fiscal; buena alineación con revisión documental. |
| Cierre trimestral | No viva como superficie principal | `src/pages/QuarterlyClosingPage.tsx` | Medio | Existe como página, pero la navegación real deriva a `FiscalClosingPage`. |
| Cierre anual | No viva como superficie principal | `src/pages/AnnualClosingPage.tsx` | Medio | Existe como página, pero la navegación real deriva a `FiscalClosingPage`. |
| Solicitud pública de presupuesto | Viva aislada | `src/pages/PublicQuoteRequestPage.tsx`, `src/features/publicIntake/PublicQuoteRequestForm.tsx` | Bajo | Patrón público bien aislado del shell CRM. |
| Quiz público manual | Viva aislada | `src/pages/PublicGymManualQuizPage.tsx` | Bajo | Ruta standalone coherente con la estrategia pública sin shell. |

## 3. Auditoría por módulo

| Módulo | Problema UX principal | KPIs actuales | KPIs recomendados | Acción principal | Visual recomendado | Prioridad |
| --- | --- | --- | --- | --- | --- | --- |
| Home | Aún existe algo de competencia entre contexto, dinero y acciones secundarias, aunque ya está bastante controlado. | 4 KPIs + meta cards + cola operativa + quick actions. | Mantener máximo 4 KPIs arriba y reservar el resto para cola y checklist. | Ejecutar la prioridad del día. | Hero dominante + side insight + grid corto + cola operativa. | Alta |
| Alertas | La página explica bien, pero puede crecer verticalmente rápido. | 5 KPIs de estado. | 3-4 KPIs máximos y más énfasis en buckets con severidad visible. | Abrir y resolver alertas críticas o de acción. | Buckets con tarjetas compactas y badge de severidad consistente. | Alta |
| Cierre fiscal | Mucha información válida en una sola vista; algunas alertas aún se leen como listas, no como bloques de decisión. | Facturado, cobrado, pendiente, gastos, IVA neto estimado, incidencias. | Mantener KPIs financieros básicos y elevar readiness, confidence y missing data como bloque fijo. | Preparar el periodo para revisión, no "cerrarlo" definitivamente. | Readiness block + checklist + warnings con severidad. | Alta |
| Leads | El módulo informa, pero la prioridad comercial no destaca lo suficiente. | Visibles, nuevos, presupuestados, ganados. | Añadir foco a "leads que requieren siguiente paso hoy". | Avanzar el siguiente lead vivo. | Header ejecutivo + lista priorizada + filtro activo compacto. | Media |
| Clientes | La entrada al workspace es correcta, pero el directorio inicial comunica poco valor operativo. | No depende de KPIs fuertes al entrar. | Pocos KPIs o ninguno; mejor acciones y segmentos útiles. | Abrir el cliente que requiere seguimiento. | Directorio compacto + CTA claro al workspace. | Media |
| Propiedades | Correcto estructuralmente, pero todavía descriptivo. | No hay KPIs dominantes. | KPI mínimo o resumen de estado por propiedad activa. | Abrir propiedad y revisar su contexto operativo. | Directorio + workspace con señales rápidas. | Media |
| Presupuestos | Conversión y seguimiento quedan algo repartidos entre lista, detalle y overlays. | Registros, borradores, aceptados. | KPIs más orientados a pendiente de seguimiento y conversión. | Crear, enviar o convertir presupuesto. | Header de embudo corto + lista priorizada. | Alta |
| Servicios | Muy capaz funcionalmente, pero la entrada no siempre enfatiza bloqueo o siguiente acción. | Métricas operativas en la portada. | Destacar "sin facturar", "pendientes de programar" o equivalentes vivos. | Abrir servicio activo y ejecutar siguiente paso. | Workspace-first con resumen operativo corto. | Alta |
| Facturas | Exceso de modos secundarios alrededor del flujo principal. | Total, emitidas, pagadas. | Pendiente de cobro, vencidas, listas para emitir. | Cobrar o emitir. | Cobro-first con list/detail más compacto. | Alta |
| Cobros | Correcto como módulo auxiliar, pero puede competir demasiado con Facturas si se le da igual peso visual. | Recuentos y estados de pago. | Pocos KPIs, más reconciliación y contexto. | Registrar o revisar cobro vinculado. | Vista auxiliar clara y secundaria. | Media |
| Gastos | Bastante bien orientado a soporte y revisión. | Registros, en revisión, riesgo medio/alto. | Mantener casi igual, potenciando checklist documental. | Revisar soporte y riesgo fiscal. | Header corto + lista + bloque de riesgo/revisión. | Media |

## 4. Problemas transversales detectados

### Cards

Existe una base consistente de cards y bloques, pero la app mezcla cards de contexto, cards KPI, cards de acción y cards de warning sin un contrato visual único. El problema no es falta de estilo, sino exceso de variantes informales según página.

### KPIs

Los módulos más sólidos usan pocos KPIs y mejor jerarquía. Los más débiles aún usan KPIs como resumen decorativo. Falta una norma global: KPI solo si cambia una decisión o una prioridad.

### Texto

La calidad del copy ha mejorado, pero todavía hay módulos con exceso de texto explicativo antes de la acción. Donde la app mejor funciona, el texto responde a tres preguntas: qué pasa, qué implica y qué hago.

### Color

La app ya tiene estados y badges útiles, pero la severidad no siempre domina cuando debería. Alertas, readiness y riesgos deberían compartir una escala visual más evidente y estable.

### Scroll

No hay evidencia de scroll infinito descontrolado en las superficies auditadas, pero varios módulos son altos por acumulación de bloques independientes. El riesgo principal es verticalidad por densidad, no por una sola mala sección.

### Acciones

La shell ya distingue entre acción principal y secundaria en varias vistas, pero no siempre con la misma contundencia. Facturas, presupuestos y algunos directorios todavía reparten demasiado el peso entre crear, revisar, abrir detalle y resolver incidencias.

### Datos

La app sí tiene datos suficientes para un UX operativo serio en CRM, facturación, cobro, gastos y cierre fiscal interno. El límite real no es ausencia total de datos, sino que algunas superficies no los convierten todavía en prioridad visual clara.

### Mobile

La estructura del código apunta a una app mobile-aware y basada en bloques apilables. El patrón overlay + lista + workspace es razonable para móvil, pero hay que vigilar la suma de meta cards, grids y secciones en páginas largas.

### Desktop

En desktop, Home y Alertas ya se alejan bastante del dashboard genérico. Otros módulos aún parecen más cercanos a un panel administrativo clásico con hero, contador y lista. El trabajo siguiente debería centrarse en diferenciación por intención, no por estética superficial.

## 5. Patrones visuales existentes reutilizables

- `cc-master-page__hero` y variantes de hero corto por módulo.
- Rejilla de KPIs `cc-kpi-grid` con jerarquía suficiente para páginas ejecutivas.
- Listado principal + panel detalle o workspace en módulos de operación.
- `ActionFlowOverlay` para altas o acciones guiadas sin contaminar la vista base.
- `MajorEditFlowOverlay` para edición amplia sin romper contexto.
- `DuplicateNotice` y `DuplicateReviewOverlay` como patrón claro de excepción operativa.
- `ModuleFilterBar` para filtros activos en contexto.
- Bucketing real de alertas mediante `alertPresentation.ts`.
- Superficies públicas aisladas antes de `AuthPage` y `AppShell`.

## 6. Patrones/componentes nuevos recomendados

| Patrón | Prioridad | Uso | Props aproximadas | Riesgo |
| --- | --- | --- | --- | --- |
| `ExecutiveHeader` | Alta | Unificar hero corto + intención principal + apoyo breve. | `title`, `summary`, `primaryAction`, `secondaryAction`, `statusChip` | Bajo |
| `VisualKpiCard` | Alta | Estandarizar KPIs con semántica clara. | `label`, `value`, `footnote`, `tone`, `priority` | Bajo |
| `ReadinessBlock` | Alta | Llevar el patrón de cierre fiscal a otros módulos con preparación o bloqueo. | `status`, `confidence`, `summary`, `warnings` | Medio |
| `ActionChecklist` | Alta | Mostrar qué falta para poder avanzar o cerrar una tarea. | `items`, `compact`, `cta` | Bajo |
| `SeverityBadge` | Alta | Unificar criticidad de warning, riesgo o revisión. | `level`, `label`, `icon` | Bajo |
| `InsightPanel` | Media | Resumir impacto y siguiente paso sin párrafos largos. | `title`, `insight`, `implication`, `action` | Bajo |
| `CollapsibleDetailSection` | Media | Normalizar detalles expandibles hoy dispersos en `details`. | `title`, `count`, `defaultOpen` | Bajo |
| `MiniTrend` | Baja | Añadir lectura temporal ligera cuando exista dato fiable. | `label`, `values`, `delta`, `period` | Medio |
| `WorkspaceSummaryRail` | Media | Dar un resumen lateral persistente en workspaces densos. | `title`, `items`, `alerts`, `actions` | Medio |

## 7. Roadmap recomendado

1. Consolidar el sistema visual sobre Home, Alertas y Cierre fiscal como superficies patrón.
2. Estandarizar `ExecutiveHeader`, `VisualKpiCard`, `SeverityBadge` y `ActionChecklist` antes de tocar más módulos.
3. Reordenar Facturas, Presupuestos y Servicios para que la prioridad operativa domine sobre el recuento.
4. Ajustar Clientes y Propiedades como directorios de acceso a workspace, no como mini dashboards.
5. Revisar después la densidad vertical de módulos largos, especialmente en móvil.
6. Mantener `FiscalClosingPage` como superficie viva principal y dejar trimestral/anual como deuda estructural separada, no como mezcla inmediata.

## 8. Límites y datos que no deben inventarse

No deberían aparecer como métricas duras ni como promesas visuales:

- Payroll real.
- Horas reales trabajadas.
- Coste laboral completo.
- Margen neto definitivo.
- Deducibilidad fiscal definitiva.
- Caja prevista seria.
- IVA definitivo o cierre fiscal definitivo sin validación profesional.

La base actual sí soporta ayuda operativa, preparación documental, estimaciones internas y detección de incidencias. No soporta convertir eso en verdad contable cerrada.

## 9. Archivos revisados

- `src/app/App.tsx`
- `src/app/AppNav.tsx`
- `src/app/AppShell.tsx`
- `src/app/AppShellPages.ts`
- `src/app/appDataApi.ts`
- `src/app/navigation.ts`
- `src/components/ActionFlowOverlay.tsx`
- `src/components/ModuleFilterBar.tsx`
- `src/features/closing/ClosingAiSummarySection.tsx`
- `src/features/closing/closingDeterministicSummary.ts`
- `src/features/closing/closingSummaryEngine.ts`
- `src/features/closingIntelligence/types.ts`
- `src/features/publicIntake/PublicQuoteRequestForm.tsx`
- `src/pages/AlertsCenterPage.tsx`
- `src/pages/ClientsPage.tsx`
- `src/pages/ExpensesPage.tsx`
- `src/pages/FiscalClosingPage.tsx`
- `src/pages/HomePage.tsx`
- `src/pages/InvoicesPage.tsx`
- `src/pages/JobsPage.tsx`
- `src/pages/LeadsPage.tsx`
- `src/pages/PaymentsPage.tsx`
- `src/pages/PropertiesPage.tsx`
- `src/pages/QuarterlyClosingPage.tsx`
- `src/pages/AnnualClosingPage.tsx`
- `src/pages/QuotesPage.tsx`
- `src/features/shell/shell-dashboard-polish.css`
- `api/closing-intelligence.js`

## 10. Recomendación final

La app ya tiene una dirección visual válida y reutilizable. No necesita un rediseño total. Necesita convertir su mejor criterio actual en sistema: menos KPIs decorativos, más jerarquía de acción, severidad consistente y menos dispersión entre texto, alertas y overlays.

La decisión más sensata para el siguiente bloque es evolucionar desde lo que ya está vivo: `HomePage` como patrón de consola priorizada, `AlertsCenterPage` como patrón de cola accionable y `FiscalClosingPage` como patrón de readiness con lenguaje prudente. Desde ahí, el resto de módulos puede alinearse con menor riesgo y sin inventar capacidades que el dato real aún no sostiene.
