# STITCH-FE-01 — Auditoria real integral del frontend

**Repo:** `projectmanagmentnotion-CostaClean/costa-clean-app`  
**Branch auditada:** `agent/stitch-fe-01-real-frontend-audit`  
**Base auditada:** `origin/main` en `af573f80915e9b34c981a959e9a4bcd51a0b93c4`  
**Modo:** `AUDIT_ONLY`  
**Fecha:** 2026-08-02

## 1. Resumen ejecutivo

La base real del frontend ya no es la de un CRM plano con modales sueltos. El repo vive sobre un shell interno por `?view=`, workspaces por entidad, overlays dedicados, StepFlow para altas complejas y un sistema de componentes compartidos mucho mas maduro de lo que sugieren los artefactos Stitch por si solos.

La conclusion principal de la auditoria es doble:

1. El frontend real cumple la direccion funcional del blueprint en la mayoria de las superficies principales.
2. La deuda relevante no es falta de capacidad, sino consistencia visual, densidad, drift entre vistas vivas y vistas declaradas, y concentracion de orquestacion en `AppShell.tsx`.

No se ha modificado frontend de producto, Supabase, SQL, RLS, Auth ni logica de negocio.

## 2. Veredicto

Veredicto global: `APPROVED_WITH_DOCUMENTED_DEBT`

Motivo:

- la app real ya tiene shell, workspaces, overlays, StepFlow, public standalone routes e ինտernal views alineadas con el blueprint;
- no hay evidencia de una brecha P0 abierta en la inspeccion realizada;
- persisten P2/P3 de densidad, coherencia visual y drift documental/estructural;
- la auditoria de codigo es suficiente para inventario y comparacion, pero la validacion visual completa debe quedar enlazada a la preview publicada por la rama.

## 3. Estado real del repositorio

### Git

- `origin/main` actualizado a `af573f80915e9b34c981a959e9a4bcd51a0b93c4`
- rama creada desde `origin/main`: `agent/stitch-fe-01-real-frontend-audit`
- arbol limpio al arrancar la rama
- PR #9 fusionada en GitHub

### Archivos obligatorios verificados en `origin/main`

- `docs/FRONTEND_GLOBAL_BLUEPRINT.md`
- `docs/STITCH_FRONTEND_REALITY_ROADMAP_20260731.md`
- `AGENTS.md` actualizado con el nuevo orden de lectura

### PRs abiertas que no forman parte del sprint

- `#5` `chore: install premium mobile-first frontend audit agent`
- `#4` `docs(billing): open billing automation roadmap`
- `#3` `docs(billing): open automation roadmap`

No bloquean esta auditoria, pero si son deuda de governance paralela.

## 4. Inventario completo

Clasificacion usada:

- `TESTED` = validado con ejecucion o QA visual
- `CODE_REVIEW_ONLY` = validado por codigo
- `BLOCKED` = inaccesible o no verificable con la evidencia disponible
- `NOT_DISCOVERED` = no encontrado en la superficie real

### 4.1 Superficies raiz

