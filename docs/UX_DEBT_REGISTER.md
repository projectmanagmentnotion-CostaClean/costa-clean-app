# UX Debt Register

| ID | Modulo | Pantalla/archivo | Problema UX | Severidad | Impacto | Recomendacion | Sprint recomendado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UX-001 | Shell | `src/app/AppNav.tsx`, `src/app/useShellNavigation.ts` | Navegacion real basada en `?view=` y no en rutas expresivas. Sprint 4 ordena la capa visual y la jerarquia del shell, pero el mecanismo sigue siendo un query-param router interno por compatibilidad. | media | Riesgo de navegacion menos transparente y deuda de evolucion | Mantener la limpieza visual actual y posponer cualquier cambio de mecanismo a un sprint tecnico separado | Sprint tecnico separado |
| UX-002 | Dashboard | `src/pages/HomePage.tsx` | Sprint 5 simplifica la jerarquia y Motion Phase 2 anade quick actions, KPIs y charts SVG ligeros con mejor lectura operativa. Aun asi, Inicio sigue dependiendo de agregados cross-module y puede volver a densificarse si se reintroducen bloques o charts sin criterio. | media | Mejor lectura diaria y mejor foco visual, con deuda residual de composicion cross-module | Mantener el criterio decision-first actual, no reanadir tablas ni paneles equivalentes y exigir dato real + CTA clara para cualquier chart futuro | Seguimiento post Motion Phase 2 |
| UX-003 | Cierre fiscal | `src/pages/FiscalClosingPage.tsx` | Sprint 11 aclara la lectura principal, el bloque de decision y el orden entre checklist, warnings y snapshot, pero el workspace sigue siendo largo y concentra mas contexto del ideal en una sola pantalla. | media | Menor fatiga cognitiva, con deuda residual por profundidad del dominio de cierre | Mantener la jerarquia actual y reservar cualquier desacople mayor o mini-StepFlow para un sprint financiero separado | Seguimiento post Sprint 11 |
| UX-004 | Leads | `src/pages/LeadsPage.tsx` | Sprint 9A elimina el panel ad hoc de busqueda/filtros y lo sustituye por la barra comun del sistema, pero el modulo sigue siendo mas workspace-first que decision-first y mantiene bastante orquestacion en una sola pagina. | media | Mejor consistencia global de listas, con deuda residual en la jerarquia del workspace comercial | Mantener la barra comun y revisar solo la jerarquia del detalle/acciones en sprint comercial separado | Seguimiento post Sprint 9A |
| UX-005 | Clientes | `src/pages/ClientsPage.tsx`, `src/features/clients/ClientWorkspace.tsx` | Sprint 9 y 9A ordenan la entrada a clientes y unifican la barra de lista, pero el alta y el detalle editable siguen sin una estructura StepFlow o panel mas corto. | baja | Mejor lectura de cartera y workspace, con deuda residual en onboarding y detalle largo | Mantener la jerarquia actual y tratar create/edit como mejora futura separada si vuelve a crecer | Seguimiento post Sprint 9A |
| UX-006 | Propiedades | `src/pages/PropertiesPage.tsx`, `src/features/properties/PropertyWorkspace.tsx`, `src/features/properties/PropertyDetailCard.tsx` | Sprint 9 y 9A mejoran portada, listados y hero del workspace, pero el detalle editable de propiedad sigue condicionado por un write path sensible y no conviene rediseñarlo agresivamente en la misma fase. | media | La portada y el contexto mejoran, pero el detalle sigue siendo una superficie de riesgo mixto UX/persistencia | Mantener el workspace actual y reservar el detalle editable para sprint separado si antes se desacopla su write path | Seguimiento post Sprint 9A |
| UX-007 | Presupuestos | `src/pages/QuotesPage.tsx`, `src/features/quotes/QuoteCreateFlow.tsx`, `src/features/quotes/QuoteEditFlow.tsx` | Sprint 7 resuelve la deuda principal del create/edit: ambos flujos quedan alineados con 7 pasos, revision final y success state. Sigue quedando deuda media en la dispersion entre listado, detalle, documento y acciones de conversion. | media | Mucha menos friccion en creacion y edicion, aunque el workspace de detalle sigue concentrando conversiones posteriores | Mantener el StepFlow actual y tratar conversiones/acciones del workspace en sprint comercial separado si vuelven a crecer | Seguimiento post Sprint 7 |
| UX-008 | Servicios | `src/pages/JobsPage.tsx`, `src/features/jobs/JobWorkspace.tsx`, `src/features/jobs/JobCreateFlow.tsx` | Sprint 10 aclara la entrada rapida, mejora filtros operativos y hace mas legible el workspace, pero `JobDetailCard.tsx` sigue siendo una superficie grande y el modulo aun concentra agenda, facturacion, duplicados y actividad en un mismo dominio. | media | Mucho mejor lectura diaria y mejor handoff al alta, con deuda residual en desacople de detalle y operativa avanzada | Mantener StepFlow oficial como alta unica y revisar solo el desacople de detalle/actividad si el modulo vuelve a crecer | Seguimiento post Sprint 10 |
| UX-009 | Facturas | `src/pages/InvoicesPage.tsx`, `src/features/invoices/InvoiceDetailCard.tsx` | Sprint 8 reduce la mezcla visual separando cobro, fiscal/numeracion y contexto de factura, pero el workspace sigue concentrando bulk actions, overlays y logica sensible en la misma superficie. | alta | Menor carga cognitiva, aunque sigue existiendo riesgo operativo si el modulo vuelve a crecer sin desacoplar acciones | Mantener la jerarquia actual, no forzar StepFlow completo del workspace y revisar mas adelante si bulk/documento deben salir a superficies aun mas cortas | Seguimiento post Sprint 8 |
| UX-010 | Cobros | `src/pages/PaymentsPage.tsx`, `src/features/payments/PaymentsList.tsx`, `src/features/payments/PaymentDetailCard.tsx` | Sprint 11 unifica headers y estados vacios/error del modulo, pero pagos sigue siendo una bandeja auxiliar que debe mantenerse claramente subordinada al flujo de factura. | baja | Menor ruido visual y mejor consistencia; persiste riesgo semantico si gana demasiado protagonismo frente a facturas | Mantener copy y jerarquia auxiliar actual; no convertir pagos en workspace primario sin sprint funcional separado | Seguimiento post Sprint 11 |
| UX-011 | Gastos | `src/pages/ExpensesPage.tsx`, `src/features/expenses/ExpensesList.tsx`, `src/features/expenses/ExpenseDetailCard.tsx` | Sprint 11 mejora headers y estados base, pero la pantalla sigue apilando KPI, progreso, checklist, duplicados, lista y detalle dentro del mismo modulo. | media | Menor friccion base, con scroll y densidad aun altos en escenarios complejos | Mantener la jerarquia actual y posponer un desacople mayor de soporte/revision a un sprint propio si vuelve a crecer | Seguimiento post Sprint 11 |
| UX-012 | Intake publico | `src/features/publicIntake/PublicQuoteRequestForm.tsx` | Sprint 6 migra el intake publico al StepFlow oficial y anade revision final y success state propio. La deuda principal ya no es el stepper, sino la validacion local aun incrustada en el formulario. | media | Flujo mucho mas claro y consistente, pero con orquestacion todavia concentrada en un unico archivo | Mantener el pipeline intacto y extraer helpers de validacion solo en sprint tecnico separado si vuelve a crecer | Seguimiento post Sprint 6 |
| UX-013 | Auth | `src/features/auth/AuthPage.tsx` | Pantalla cuidada, pero todavia aislada del resto de contratos de estados y componentes comunes. | baja | Baja friccion, deuda limitada | Alinear tokens y estados visuales cuando exista design system base | Sprint 2 |
| UX-014 | Modulos legacy | `src/pages/AnnualClosingPage.tsx`, `src/pages/QuarterlyClosingPage.tsx` | Existen pantallas grandes que no son la superficie viva principal. | media | Ruido de implementacion y riesgo de duplicar criterios UX | Mantener documentadas y decidir su retiro o absorcion | Sprint 4 |
| UX-015 | Repo hygiene | `src/pages/*.bak-*` | Archivos backup versionados dentro de paginas reales. No rompen UX viva, pero si elevan ruido y riesgo de tocar el archivo incorrecto. | media | Riesgo de mantenimiento y auditoria mas lenta | Limpiar en sprint tecnico separado, nunca mezclado con cambio visual | Sprint tecnico separado |
| UX-016 | Tokens / estilos base | `src/index.css` | Existen bloques `:root` y redefiniciones visuales superpuestas del sistema de tokens. No rompe la app, pero complica la trazabilidad del design system y aumenta el riesgo de drift visual. | media | Mayor coste de mantenimiento y coherencia visual mas fragil | Consolidar tokens en sprint tecnico separado una vez la capa DS este adoptada | Sprint tecnico separado |
| UX-017 | Shell / navegacion | `src/app/AppNav.tsx`, `src/app/navigation.ts`, `src/app/modules.ts` | Hay drift entre vistas vivas y modulos declarados: `annual_closing` y `quarterly_closing` viven como alias de cierre fiscal, mientras `kpis` y `settings` siguen declarados fuera de la navegacion viva. | media | Riesgo de confusion en auditoria, copy y futuras ampliaciones del shell | Mantener alias documentados, no activar modulos no vivos sin sprint propio y retirar drift solo con auditoria dedicada | Sprint tecnico separado |
| UX-018 | Patron global de listas | `src/components/ListToolbar.tsx`, `src/features/clients/ClientsList.tsx`, `src/features/properties/PropertiesList.tsx`, `src/pages/LeadsPage.tsx`, `src/features/quotes/QuotesList.tsx`, `src/features/invoices/InvoicesList.tsx` | Sprint 9A unifica el patron de busqueda/filtros/orden en las listas mas visibles, pero aun quedan otros modulos con controles propios o sin esta capa comun. | media | La experiencia mejora en directorios y workspaces principales, aunque la consistencia todavia no es total en todo el producto | Reusar `DSListControlBar` o `ListToolbar` antes de crear cualquier toolbar nueva y migrar modulos restantes de forma incremental | Sprint 10-12 |
| UX-019 | Estados globales | `src/features/*`, `src/pages/*`, `src/design-system/components/*` | Sprint 12 unifica una parte importante de `empty`, `error`, `loading` y confirmaciones en listas, dashboard, alertas y previews documentales, pero todavia quedan formularios profundos con mensajes inline heredados y copy desigual. | media | Mejor consistencia transversal, con deuda residual en formularios create/edit de dominio | Mantener primitives DS como capa obligatoria para nuevas superficies y hacer una pasada futura solo sobre copy/error de formularios largos | Seguimiento post Sprint 12 |
| UX-020 | Accesibilidad transversal | `src/components/FullscreenStepFlow.tsx`, `src/components/action-flow-overlay.css`, `src/design-system/components/design-system.css`, modulos autenticados legacy | Sprint 13 corrige foco visible y minimos tactiles en la base compartida, pero aun quedan superficies legacy autenticadas cuyo foco depende de clases historicas fuera del DS. | media | La base reusable mejora, aunque puede persistir drift de teclado/foco en workspaces no auditados con sesion real | Hacer una pasada autenticada con datos reales y seguir absorbiendo controles legacy en primitives compartidas antes de nuevos polish visuales | Seguimiento post Sprint 13 |
| UX-021 | Motion adoption | `src/design-system/motion/*`, `src/pages/HomePage.tsx`, modulos compartidos pendientes | Motion Phase 2 ya introduce una primera adopcion productiva controlada en Home con reveals y charts SVG, pero la capa aun no se extiende a primitives compartidas, overlays ni StepFlow. | baja | La app ya obtiene una mejora real en Home, con deuda residual de extension prudente y QA de adopcion | Seguir por StepFlow y overlays antes de listas densas o dominios criticos; no saltar directo a motion transversal decorativa | Motion Phase 3-5 |
| UX-022 | GSAP plugin policy adoption | `src/design-system/motion/gsapPlugins.ts`, `src/design-system/motion/pluginAvailability.ts` | La capa de plugins ya queda auditada y preparada, pero todavia no hay adopcion productiva ni pruebas reales de cada plugin en contextos seguros. | baja | Buena base de control, con trabajo pendiente de adopcion prudente y QA por plugin | Empezar por primitives y overlays pequenos; no saltar directo a dashboards densos ni dominios criticos | Motion Phase 2-5 |
| UX-023 | StepFlow density drift | `src/components/FullscreenStepFlow.tsx`, `src/features/shared/fullscreen-create-flow.css`, flows StepFlow vivos | Motion Phase 3 compacta header, progreso, footer y copy repetida, pero todavia queda orquestacion de review/success y validacion inline repartida entre flows. | media | Menor scroll y mejor ritmo, con deuda residual de consolidacion tecnica | Mantener la shell compacta actual y extraer helpers de copy/summary/validacion solo en sprint tecnico separado | Seguimiento post Motion Phase 3 |
| UX-024 | Overlay/dialog legacy styling | `src/components/ActionFlowOverlay.tsx`, `src/components/ConfirmDialog.tsx`, `src/features/shell/*.css` | La motion y densidad ya mejoran, pero `ConfirmDialog` sigue dependiendo de estilos legacy del shell y no de una hoja aislada propia. | baja | Riesgo moderado de drift visual entre dialogs compartidos | Aislar estilos de dialogo en una capa comun solo si aparece mas drift real | Seguimiento post Motion Phase 3 |
| UX-025 | Formularios inteligentes | `src/features/publicIntake/PublicQuoteRequestForm.tsx`, `src/features/properties/PropertyCreateFlow.tsx`, `src/features/*/*CreateFlow.tsx` | Motion Phase 4 introduce CP/ciudad inteligente y autocompletado inline de conceptos, pero la adopcion aun no es total y quedan superficies legacy con inputs simples o copy desigual. | baja | Mejor ritmo y menos friccion en formularios clave, con deuda residual de extension prudente y uniformidad | Reusar `DSSmartPostalCodeInput` y `DSConceptAutocomplete` solo donde ya existan campos compatibles y sin mezclarlo con cambios de write path | Seguimiento post Motion Phase 4 |
| UX-026 | Home cockpit drift | `src/pages/HomePage.tsx` | Motion Phase 5 elimina los bloques largos tipo informe y reduce Home a KPIs, visual fiscal, quick actions y resumen de alertas. La deuda residual es evitar que futuras fases vuelvan a meter colas o listas largas en portada. | baja | Mucho menos scroll y mejor legibilidad inicial, con riesgo residual de regresion por agregados cross-module | Mantener la Home como cockpit visual y mover todo detalle otra vez a sus modulos | Seguimiento post Motion Phase 5 |
| UX-027 | Filtros verticales largos | `src/design-system/components/DSListControlBar.tsx`, `src/features/expenses/ExpensesList.tsx`, `src/features/invoices/InvoicesList.tsx` | El patron anterior seguia mostrando demasiados grupos simultaneos y generaba scroll innecesario. Este sprint lo compacta a una sola linea + sheet avanzado. | baja | Menos ruido inicial y mejor lectura mobile/desktop, con deuda residual solo en cierres fiscales fuera del wrapper compartido | Mantener `one-line filters` como norma obligatoria y migrar filtros legacy no cubiertos solo en sprints separados | Resuelta en este sprint |
| UX-028 | Correccion de emitidas sin flujo rectificativo explicito | `src/features/invoices/InvoiceEditFlow.tsx`, `src/features/invoices/InvoiceDetailCard.tsx`, `src/features/invoices/InvoiceCorrectionNotice.tsx` | La app sigue sin flujo real de rectificativa, pero ahora expone una correccion guiada segura para la `2026-045` con comparativa y borrador `prefill`. | media | Baja el riesgo de editar la emitida directamente, pero no resuelve por completo la ausencia de rectificativa | Mantener el borrador guiado como ruta segura transitoria y abrir sprint fiscal especifico antes de automatizar correcciones de emitidas | Seguimiento fiscal separado |
| UX-029 | Correccion interna bloqueada por RPC/policies reales | `src/features/invoices/InvoiceEditFlow.tsx`, `scripts/ops/correct-invoice-2026-045.mjs`, `supabase/migrations/20260707_fix_same_number_invoice_update_gap.sql` | La superficie de correccion interna ya separa mejor el guardado frente a emision, pero la aplicacion real sigue bloqueada por un falso hueco SQL en `save_invoice_with_lines` y por falta de permiso efectivo para actualizar la cabecera desde sesion autenticada. | alta | La UX puede quedar lista mientras el cambio real en datos sigue imposible, generando falsa sensacion de cierre | Aplicar la migracion SQL en Supabase real, reintentar la correccion y dejar una via de servidor aprobada si la policy de `invoices` sigue bloqueando la cabecera | Seguimiento tecnico-operativo separado |
| UX-030 | Encapsulacion visual en detalle mobile | `src/features/invoices/InvoiceDetailCard.tsx`, `src/features/clients/ClientDetailCard.tsx`, `src/features/properties/PropertyWorkspace.tsx`, `src/features/jobs/JobWorkspace.tsx` | Varios modulos tienden a resolver jerarquia con cards dentro de cards, lo que reduce ancho util y empeora alineacion de botones en mobile/iPad. | media | El detalle de facturas ya se aplana en este sprint, pero el patron aun puede reaparecer en otros dominios si no se vigila. | Aplicar gate de desencapsulacion: una superficie principal, secciones secundarias ligeras y acciones secundarias bajo `Mas` en viewports estrechos. | Seguimiento post Sprint UI De-nesting |
| UX-031 | Shell tablet overflow | `src/app/AppNav.tsx`, `src/features/shell/shell-dashboard-polish.css`, `src/features/shell/shell-dashboard-structure.css` | La QA viva `768x1024` detecto que el shell superior podia expandir el `scrollWidth` muy por encima del viewport por la rail navigation top-only. | media | Un shell roto invalida la lectura de todos los modulos aunque su contenido este bien densificado. | Mantener el gate de overflow real en iPad y revisar cualquier cambio futuro de rail/topline con captura viva. | Seguimiento post Cross-module UI QA |
| UX-032 | Loading compartido demasiado pesado | `src/app/AppShellViewRenderer.tsx`, `src/components/DeferredContentFallback.tsx`, `src/design-system/components/DSEmptyState.tsx` | El loading del shell seguia entrando como varias cards falsas grandes y el fallback reutilizaba una card vacia pesada para estados temporales. | media | Ruido visual, sensacion de app lenta y contradiccion con el criterio mobile-first minimalista. | Mantener `DSPageLoading` como primitive comun, limitar a `3` filas skeleton y separar loading de empty real. | Seguimiento post Mobile Loading Polish |

