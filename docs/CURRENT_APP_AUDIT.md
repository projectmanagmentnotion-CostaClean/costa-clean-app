# Current App Audit

## Resumen ejecutivo

La app ya tiene una base moderna mas avanzada de lo que sugiere un CRM clasico. El patron dominante real no es pagina plana + modal suelta, sino shell interna con vistas por modulo, overlays guiados, workspaces dedicados y varios flentes fullscreen para creacion/edicion.

Los hallazgos mas relevantes del repo real son estos:

- La navegacion interna no usa rutas SPA por path para cada modulo. Usa `?view=` desde `src/app/useShellNavigation.ts`.
- Las rutas publicas ya existen y quedan aisladas antes de auth y antes del shell en `src/App.tsx`.
- Ya existe una base StepFlow reutilizable en `src/components/FullscreenStepFlow.tsx`, pero cada flujo grande sigue cargando mucha logica propia.
- La deuda principal no es ausencia de componentes UX. La deuda principal es inconsistencia entre modulos, densidad vertical y repeticion de patrones grandes por archivo.
- `src/app/AppShell.tsx` es hoy el gran orquestador. Tiene mucho valor como mapa real de comportamiento, pero tambien es una concentracion de complejidad.
- Hay deuda estructural visible entre modelo declarado y superficies vivas: existen modulos como `kpis` y `settings` en tipos/config, pero no forman parte de la navegacion viva actual.
- Existen paginas legacy pesadas (`AnnualClosingPage.tsx`, `QuarterlyClosingPage.tsx`) mientras la superficie viva usa `FiscalClosingPage.tsx`.
- El repo ya convive con drift de esquema real y fallbacks defensivos en `src/app/appDataApi.ts`, especialmente en propiedades, facturas y `job_lines`.
- Facturas y numeracion requieren tratarse como area separada de alto riesgo. El repo ya documenta endurecimiento SQL y protecciones en cliente, pero el riesgo sigue siendo especial.

Concluson: Sprint 2 no deberia empezar rehaciendo pantallas al azar. Deberia consolidar el design system sobre patrones ya vivos, y Sprint 3 deberia estandarizar StepFlow sobre la base existente en lugar de crear otro sistema paralelo.

## Estructura del repo

### Superficies principales detectadas

- `src/`
  - `App.tsx`: bootstrap, auth gate, rutas publicas standalone y shell principal
  - `app/`: shell, navegacion, carga agregada de datos, modelos y health checks
  - `pages/`: superficies de modulo y paginas standalone
  - `components/`: primitives y patrones UI reutilizables
  - `features/`: dominios funcionales por modulo
  - `lib/`: cliente Supabase y REST helpers
  - `shared/`: toasts, lifecycle y piezas transversales
- `api/`
  - endpoints server-side para intake publico, IA de cierre, inteligencia fiscal y drafts
- `sql/`
  - migraciones y endurecimientos de writes, numeracion, lifecycle y permisos
- `docs/`
  - QA historico, auditorias funcionales, control fiscal y base UX existente
- `public/`
  - branding y assets publicos

### Carpetas o señales de deuda de estructura

- `src/pages/` contiene varios `.bak-*` versionados. No afectan la app viva, pero si aumentan ruido en auditoria y riesgo de confusion humana.
- `src/pages/AnnualClosingPage.tsx` y `src/pages/QuarterlyClosingPage.tsx` siguen presentes con gran tamano, aunque la shell viva usa `FiscalClosingPage.tsx`.
- `src/app/modules.ts`, `src/types/app.ts` y `src/types/domain.ts` todavia declaran `kpis` y `settings`, pero no existe una vista viva equivalente en la navegacion actual del shell.

## Rutas detectadas

### Rutas publicas standalone

Detectadas en `src/App.tsx` y `src/app/publicStandaloneRoutes.ts`:

| Tipo | Ruta | Estado | Observacion |
| --- | --- | --- | --- |
| Publica | `/quote-request` | Viva | Intake publico aislado |
| Publica | `/presupuesto` | Viva | Alias del intake publico |
| Publica | `/manual-quiz` | Viva | Quiz publico aislado |
| Publica | `/prueba-operativa-gimnasio` | Viva | Alias del quiz |
| Publica | `/prueba-manual-gimnasio` | Viva | Alias del quiz |
| Dev | `/dev/step-flow-preview` | Solo `import.meta.env.DEV` | Preview interno del patron de flujo |

### Navegacion interna del shell

Detectada en `src/app/navigation.ts` y `src/app/useShellNavigation.ts`.

La app interna navega por query param `?view=` en lugar de usar rutas dedicadas por modulo.

| `?view=` | Superficie viva |
| --- | --- |
| `dashboard` | `HomePage` |
| `alerts` | `AlertsCenterPage` |
| `fiscal_closing` | `FiscalClosingPage` |
| `quarterly_closing` | `FiscalClosingPage` |
| `annual_closing` | `FiscalClosingPage` |
| `leads` | `LeadsPage` |
| `clients` | `ClientsPage` |
| `properties` | `PropertiesPage` |
| `quotes` | `QuotesPage` |
| `jobs` | `JobsPage` |
| `invoices` | `InvoicesPage` |
| `expenses` | `ExpensesPage` |
| `payments` | `PaymentsPage` |