| ID | Superficie | AppView / ruta real | Archivo principal | Componentes relacionados | Objetivo | Accion primaria actual | Accion primaria objetivo | Datos requeridos | Estados | Breakpoints | Riesgos | Stitch | Cobertura |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | Boot / splash | inicial | `src/App.tsx` | `BuildInfoBadge`, `ToastProvider` | Arranque seguro de sesion y tema | Cargar sesion | Mostrar estado de arranque claro | sesion, tema, build info | loading, error | 390, 768, 1024, desktop | deuda minima de copy de arranque | ACCEPT | CODE_REVIEW_ONLY |
| R-02 | Auth page | `/` sin sesion | `src/features/auth/AuthPage.tsx` | `logoutFlow`, `theme` | Entrada autentica | Iniciar sesion | Iniciar sesion con feedback claro | credenciales, sesion | loading, error, success | 390, 768, desktop | puede acumular copy legacy | ADAPT | CODE_REVIEW_ONLY |
| R-03 | Shell interno | `?view=` | `src/app/AppShell.tsx` | `AppNav`, `AppShellViewRenderer`, `ConfirmDialog`, `DataHealthDebugPanel` | Orquestar vistas internas | Cambiar vista, abrir workspaces, ejecutar acciones cruzadas | Mantener shell unico y legible | leads, clients, properties, quotes, jobs, invoices, payments, expenses, closings | loading, empty, error, saving, saved, success, blocked | 390, 768, 1024, desktop | archivo muy concentrado | ADAPT | CODE_REVIEW_ONLY |
| R-04 | Navegacion shell | `?view=` | `src/app/AppNav.tsx` | `AlertsBell`, `ThemeToggle` | Navegacion desktop y dock movil | Abrir modulos | Mantener un solo shell y un solo logout por viewport | currentView, alerts, theme, account | active, expanded, dialog, sheet | 390, 768, 1024, desktop | riesgo de overflow y drift de aliases | ADAPT | CODE_REVIEW_ONLY |
| R-05 | Renderizado lazy shell | `?view=` | `src/app/AppShellViewRenderer.tsx` | `DSPageLoading` | Carga diferida por vista | Suspense/loading | Loading compacto y real | currentView, isInitialDataLoading | loading | 390, 768, 1024, desktop | puede volverse pesado si crece | ADAPT | CODE_REVIEW_ONLY |
| R-06 | Home | `dashboard` | `src/pages/HomePage.tsx` | dashboard components | Console operativa diaria | Ejecutar prioridad del dia | Prioridad dominante y pocas capas | metrics, agenda, alerts, quick views | loading, empty, error, success | 390, 768, 1024, desktop | tendencia a densificarse | ACCEPT | CODE_REVIEW_ONLY |
| R-07 | Centro de alertas | `alerts` | `src/pages/AlertsCenterPage.tsx` | `alertPresentation`, `alertRules` | Cola accionable de incidencias | Abrir y resolver alerta | Severidad y accion clara | alerts, reviewed ids | loading, empty, error, reviewed | 390, 768, 1024, desktop | crecer verticalmente | ACCEPT | CODE_REVIEW_ONLY |
| R-08 | Cierre fiscal | `fiscal_closing`, `quarterly_closing`, `annual_closing` | `src/pages/FiscalClosingPage.tsx` | `closingSummaryEngine`, `FiscalPeriodSelector` | Preparacion fiscal prudente | Revisar y preparar periodo | Readiness y warning claros | invoices, payments, expenses, closings | loading, blocked, warning, success | 390, 768, 1024, desktop | superficie larga y sensible | ACCEPT | CODE_REVIEW_ONLY |
| R-09 | Leads | `leads` | `src/pages/LeadsPage.tsx` | `LeadsList`, `LeadCreateForm`, `LeadDetailCard` | Captura y conversion comercial | Crear o convertir lead | Siguiente paso comercial claro | leads, lead drafts, clients | loading, empty, duplicate, success | 390, 768, 1024, desktop | lista/workspace con bastante orquestacion | ADAPT | CODE_REVIEW_ONLY |
| R-10 | Clientes | `clients` | `src/pages/ClientsPage.tsx` | `ClientWorkspace`, `ClientsList`, `ClientCreateForm` | Directorio y workspace de cliente | Abrir workspace o crear cliente | Workspace claro y compacto | clients, properties, jobs, quotes, invoices, payments, recurring plans | loading, empty, unsaved, success | 390, 768, 1024, desktop | detalle largo, riesgo de nested cards | ADAPT | CODE_REVIEW_ONLY |
| R-11 | Propiedades | `properties` | `src/pages/PropertiesPage.tsx` | `PropertyWorkspace`, `PropertiesList`, `PropertyCreateForm` | Contexto operativo de ubicacion | Abrir workspace o crear propiedad | Propiedad como ubicacion de servicio | properties, clients, jobs, quotes, invoices, payments | loading, empty, duplicate, success | 390, 768, 1024, desktop | riesgo de patrimonial drift si se densifica | ADAPT | CODE_REVIEW_ONLY |
| R-12 | Presupuestos | `quotes` | `src/pages/QuotesPage.tsx` | `QuoteCreateFlow`, `QuoteEditFlow`, `QuoteDocumentScreen` | Crear, revisar y documentar presupuestos | Crear/abrir presupuesto | CTA por estado y sin dramatizar IVA | quotes, clients, properties, jobs, invoices | loading, empty, duplicate, success | 390, 768, 1024, desktop | complejidad de flujo alta | ADAPT | CODE_REVIEW_ONLY |
| R-13 | Servicios | `jobs` | `src/pages/JobsPage.tsx` | `JobWorkspace`, `JobCreateFlow`, `JobDetailCard` | Agenda operativa y facturacion derivada | Abrir servicio o crear desde quote | Siguiente accion operativa clara | jobs, clients, properties, quotes, invoices | loading, empty, unsaved, success | 390, 768, 1024, desktop | carga funcional alta | ADAPT | CODE_REVIEW_ONLY |
| R-14 | Facturas | `invoices` | `invoices` | `InvoicesPage`, `InvoiceCreateFlow`, `InvoiceDetailCard`, `InvoiceDocumentScreen` | Facturacion legal y cobro | Abrir o emitir factura | Cobro y documento con prioridad dominante | invoices, jobs, quotes, clients, properties, payments | loading, empty, blocked, duplicate, success | 390, 768, 1024, desktop | zona critica de numeracion y densidad | ACCEPT | CODE_REVIEW_ONLY |
| R-15 | Cobros | `payments` | `src/pages/PaymentsPage.tsx` | `PaymentsList`, `PaymentCreateFlow`, `PaymentDetailCard` | Bandeja auxiliar de cobros | Registrar o revisar cobro | Subordinado a factura | payments, invoices, clients, properties, jobs | loading, empty, duplicate, success | 390, 768, 1024, desktop | no debe competir con facturas | ADAPT | CODE_REVIEW_ONLY |
| R-16 | Gastos | `expenses` | `src/pages/ExpensesPage.tsx` | `ExpensesList`, `ExpenseCreateFlow`, `ExpenseDetailCard`, `ExpenseFiscalReviewPanel` | Soporte documental y fiscal | Crear o revisar gasto | Revisión documental clara | expenses, invoices, quotes | loading, empty, blocked, duplicate, success | 390, 768, 1024, desktop | acumulacion de bloques auxiliares | ACCEPT | CODE_REVIEW_ONLY |
| R-17 | Public quote request | `/quote-request`, `/presupuesto` | `src/pages/PublicQuoteRequestPage.tsx` | `PublicQuoteRequestForm`, `api/public-quote-request.js` | Intake publico aislado | Completar formulario | StepFlow/aislamiento claros | contact, service, property, schedule, details | loading, error, success | 390, 768, mobile | write path publico con control manual | ACCEPT | CODE_REVIEW_ONLY |
| R-18 | Public quiz | `/manual-quiz`, `/prueba-operativa-gimnasio`, `/prueba-manual-gimnasio` | `src/pages/PublicGymManualQuizPage.tsx` | `ManualQuizExperience`, `api/public-quiz` | Quiz publico aislado | Completar quiz | Aislamiento total del shell | quiz answers, public state | loading, error, success | 390, 768, mobile | debe seguir fuera del shell | ACCEPT | CODE_REVIEW_ONLY |
| R-19 | Dev step preview | `/dev/step-flow-preview` | `src/pages/DevStepFlowPreviewPage.tsx` | StepFlow primitives | Preview interna de flujo | Ver secuencia | Herramienta dev, no producto | demo state | preview | desktop, dev | no debe contaminar producto | SUPERSEDED | CODE_REVIEW_ONLY |
| R-20 | Portal app | `/portal` y subrutas | `src/portal/PortalApp.tsx` | `PortalShell`, `PortalAuthScreen`, `PortalAccessScreen` | Portal aislado | Login, acceso, cuenta | Frontera publica separada | portal lifecycle, membership, access state | booting, unauthenticated, password recovery, active member, session expired | 390, 768, desktop | boundary de seguridad | ACCEPT | CODE_REVIEW_ONLY |