## Notas de lectura

- La mayor deuda real no es "la app no tiene UX moderna". La mayor deuda real es inconsistencia entre modulos que ya tienen buenas piezas.
- Los problemas mas serios se concentran en densidad, mezcla de intenciones y repeticion de patrones grandes.
- Facturas merece tratamiento aislado por seguridad operativa, no solo por UX.
- Sprint 4 deja resuelto el estado visual activo del area de cierre fiscal dentro del shell y ordena la navegacion por secciones sin cambiar `?view=` ni activar modulos nuevos.
- Sprint 5 reduce la deuda principal del Dashboard: una sola prioridad dominante, quick actions mas cortas y banda de alertas/revision menos invasiva.
- Sprint 6 deja resuelta la deuda grande del intake publico: se migra al StepFlow oficial con revision final y success separado sin romper el pipeline legacy.
- Sprint 7 deja resuelta la deuda principal de create/edit en presupuestos: ambos flujos quedan guiados por el StepFlow oficial con confirmacion propia y lectura comercial alineada con precios sin IVA.
- Sprint 9A deja resuelta la inconsistencia principal entre listas vivas: clientes, propiedades y leads pasan al mismo patron que ya usaban presupuestos y facturas, sin tocar logica de negocio.
- Sprint 11 deja resuelta la inconsistencia principal de estados y headers en pagos/gastos y clarifica la lectura del cierre fiscal, pero no cambia la orquestacion ni el write path de finanzas.
- Sprint 12 deja resuelta una parte importante de la inconsistencia global de `empty/error/loading/confirmacion`, pero todavia queda deuda de copy y errores inline en formularios profundos.
- Sprint 13 deja resuelta la deuda compartida mas clara de foco visible y minimos tactiles en StepFlow/DS, pero no sustituye una auditoria autenticada completa de teclado y lector de pantalla.
- La nueva fase motion deja resuelta la ausencia de base global de animacion, pero no inicia todavia la adopcion productiva para evitar ruido o riesgo prematuro.
- Motion Phase 1B deja resuelta la auditoria y politica de plugins, pero no aprueba aun su uso masivo en runtime productivo.
- Motion Phase 4 deja resuelta la primera capa real de formularios inteligentes y el recorte visual de Home, pero no justifica una migracion masiva de todos los forms legacy.
- Motion Phase 5 deja resuelto el reset visual de Home y endurece la capa de formularios inteligentes, pero no reabre los write paths ni convierte la portada en workspace operativo largo.