### Observaciones de routing

- `annual_closing` y `quarterly_closing` existen en navegacion, pero la shell redirige ambos a `FiscalClosingPage`.
- `AnnualClosingPage.tsx` y `QuarterlyClosingPage.tsx` siguen en repo, pero no forman parte del render vivo del shell actual.
- No hay modulo vivo para `settings`.
- No hay modulo vivo para `kpis`.

## Modulos detectados

### Modulos vivos del shell

- Home / Dashboard
- Alertas
- Cierre fiscal
- Leads
- Clientes
- Propiedades
- Presupuestos
- Servicios
- Facturas
- Gastos
- Cobros

### Modulos funcionales detectados en `src/features/`

- `auth`
- `dashboard`
- `automation`
- `leads`
- `leadDrafts`
- `clients`
- `properties`
- `quotes`
- `jobs`
- `invoices`
- `payments`
- `expenses`
- `recurringInvoices`
- `publicIntake`
- `publicQuiz`
- `closing`
- `closingExports`
- `closingIntelligence`
- `annualClosing`
- `quarterlyClosing`
- `duplicates`
- `documents`
- `financial`
- `auditTrail`

### Modulos declarados pero no equivalentes a superficie viva

- `kpis`
- `settings`

Esto no implica bug funcional inmediato, pero si deuda de coherencia entre mapa conceptual y mapa vivo.

## Componentes UI existentes

### Primitives y patrones reutilizables reales

Detectados en `src/components/` y usados de forma repetida:

- `ExecutiveHeader`
- `VisualKpiCard`
- `ActionChecklist`
- `ProgressMetric`
- `SeverityBadge`
- `InsightPanel`
- `CollapsibleDetailSection`
- `FullscreenStepFlow`
- `ActionFlowOverlay`
- `MajorEditFlowOverlay`
- `WorkspaceScaffold`
- `ModuleFilterBar`
- `SearchBar`
- `ListToolbar`
- `OperationalListItem`
- `BulkSelectionToolbar`
- `ConfirmDialog`
- `FeedbackDialog`
- `DeferredContentFallback`
- `WorkspaceRelationBrowser`

### Patrones funcionales transversales

- `DuplicateNotice`
- `DuplicateReviewOverlay`
- `ToastProvider` + `useToast`
- `AppNav` con bottom dock movil y hoja "Mas"
- workspaces dedicados por entidad
- document screens para factura y presupuesto

### Lectura operativa

El repo no necesita inventar de cero un design system. Ya tiene una base util. Sprint 2 deberia consolidar tokens, contratos visuales y jerarquia, no reemplazar componentes buenos por otros equivalentes.

## Flujos principales actuales

### Flujos internos principales

- Auth de acceso
- Dashboard operativo con quick actions y cola priorizada
- Leads: alta, filtros, detalle y conversion
- Clientes: directorio -> workspace -> acciones relacionadas
- Propiedades: directorio -> workspace -> acciones relacionadas
- Presupuestos: lista + detalle + create flow + edit flow + document screen
- Servicios: lista/workspace + create flow + acciones de cobro/factura
- Facturas: lista + detalle + create flow + edit flow + document screen + bulk actions + control fiscal + control de numeracion
- Cobros: lista + detalle + create flow
- Gastos: lista + detalle + create flow + edit flow + soporte/revision fiscal
- Cierre fiscal: resumen, revision documental, exportacion, snapshot y resumen IA
- Recurrentes: flujo de plan recurrente desde clientes/invoices

### Flujos publicos

- Intake publico de presupuesto
- Quiz publico manual

## Formularios largos o complejos detectados

Basado en tamano real de archivos y rol funcional:

| Flujo/Form | Archivo | Tamano aprox | Lectura |
| --- | --- | ---: | --- |
| Factura create flow | `src/features/invoices/InvoiceCreateFlow.tsx` | 57 KB | Muy complejo |
| Factura create form | `src/features/invoices/InvoiceCreateForm.tsx` | 41 KB | Muy complejo |
| Servicio create flow | `src/features/jobs/JobCreateFlow.tsx` | 40 KB | Muy complejo |
| Factura edit flow | `src/features/invoices/InvoiceEditFlow.tsx` | 33 KB | Muy complejo |
| Presupuesto create flow | `src/features/quotes/QuoteCreateFlow.tsx` | 33 KB | Muy complejo |
| Servicio create form | `src/features/jobs/JobCreateForm.tsx` | 31 KB | Muy complejo |
| Recurrente plan flow | `src/features/recurringInvoices/RecurringInvoicePlanFlow.tsx` | 30 KB | Complejo |
| Cobro create flow | `src/features/payments/PaymentCreateFlow.tsx` | 28 KB | Complejo |
| Presupuesto edit flow | `src/features/quotes/QuoteEditFlow.tsx` | 26 KB | Complejo |
| Gasto create flow | `src/features/expenses/ExpenseCreateFlow.tsx` | 24 KB | Complejo |
| Intake publico | `src/features/publicIntake/PublicQuoteRequestForm.tsx` | 23 KB | Complejo pero ya secuenciado |