### 4.2 Componentes compartidos relevantes

| ID | Componente / patron | Archivo | Uso real | Cobertura |
| --- | --- | --- | --- | --- |
| C-01 | `DSPageLoading` | `src/design-system/components/DSPageLoading.tsx` | Loading comun del shell | CODE_REVIEW_ONLY |
| C-02 | `DSPageHeader` | `src/design-system/components/DSPageHeader.tsx` | Encabezados de pagina | CODE_REVIEW_ONLY |
| C-03 | `DSSectionHeader` | `src/design-system/components/DSSectionHeader.tsx` | Titulos de seccion | CODE_REVIEW_ONLY |
| C-04 | `DSCard` | `src/design-system/components/DSCard.tsx` | Superficies base | CODE_REVIEW_ONLY |
| C-05 | `DSBadge` / `SeverityBadge` | `src/design-system/components/DSBadge.tsx`, `src/components/SeverityBadge.tsx` | Estado y severidad | CODE_REVIEW_ONLY |
| C-06 | `DSSearchInput` | `src/design-system/components/DSSearchInput.tsx` | Busqueda dominante | CODE_REVIEW_ONLY |
| C-07 | `DSCompactFilterGroup` / `DSListControlBar` | `src/design-system/components/DSCompactFilterGroup.tsx`, `src/design-system/components/DSListControlBar.tsx` | Filtros compactos | CODE_REVIEW_ONLY |
| C-08 | `DSActiveFilters` / `DSFilterChip` | `src/design-system/components/DSActiveFilters.tsx`, `src/design-system/components/DSFilterChip.tsx` | Filtros activos visibles | CODE_REVIEW_ONLY |
| C-09 | `FullscreenStepFlow` | `src/components/FullscreenStepFlow.tsx` | StepFlow principal | CODE_REVIEW_ONLY |
| C-10 | `ActionFlowOverlay` / `MajorEditFlowOverlay` | `src/components/ActionFlowOverlay.tsx`, `src/components/MajorEditFlowOverlay.tsx` | Creacion y edicion guiada | CODE_REVIEW_ONLY |
| C-11 | `WorkspaceScaffold` | `src/components/WorkspaceScaffold.tsx` | Workspaces | CODE_REVIEW_ONLY |
| C-12 | `ConfirmDialog` | `src/components/ConfirmDialog.tsx` | Confirmaciones riesgosas | CODE_REVIEW_ONLY |
| C-13 | `ToastProvider` | `src/shared/toasts/ToastProvider.tsx` | Confirmacion leve / feedback | CODE_REVIEW_ONLY |
| C-14 | `AlertsBell` | `src/app/AlertsBell.tsx` | Alertas globales | CODE_REVIEW_ONLY |
| C-15 | `ThemeToggle` | `src/app/ThemeToggle.tsx` | Tema | CODE_REVIEW_ONLY |