## Priorizacion final

### Prioridad 1

- `UX-009` Facturas
- riesgo residual de numeracion y mismatch asociado

### Prioridad 2

- `UX-002` Dashboard
- `UX-003` Cierre fiscal
- `UX-008` Servicios
- `UX-020` Accesibilidad transversal

### Prioridad 3

- `UX-005` Clientes
- `UX-018` Patron global de listas pendiente en modulos restantes
- `UX-019` Estados globales en formularios profundos
- `UX-021` Motion adoption
- `UX-022` GSAP plugin policy adoption
- `UX-015` Repo hygiene
- `UX-016` Tokens / estilos base
- `UX-017` Shell / navegacion

## Actualizacion 2026-07-07

- `UX-002`, `UX-003` y `UX-009` reciben una pasada nueva de compactacion iPhone.
- La deuda ya no es solo "densidad alta"; ahora queda centrada en QA visual autenticada y ajuste fino de superficies legacy.
- La QA visual autenticada en `390x844` confirma mejora real de `Home`, `Gastos`, `Clientes`, `Propiedades` y `Cierre fiscal`.
- El desborde del header movil compartido y el scroll lateral del StepFlow de factura quedan resueltos en esta pasada.
- La pasada cross-module adicional confirma tambien la correccion del overflow horizontal en `768x1024` y la apertura inmediata de `Registrar cobro`.