### Lectura UX

- Los flujos mas sensibles ya fueron sacados de la vista base y llevados a superficies dedicadas.
- El problema no es que sigan inline. El problema es que cada flujo sigue cargando demasiada logica especifica, lo que dificulta consistencia y mantenimiento.

## Candidatos claros a StepFlow

### Ya usan base StepFlow

- `InvoiceCreateFlow`
- `InvoiceEditFlow`
- `JobCreateFlow`
- `QuoteCreateFlow`
- `QuoteEditFlow`
- `ExpenseCreateFlow`
- `ExpenseEditFlow`
- `PaymentCreateFlow`
- `PropertyCreateFlow`
- `RecurringInvoicePlanFlow`

### Necesitan StepFlow estandarizado o refuerzo

- Intake publico: hoy usa stepper propio, no `FullscreenStepFlow`
- Client onboarding: alta + datos fiscales + relaciones sigue repartido entre create form, inline form y workspace
- Lead -> client -> quote/invoice handoff
- Fiscal closing actions sensibles: revision documental, exportacion y snapshot ya estan separados, pero no siguen un contrato unico de flujo

## Observaciones mobile-first

### Lo que ya va en direccion correcta

- `AppNav` tiene header movil, bottom dock y hoja secundaria "Mas".
- Los flujos importantes salen a overlays o fullscreen.
- La shell evita meter navbar CRM en las rutas publicas.
- `FullscreenStepFlow` ya contempla progreso movil, contexto colapsable y barra de avance.

### Lo que sigue debil

- Varias paginas apilan header largo + 4 KPIs + checklist + notice + lista + detalle. En movil eso eleva mucho el primer scroll.
- `HomePage`, `FiscalClosingPage` e `InvoicesPage` son particularmente densas.
- Algunos modulos siguen mezclando demasiadas acciones de igual peso en la misma pantalla.
- La experiencia movil varia demasiado por modulo aunque existan componentes comunes.

## Observaciones de arquitectura

- `src/App.tsx` separa bien rutas publicas, auth y shell.
- `src/app/AppShell.tsx` concentra navegacion, filtros, cross-module actions, prefills y wiring de todas las superficies. Es un archivo de alto acoplamiento.
- `src/app/appDataApi.ts` es el hub real de lectura agregada y contiene logica de fallback por drift de esquema.
- `src/features/financial/financialWriteApi.ts` es capa sensible de escritura para facturas, cobros, conversiones y estados.
- Las entidades de negocio estan razonablemente modeladas en `entitySchemas.ts` y `relationships.ts`.
- La app ya depende de SQL/RPC para varias garantias criticas. Cambios visuales futuros no deben saltarse esa frontera.

## Riesgos generales

- Drift entre superficie viva y archivos legacy.
- Drift entre modelo declarado y modulos vivos.
- Dependencia fuerte de RPC/SQL para writes sensibles.
- Fallbacks de lectura que ayudan a resiliencia, pero tambien indican deuda de esquema desplegado.
- Numeracion de facturas con historial reciente de endurecimiento y regularizaciones.
- `AppShell.tsx` como punto de complejidad alta y posible cuello de botella de mantenimiento.
- Workspaces y detail cards con muchas responsabilidades en archivos grandes.

## Recomendacion de orden para proximos sprints

### Sprint 2

- Consolidar design system sobre componentes ya vivos: `ExecutiveHeader`, `VisualKpiCard`, `ActionChecklist`, `SeverityBadge`, `ProgressMetric`, `ActionFlowOverlay`, `FullscreenStepFlow`, `WorkspaceScaffold`.
- Definir tokens, jerarquia y contratos visuales sin tocar logica critica.
- Empezar por Home, Alertas y los headers/list shells de modulos, no por facturas.

### Sprint 3

- Estandarizar el motor StepFlow reutilizable.
- Prioridad tecnica: absorber patrones repetidos hoy repartidos en flujos de factura, presupuesto, servicio, cobro y gasto.
- Tratar intake publico como candidato a unificar con ese motor, no como flujo aislado permanente.

### Sprint 4

- Limpiar coherencia de AppShell y navegacion.
- Resolver deuda entre vistas declaradas y vivas.
- Aclarar si `annual_closing` y `quarterly_closing` seguiran como aliases o deben retirarse como superficies legacy.

### Sprint 5 en adelante

- Dashboard
- Intake publico
- Presupuestos
- Facturas
- Clientes
- Servicios
- Finanzas
- Estados globales
- QA mobile/accesibilidad

### Recomendacion de no hacer

- No empezar Sprint 2 por facturas o Supabase.
- No mezclar design system con refactor de writes.
- No tratar numeracion de facturas como deuda visual. Es deuda de integridad operativa y debe ir en sprint separado.