## 5. Mapa de navegacion y componentes

### 5.1 Shell autenticado

- `src/App.tsx` decide entre boot, auth, public standalone, dev preview y shell autenticado.
- `src/app/useShellNavigation.ts` conserva la navegacion interna en `?view=`.
- `src/app/navigation.ts` define las vistas soportadas.
- `src/app/AppShell.tsx` orquesta datos, filtros, workspaces y modulos.
- `src/app/AppNav.tsx` pinta la navegacion desktop y movil.
- `src/app/AppShellViewRenderer.tsx` controla loading/suspense por vista.

### 5.2 Rutas publicas aisladas

- `/quote-request` y `/presupuesto` -> `PublicQuoteRequestPage`
- `/manual-quiz`, `/prueba-operativa-gimnasio`, `/prueba-manual-gimnasio` -> `PublicGymManualQuizPage`
- `/dev/step-flow-preview` -> `DevStepFlowPreviewPage` solo en dev

### 5.3 Portal aislado

- `/portal` y subrutas -> `PortalApp`
- `PortalShell` solo se renderiza cuando hay membership activa
- la frontera de auth esta separada del CRM interno

## 6. Matriz de cobertura

| Superficie | Cobertura | Evidencia |
| --- | --- | --- |
| Boot / auth / shell / public routes / portal | `CODE_REVIEW_ONLY` | inspeccion de `src/App.tsx`, `src/app/*`, `src/portal/*` |
| Home / alerts / closing / leads / clients / properties / quotes / jobs / invoices / payments / expenses | `CODE_REVIEW_ONLY` | inspeccion de `src/pages/*`, `src/features/*` y orquestacion en `AppShell.tsx` |
| StepFlow y overlays | `CODE_REVIEW_ONLY` | primitives compartidas y flows por dominio |
| Listas y filtros | `CODE_REVIEW_ONLY` | primitives DS y paginas de modulo |
| Estados loading/empty/error/success | `CODE_REVIEW_ONLY` | primitives DS, shell renderer y docs de debt |
| QA visual real con preview de rama | `TESTED` en superficies publicas / `BLOCKED` para shell autenticado | validado en preview local con `390x844` y `768x1024` sobre `/quote-request` y `/manual-quiz`; el shell autenticado sigue requiriendo una sesion navegable segura |

## 7. Comparacion Stitch -> realidad

### 7.1 Clasificacion de artefactos Stitch