## Test Debt Closed - Invoice Fiscal Debug Visibility

- La deuda de `InvoicesPage` ya no es visual sino de test heredado: la suite esperaba `control fiscal` visible en la app normal cuando el producto correcto lo deja solo bajo debug.
- Esa deuda queda cerrada al alinear la cobertura con el comportamiento aprobado sin reabrir el panel en produccion.

## Authenticated QA Recovery Attempt

- La deuda UX restante en facturas y cargas mobile sigue ligada a QA autenticada estable, no a una falta de criterio visual.
- El `2026-07-08` se recupero resolucion del tab autenticado vivo, pero no una navegacion/captura suficientemente estable para cerrar todas las pantallas pedidas.
- La deuda pendiente deja de ser "hacer mas UI" y pasa a ser "recuperar un canal de QA autenticada fiable".

## Harness Update

- El canal de QA autenticada fiable ya tiene una primera infraestructura local reutilizable basada en perfil QA + CDP.
- La deuda restante ya no es ausencia total de harness, sino ejecutar y endurecer esa via con sesiones reales y reportes repetibles.
- La alerta residual `tablet / fiscal_closing / fiscalRealAmountVisible` queda cerrada al corregir el selector estable del bloque fiscal real.
- La deuda principal en `quotes` y `jobs` por ruido con valor `0` queda cerrada en la pasada `2026-07-08`.
- `recurring` mantiene deuda de auditabilidad standalone: el dominio existe, pero no como ruta real de modulo.