| Artefacto / familia | Decision | Motivo |
| --- | --- | --- |
| Splash, login, Home | `ADAPT` | compatibles con el shell real, pero deben respetar auth y datos reales |
| Clientes / Propiedades / workspaces corregidos | `ADAPT` | buenos patrones de jerarquia, pero el contrato real manda |
| Quotes / Jobs / Invoices / Payments / Expenses | `ADAPT` | utiles como referencia visual, no como contrato de datos |
| Fiscal closing | `ADAPT` | la lectura ejecutiva es valida, pero el engine real es la referencia |
| Expense exports con "Aura Maritime" o fleet | `REJECT` | contienen conceptos fuera de dominio |
| "Maritime Professional" | `ACCEPT` after normalization | identidad visual, no dominio funcional |
| HTML exportos de Stitch | `SUPERSEDED` | no se pueden copiar como source of truth |

### 7.2 Rechazos explicitos

Se rechazan de forma expresa cualquier diseño o concepto relacionado con:

- Aura Maritime
- autoridades portuarias
- flotas
- logistica maritima
- inversion inmobiliaria
- rentabilidad de propiedades
- gestion patrimonial
- trabajadores
- fichajes
- nominas
- inventario
- conciliacion bancaria automatica
- envio automatico de impuestos
- servicios recurrentes funcionales
- OCR automatico
- IA fiscal
- fusion automatica de duplicados

## 8. Sistema visual actual

### Lo que ya esta bien

- shell con header desktop y dock movil
- workspaces reales por entidad
- overlays y StepFlow para altas complejas
- feedback visual compartido por toasts, confirm dialogs y badges
- listas compactas en los modulos mas maduros
- copy orientado a contexto y no a decoracion

### Lo que aun se desvia del blueprint

- demasiadas superficies largas en `AppShell.tsx`
- densidad vertical alta en `InvoicesPage`, `FiscalClosingPage`, `JobsPage` y algunos workspaces
- drift entre alias vivos y paginas legacy de cierre
- algunos modulos siguen pareciendo panel administrativo clasico
- el loading de shell y el debug panel siguen siendo candidatos a simplificacion adicional

## 9. Sistema visual objetivo

El objetivo del blueprint ya esta bien definido en `docs/FRONTEND_GLOBAL_BLUEPRINT.md`:

- una pantalla, una decision
- una accion primaria
- pocos niveles visuales
- listas compactas
- filtros secundarios
- StepFlow para altas complejas
- mobile primero real
- tono "Maritime Professional" como atmosfera, no como dominio

## 10. Auditoria mobile-first

### 390x844

- positivo: dock movil, header compacto, overlays dedicados, CTA principal cercano
- riesgo: paginas con demasiados bloques en una sola vista
- estado: `CODE_REVIEW_ONLY`

### 768x1024

- positivo: shell usa un comportamiento especifico de tablet, no desktop comprimido
- riesgo: overflow de top rail y desacoplo de bloques densos
- estado: `CODE_REVIEW_ONLY`

### 1024x768

- positivo: es el punto donde shell y workspace pueden compartir contexto
- riesgo: algunos workspaces siguen siendo largos
- estado: `CODE_REVIEW_ONLY`

### 1440x900 o equivalente

- positivo: el shell soporta rail y context
- riesgo: exceso de ancho en tarjetas no decisionales
- estado: `CODE_REVIEW_ONLY`

## 11. Auditoria tablet

Tablet no debe tratarse como desktop reducido. En el codigo actual hay soporte para:

- shell responsive
- dock movil / rail desktop
- overlays y workspaces
- back navigation y unsaved change guards

Riesgo principal pendiente:

- cualquier cambio en AppNav o shell CSS puede reintroducir overflow horizontal o perder densidad util.

### QA visual real sobre preview local

Validacion ejecutada sin datos reales y sin tocar rutas de negocio:

- `390x844`
  - `/quote-request`: hero, StepFlow y primer bloque del formulario visibles sin overflow horizontal.
  - `/manual-quiz`: entrada operativa visible con CTA principal y bloque de privacidad.
- `768x1024`
  - `/quote-request`: la pagina conserva jerarquia clara; el primer formulario y el StepFlow quedan visibles en la parte superior.

Hallazgos visuales:

- la pantalla de acceso raiz sigue siendo una barrera intencional para el shell autenticado;
- las superficies publicas principales mantienen la jerarquia mobile-first esperada;
- no se detecto necesidad de escritura de datos reales durante la validacion.