## Actualizacion 2026-07-16

- `UX-006` propiedades y `UX-009` facturas reciben un fix tecnico-operativo: la alta embebida de propiedades en factura ya no depende solo del refresh remoto para poblar el selector.
- Queda deuda residual en consumidores legacy que siguen calculando `availableProperties` solo desde props y todavia no incorporan una cola local sincronizada.
- La deuda principal de QA autenticada ya no es "recuperar un baseline roto", sino mantener estable el harness frente a loadings reales y create flows embebidos.
- La recuperacion del `2026-07-16` cierra el baseline otra vez en `360/360` sin revertir el fix funcional de propiedades.
- Detalle del cierre: [QA_BASELINE_RECOVERY_20260716.md](C:/Users/USUARIO/costa-clean-app/docs/QA_BASELINE_RECOVERY_20260716.md)

## End-User Flow Agent - 2026-07-18

- Queda cerrada la ausencia de un canal reusable para abrir y cancelar flows principales como usuario final autenticado sin crear data basura.
- La deuda residual pasa a ser de cobertura y estabilidad por flujo concreto, no de falta total de guardrails dry-run.
- La nueva deuda controlada es endurecer `write-and-clean` por flujo sin ampliar escritura real fuera del registro permitido; invoice, payment, fiscal closing y job siguen fuera del subset write-enabled de este sprint.