## 12. Auditoria desktop

Desktop ya tiene:

- rail por secciones
- estado activo por vista
- cuenta y logout por viewport
- sync y theme controls
- workspaces y detail panes

La deuda desktop es de consistencia, no de capacidad.

## 13. App Shell

### Hallazgos

- `AppShell.tsx` concentra demasiadas responsabilidades cross-module.
- `AppNav.tsx` tiene buena jerarquia pero sigue dependiendo de CSS extenso y de estados auxiliares.
- `useShellNavigation.ts` es correcto para la compatibilidad actual, pero el query-param router interno sigue siendo una abstraccion menos transparente que rutas dedicadas.

### Riesgo

P2 estructural por concentracion de orquestacion y drift conceptual.

## 14. Componentes compartidos

La base compartida ya existe y es lo bastante rica para no inventar otro design system:

- `ExecutiveHeader`
- `VisualKpiCard`
- `ActionChecklist`
- `SeverityBadge`
- `InsightPanel`
- `CollapsibleDetailSection`
- `WorkspaceScaffold`
- `ModuleFilterBar`
- `ListToolbar`
- `SearchBar`
- `FullscreenStepFlow`
- `ActionFlowOverlay`
- `MajorEditFlowOverlay`
- `ConfirmDialog`
- `DS*` primitives

Conclusión: consolidar, no duplicar.

## 15. Listas y filtros

- Search es el control dominante en las listas operativas.
- Filtros deben seguir compactos y secundarios.
- `DSListControlBar` y `ListToolbar` son la base para evitar toolbars paralelas.
- El repo ya muestra convergencia real en clientes, propiedades, leads, facturas y otros directorios.

## 16. Workspaces

Los workspaces siguen el patrón:

1. identidad y contexto de retorno
2. estado actual
3. siguiente accion recomendada
4. snapshot compacto
5. tabs
6. contenido activo

Esto se ve claramente en clientes, propiedades y servicios. El blueprint ya lo normaliza.

## 17. Formularios y StepFlows

### Confirmados como complejos

- invoice create/edit
- quote create/edit
- job create
- expense create/edit
- payment create
- recurring invoice plan
- public intake

### Estado real

Los Flows ya existen, pero el control de densidad y el copy de review/success aun no estan completamente uniformados.

### Riesgo

P2/P3 de consistencia y mantenibilidad, no de ausencia total de capability.

## 18. Estados

El sistema de estados esperado por el blueprint esta razonablemente cubierto:

- loading
- empty
- no results
- error
- retry
- saving
- saved
- success
- disabled
- blocked
- duplicate
- unavailable
- unsaved changes
- session expired
- insufficient permissions

Punto clave: el repo ya evita presentar datos falsos como estado guardado.

## 19. Accesibilidad

Cobertura por codigo:

- focus visible
- aria-current y landmarks en shell
- botones con target tactil razonable
- reduced motion en primitives donde aplica
- dialogos/sheets con cierre y foco

Pendiente de validar visualmente:

- orden de tabulacion real en preview
- contraste en viewports concretos
- uso de color en los estados mas densos

## 20. Terminologia

Confirmado:

- `Cobros` = ingresos recibidos de clientes
- `Pagos` = salidas de dinero o metodo de pago de gastos

No se deben renombrar identificadores tecnicos internos como:

- `payments`
- `PaymentListItem`
- tablas
- APIs
- tipos
- funciones
- `AppView`
- contratos

El cambio permitido es de texto visible, no de contrato interno.

## 21. Hallazgos P0-P3

### P0

Ninguno confirmado en la auditoria de codigo disponible.

### P1

Ninguno confirmado en la auditoria de codigo disponible.

### P2

#### FE01-P2-01

- Prioridad: P2
- Modulo: Shell / navegacion
- Superficie: `src/app/AppShell.tsx`, `src/app/AppNav.tsx`, `src/app/useShellNavigation.ts`
- Archivo: `src/app/AppShell.tsx`
- Viewport: 390x844, 768x1024, 1024x768, desktop
- Estado: CODE_REVIEW_ONLY
- Evidencia: el shell sigue usando `?view=` como router interno y concentra orquestacion de datos, filtros y acciones cruzadas en un solo archivo.
- Impacto: alta complejidad de mantenimiento y riesgo de drift visual/estructural.
- Correccion minima: mantener la compatibilidad actual y seguir desacoplando solo por capas compartidas.
- Riesgo: reintroducir inconsistencia si se intenta mover demasiadas piezas a la vez.
- Validacion necesaria: review de refactor incremental, no reescritura.
- Sprint recomendado: Sprint tecnico separado.