## Current-Build Invoice Validation - 2026-07-19

- `invoice-create` sigue como deuda abierta de validacion, no como fix confirmado: produccion reproduce el bloqueo antiguo y local no arranca sin las variables Supabase publicas.
- Se cerro un falso positivo del harness: `QA_APP_URL` ya no puede quedar ignorada por la metadata de auth y la pantalla de error no cuenta como shell autenticado.
- Pendiente: desplegar o configurar localmente la build actual y recuperar dry-run verde en los tres viewports.

## Real Submit QA Debt - 2026-07-19

- Queda corregida en fuente la doble superficie de footer que ocultaba el avance de presupuesto en mobile/tablet; falta validacion autenticada sobre una build desplegada actual.
- Queda corregida en fuente la falta de confirmacion trazable de gasto y la perdida del id retornado; falta validar submit y cleanup en esa misma build.
- La deuda de factura sigue siendo de deploy/sandbox: produccion sirve el comportamiento anterior y local no dispone de variables publicas Supabase.

## Recurring Service Operations - 2026-07-20

- `UX-008` queda reducido en densidad y navegacion contextual: Jobs abre con agenda proxima, estados operativos y un CTA dominante.
- La recurrencia de servicios sigue abierta como deuda de dominio; la app solo tiene automatizacion de facturas y ahora ambas capacidades quedan diferenciadas.
- No se debe cerrar esta deuda creando UI simulada sobre `recurring_invoice_plans`; requiere contrato, sandbox y sprint de persistencia propios.

## Full-Flow Sandbox QA - 2026-07-21

- La deuda ya no es de apertura/cancelacion de flows, sino de evidencia real de persistencia, relaciones y reset en un entorno aislado.
- Factura, cobro y cancelacion siguen sin cobertura de submit real: el sandbox ya tiene schema y seed sintetico revisados, pero carece de reset probado y serie fiscal QA.
- No se debe cerrar esta deuda ampliando allowlists ni simulando success states; requiere infraestructura restaurable y gates financieros separados.
- El repo ya contiene y aplico la baseline QA revisada y el seed determinista. La deuda de infraestructura pasa a snapshot/restore e historial de migraciones, no a fallbacks visuales o datos simulados en los StepFlow.

## QA Schema Applied - 2026-07-21

- La deuda de ausencia de schema QA queda cerrada para las 17 tablas del contrato productivo exportado: visual QA pasa `360/360` y dry-run pasa `588/588` sin crear entidades.
- La deuda siguiente es restaurabilidad, no mas cambios visuales ni apertura de full-submit.
- `recurring_invoice_plans` permanece como deuda de dominio porque no existe en el schema autoritativo; no debe cerrarse con UI simulada ni una tabla inventada.
- El harness conserva una deuda tecnica menor: el autodetector CDP no reutilizo la sesion sandbox sana en el primer intento, aunque el endpoint existente permitio completar toda la evidencia.

## Deterministic QA Seed - 2026-07-21

- La deuda de pantallas vacias queda cerrada con 15 filas ficticias y relaciones navegables bajo `QA_DEMO_20260721`.
- La QA post-seed mantiene `360/360` visual y `588/588` dry-run; no se necesita UI simulada para demostrar clientes, inmuebles, presupuestos, servicios y gasto.
- `recurring_invoice_plans`, facturas, cobros y cierres permanecen deliberadamente vacios; su ausencia no debe maquillarse con fixtures fuera de contrato.
- La deuda operativa real es demostrar snapshot/restore antes de permitir write-and-clean.