#### FE01-P2-02

- Prioridad: P2
- Modulo: Facturas / cierre fiscal
- Superficie: `src/pages/InvoicesPage.tsx`, `src/pages/FiscalClosingPage.tsx`
- Archivo: `src/pages/InvoicesPage.tsx`
- Viewport: 390x844, 768x1024
- Estado: CODE_REVIEW_ONLY
- Evidencia: ambos modulos concentran mucha densidad operativa y legal, con varios modos secundarios alrededor de la accion primaria.
- Impacto: carga cognitiva alta en mobile/tablet.
- Correccion minima: conservar jerarquia actual y seguir empujando bloques secundarios a `Mas` o a superficies colapsables.
- Riesgo: confundir prioridad con ruido.
- Validacion necesaria: preview visual con viewport real.
- Sprint recomendado: Sprint financiero o hardening visual posterior.

#### FE01-P2-03

- Prioridad: P2
- Modulo: Clientes / propiedades / servicios
- Superficie: `src/features/clients/ClientWorkspace.tsx`, `src/features/properties/PropertyWorkspace.tsx`, `src/features/jobs/JobWorkspace.tsx`
- Archivo: `src/features/clients/ClientWorkspace.tsx`
- Viewport: 390x844, 768x1024
- Estado: CODE_REVIEW_ONLY
- Evidencia: los workspaces siguen resolviendo bastante jerarquia mediante bloques apilados y detail surfaces grandes.
- Impacto: riesgo de nested-card inflation y lectura pesada.
- Correccion minima: mantener una sola superficie principal por intent.
- Riesgo: perder ancho util y claridad en CTA.
- Validacion necesaria: QA visual autenticada.
- Sprint recomendado: hardening UI transversal.

### P3

#### FE01-P3-01

- Prioridad: P3
- Modulo: Repo hygiene
- Superficie: `src/pages/*.bak-*`
- Archivo: `src/pages/AnnualClosingPage.tsx`
- Viewport: n/a
- Estado: CODE_REVIEW_ONLY
- Evidencia: existen backups versionados dentro del arbol de paginas.
- Impacto: ruido de mantenimiento y riesgo de confundir superficie viva con legado.
- Correccion minima: mantener fuera del alcance funcional y limpiar en sprint tecnico separado si se autoriza.
- Riesgo: bajo, pero persistente.
- Validacion necesaria: ninguna visual; solo higiene de repo.
- Sprint recomendado: sprint tecnico separado.

#### FE01-P3-02

- Prioridad: P3
- Modulo: Drift documental
- Superficie: `docs/APP_SHELL_NAVIGATION.md`, `docs/CURRENT_APP_AUDIT.md`, `docs/UX_DEBT_REGISTER.md`
- Archivo: `docs/UX_DEBT_REGISTER.md`
- Viewport: n/a
- Estado: CODE_REVIEW_ONLY
- Evidencia: hay documentos previos que describen una foto anterior o parcial del producto.
- Impacto: posible confusion si se usan como fuente primaria en sprint nuevo.
- Correccion minima: usar `FRONTEND_GLOBAL_BLUEPRINT.md` y esta auditoria como referencia actual.
- Riesgo: bajo.
- Validacion necesaria: ninguna.
- Sprint recomendado: governance.

## 22. Riesgos

1. `AppShell.tsx` sigue siendo el punto de mayor acoplamiento.
2. `?view=` sigue siendo una compatibilidad util pero menos expresiva que rutas dedicadas.
3. Facturas y cierre fiscal siguen siendo las superficies mas sensibles para densidad y riesgo.
4. La validacion visual completa depende de preview navegable de la rama y acceso real al shell.
5. Los documentos legacy de auditoria y deuda pueden ser confusos si se toman como verdad final.

## 23. Funcionalidades rechazadas

Se rechaza o se mantiene fuera de alcance en esta auditoria cualquier:

- copia de HTML Stitch dentro de `src/`
- cambio de rutas
- cambio de auth
- cambio de Supabase
- cambio de SQL / RLS / RPC
- cambio de calculos fiscales o numeracion
- adopcion de dominio maritimo, portuario o inmobiliario
- OCR automatico
- IA fiscal
- autofusion de duplicados
- recurrencia funcional de servicios

## 24. Logica protegida

Protegido y no modificado:

- Supabase
- SQL
- RLS
- RPC
- migraciones
- Auth
- session handling
- Storage
- Edge Functions
- rutas
- `AppView`
- persistencia
- calculos
- impuestos
- numeracion
- facturas
- presupuestos
- cobros
- gastos
- cierre fiscal
- documentos
- produccion

## 25. Deuda

Deuda que permanece viva tras la auditoria:

- consolidar visualmente `AppShell` y primitives compartidas sin reescribir el shell
- seguir normalizando densidad en invoices, closing, jobs y workspaces
- cerrar el drift entre docs legacy y blueprint canonical
- validar visualmente tablet y desktop con la preview de la rama
- seguir absorbiendo estados inline y copy repetido en formularios largos

## 26. Roadmap de implementacion actualizado

### Estado de STITCH-FE-01

`DONE_WITH_DOCUMENTED_DEBT`

### Cobertura

- shell y boot: cubiertos por codigo
- public routes: cubiertos por codigo
- portal aislado: cubierto por codigo
- vistas principales del CRM: cubiertas por codigo
- visual QA de preview: pendiente de confirmacion navegable en la rama

### Evidencia

- lectura de `origin/main`
- inspeccion de `src/App.tsx`, `src/app/*`, `src/pages/*`, `src/features/*`, `src/portal/*`
- lectura de `docs/CURRENT_APP_AUDIT.md`, `docs/VISUAL_UX_APP_AUDIT.md`, `docs/APP_SHELL_NAVIGATION.md`, `docs/UX_DEBT_REGISTER.md`

### Bloqueos

- la preview de la rama debe ser navegable para completar la parte visual del informe

### Hallazgos

- P0: 0
- P1: 0
- P2: 3
- P3: 2

### Primer slice autorizado

`STITCH-FE-02` debe empezar por tokens y temas:

- `src/index.css`
- `src/App.css`
- `src/app/theme.ts`
- primitives de design system ya existentes

### Siguiente sprint

`STITCH-FE-02 — Token and theme convergence`

## 27. Primer slice seguro

El primer slice seguro para continuar es unificar tokens y tema sin tocar logica de negocio:

1. consolidar variables de superficie, texto, borde, marca y estado
2. alinear dark/light parity
3. mantener aliases de compatibilidad
4. evitar reemplazos globales ciegos
5. no introducir dependencias nuevas

## 28. Criterios de aceptacion para STITCH-FE-02

- no hay regresion material de contraste
- dark y light se mantienen coherentes
- la jerarquia tipografica queda normalizada
- spacing y radius siguen un sistema unico
- no cambia la logica de modulo, rutas ni writes
- lint, tests y build pasan

## 29. Prompt exacto para STITCH-FE-02

### Objective

Reconcile the existing CSS variables and theme primitives with the normalized Maritime Professional system without changing module behavior, routes, or protected logic.

### Evidence

- `docs/FRONTEND_GLOBAL_BLUEPRINT.md`
- `docs/STITCH_FRONTEND_REALITY_ROADMAP_20260731.md`
- `docs/STITCH_FE_01_REAL_FRONTEND_AUDIT_20260802.md`
- `src/index.css`
- `src/App.css`
- `src/app/theme.ts`

### Scope

- tokens for surfaces, text, borders, brand, status and focus
- dark/light parity
- typography hierarchy
- spacing and radius scale
- subtle elevation and motion values
- compatibility aliases for existing styles

### Non-goals

- no frontend product redesign beyond token/theme convergence
- no route changes
- no Supabase changes
- no Auth changes
- no SQL, RLS, RPC or migration changes
- no business logic changes
- no new dependencies

### Acceptance criteria

- dark and light modes remain coherent
- contrast does not regress materially
- existing module behavior is unchanged
- tokens are centralized enough to reduce drift
- compatibility with current styles is preserved

### Validation

- `npm run qa:agents`
- `npm run lint`
- `npm run test`
- `npm run build`
- focused visual QA on current shell and key surfaces

### Stop conditions

- any need to touch route, auth, Supabase or fiscal logic
- any requirement to rewrite a protected flow
- any unresolved contrast regression
- any sign that the sprint is becoming a shell refactor instead of a token/theme convergence

### Delivery

- one commit
- push to the audit branch
- draft PR only
- no production writes
