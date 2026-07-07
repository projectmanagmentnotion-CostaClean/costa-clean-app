# Risk Map

| Area | Riesgo | Severidad | Archivos sensibles | Que no tocar sin permiso explicito | Mitigacion recomendada |
| --- | --- | --- | --- | --- | --- |
| Supabase read layer | `appDataApi` ya usa fallbacks por drift de esquema y compatibilidad legacy. Cambios superficiales pueden ocultar problemas reales de despliegue. | alta | `src/app/appDataApi.ts`, `src/lib/supabaseRest.ts`, `src/lib/supabase.ts`, `src/app/dataHealth.ts` | Queries REST, rutas de lectura, manejo de errores, fallback de columnas, cliente Supabase | Mantener auditoria separada de cualquier rediseño; validar siempre contra schema real antes de tocar lecturas |
| Auth | Bootstrap y sesion viven en `App.tsx` + `supabase.ts`; el acceso publico aislado depende de ese orden exacto. | alta | `src/App.tsx`, `src/features/auth/AuthPage.tsx`, `src/lib/supabase.ts`, `src/app/publicStandaloneRoutes.ts` | Orden de bootstrap, manejo de sesion, paths publicos, guardas previas al shell | No tocar en sprints visuales; cualquier cambio requiere sprint propio de acceso |
| Facturas | Sprint 8 mejora la jerarquia visual del workspace, pero la zona sigue siendo critica: conviven cobro, emision, numeracion, control fiscal, documento y acciones bulk sobre el mismo dominio sensible. | critica | `src/pages/InvoicesPage.tsx`, `src/features/invoices/*`, `src/features/financial/financialWriteApi.ts` | Writes de factura, detalle, sync de pagos, control fiscal, bulk actions, migracion nueva de StepFlow sobre el workspace | Mantener los cambios en capa visual solamente; cualquier simplificacion mayor requiere pruebas dedicadas y aislamiento previo del write path |
| Numeracion de facturas | Historial reciente de endurecimiento SQL y regularizaciones. El cliente ya valida mismatch, pero la integridad final depende de DB y RPC. | critica | `src/features/invoices/invoiceNumbering.ts`, `src/features/invoices/invoiceWriteTrace.ts`, `src/features/financial/financialWriteApi.ts`, `sql/20260702_*invoice*` | RPC de guardado, triggers/SQL de numeracion, display code, invoice number, metadata esperada | No tocar sin sprint especifico de numeracion y validacion DB |
| Presupuestos | Sprint 7 moderniza create/edit y la lectura documental sobre el StepFlow oficial, pero conversion comercial y handoff a servicios/facturas siguen cruzando varios modulos y prefills sensibles. | alta | `src/pages/QuotesPage.tsx`, `src/features/quotes/*`, `src/features/financial/financialWriteApi.ts`, `src/features/jobs/jobCreatePrefill.ts` | Reglas de aceptacion, conversion, prefills, save path, salida documental y lectura comercial de importes | Mantener la capa visual y documental separada del dominio; no tocar aceptacion, conversion ni write path sin sprint dedicado |
| Clientes | Alta, datos fiscales, recurrentes y workspace confluyen en un solo dominio con relaciones amplias. | alta | `src/pages/ClientsPage.tsx`, `src/features/clients/*`, `src/features/recurringInvoices/*` | Escrituras fiscales, fusion de clientes, navegacion de workspace, planes recurrentes | Tratar onboarding y workspace por separado, conservando `clientWriteApi` |
| Propiedades | El workspace mejora en Sprint 9, pero `PropertyDetailCard.tsx` sigue editando via REST/RPC directo y mezcla riesgo visual con riesgo de persistencia relacional. | alta | `src/pages/PropertiesPage.tsx`, `src/features/properties/PropertyWorkspace.tsx`, `src/features/properties/PropertyDetailCard.tsx` | Reasignacion de cliente, PATCH directo de propiedad, cualquier cambio de write path o de contratos del detalle editable | Mantener cambios en portada/workspace no persistente; no rediseñar el write path de propiedad sin sprint especifico de hardening |
| Servicios | El dominio ya usa `job_lines` y fallback legacy. Sprint 10 mejora solo la jerarquia visual, pero el detalle editable y la base de cobro siguen sensibles: cambios ingenuos pueden romper lectura, billing summary o permisos. | alta | `src/features/jobs/*`, `src/app/appDataApi.ts`, `sql/20260629_create_job_lines_and_save_job_with_lines.sql`, `sql/20260701_*job_lines*` | `job_lines`, `jobWriteApi`, billing lines, fallback legacy, permisos de lectura, edicion profunda del servicio | No tocar sin revalidar DB y RLS; mantener el alta sobre StepFlow oficial y separar UX de persistence model |
| Finanzas | Cobros, gastos, cierre fiscal e inteligencia fiscal se encadenan. Sprint 11 pule solo la jerarquia visual y los estados base; el riesgo sigue siendo malinterpretar estados no definitivos o tocar write paths sensibles al intentar simplificar mas. | alta | `src/features/payments/*`, `src/features/expenses/*`, `src/pages/FiscalClosingPage.tsx`, `src/features/closing/*`, `src/features/financial/financialWriteApi.ts` | Estados financieros derivados, exportacion fiscal, etiquetas de verdad contable, IA fiscal, write paths de cobro/gasto | Mantener lenguaje prudente y pruebas de no regresion; no vender certeza que el sistema no garantiza ni mezclar UX con cambios de persistencia |
| Formularios publicos / intake | Sprint 6 migra la capa visual al `FullscreenStepFlow` oficial, pero el intake sigue siendo publico y conectado a un pipeline legacy + `lead_drafts`. Cambios de forma o validacion pueden afectar captacion, normalizacion o compatibilidad de importacion. | alta | `src/pages/PublicQuoteRequestPage.tsx`, `src/features/publicIntake/*`, `api/public-quote-request.js`, `api/tools/imports/*` | Payload normalizado, validacion, mapping de Google Forms, pipeline de borradores, contratos de `lead_drafts` | Mantener futuras mejoras en la capa visual o en validacion por sprint separado; no tocar pipeline ni compatibilidad CSV/Google Forms sin auditoria especifica |
| Sistema global de listas | Sprint 9A centraliza busqueda/filtros/orden en una capa compartida. El riesgo no es de persistencia, sino de introducir divergencia otra vez si modulos futuros crean controles ad hoc fuera de `DSListControlBar` o `ListToolbar`. | media | `src/design-system/components/DSListControlBar.tsx`, `src/components/ListToolbar.tsx`, `src/features/lists/*` | Filtros backend, cambios de contratos, toolbars paralelas, persistencia de negocio disfrazada de preferencia local | Mantener esta capa como patron unico y limitarla a estado local; cualquier filtro con impacto de negocio debe ir a sprint propio |
| Motion / GSAP | Una adopcion descontrolada de motion puede degradar accesibilidad, rendimiento o claridad del dato, especialmente en modulos densos o criticos. | media | `src/design-system/motion/*`, `src/design-system/index.ts`, futuros componentes que adopten GSAP | Imports directos de `gsap` en negocio, timelines largas, `ScrollTrigger` global, stagger masivo, motion sobre importes, warnings o estados fiscales | Encapsular GSAP en la capa motion, respetar reduced motion, exigir cleanup y adoptar por fases desde primitives seguras |
| Smart suggestions locales | Sugerencias de CP/city o conceptos mal gobernadas pueden introducir falsa confianza, autocompletados incorrectos o persistencia silenciosa de valores no revisados. | media | `src/design-system/components/DSSmartPostalCodeInput.tsx`, `src/design-system/components/DSConceptAutocomplete.tsx`, `src/features/concepts/useRecentConceptSuggestions.ts`, `src/features/locations/postalCodeSuggestions.ts` | Autocompletado automatico no confirmado, ampliacion sin auditoria del dataset local, guardado de valores sensibles en memoria local | Mantener sugerencias como ayuda opt-in, filtrar valores sensibles, ampliar dataset solo con evidencia operativa y no mezclarlo con reglas de validacion o persistencia |
| Accesibilidad / responsive QA | Parte del shell autenticado y varios workspaces solo pudieron auditarse por codigo en este sprint porque la verificacion visual completa requiere sesion real y no se podia tocar auth. | media | `src/app/AppShell.tsx`, `src/app/AppNav.tsx`, `src/pages/*`, `src/features/*`, `src/design-system/components/*` | Auth, accesos de sesion, atajos de QA que alteren el runtime, cambios funcionales encubiertos como polish visual | Mantener el hardening en primitives compartidas y programar una pasada autenticada especifica de teclado/lector de pantalla antes del cierre final del roadmap |
| Alertas y dashboard | Mucha decision operativa depende de agregados y quick actions centralizados. Un rediseño superficial puede degradar prioridad real. | media | `src/pages/HomePage.tsx`, `src/pages/AlertsCenterPage.tsx`, `src/features/dashboard/*`, `src/features/automation/*` | Mapeo de incidentes, quick views, alert presentation, actions cross-module | Partir del criterio actual y compactar, no reimaginar sin auditoria |
| Shell central | `AppShell.tsx` concentra wiring, prefills, filtros, alertas y navegacion. Cualquier toque tiene radio de impacto amplio y el shell sigue dependiendo de aliases visuales (`fiscal_closing` frente a `annual_closing` y `quarterly_closing`) sobre `?view=`. | alta | `src/app/AppShell.tsx`, `src/app/useShellNavigation.ts`, `src/app/AppShellViewRenderer.tsx`, `src/app/AppNav.tsx`, `src/app/navigation.ts` | Orquestacion cross-module, prefills, filtros, guardas de navegacion, cambio del mecanismo `?view=` o de aliases vivos | Reducir presion sobre este archivo via patrones visuales y documentacion; cualquier refactor del router interno requiere sprint tecnico separado |
| Legacy views y backups | Hay paginas legacy no montadas y backups `.bak-*` en `src/pages/`. | media | `src/pages/AnnualClosingPage.tsx`, `src/pages/QuarterlyClosingPage.tsx`, `src/pages/*.bak-*` | Borrar o mover sin auditoria, tocar archivo equivocado por confusion | Registrar y tratar en sprint tecnico de higiene, separado del rediseño |

## Riesgos nuevos de Motion Phase 2

- `Home` ya usa charts SVG y reveals sutiles; cualquier extension futura debe mantener dato real, CTA clara y fallback seguro sin convertir Inicio en una landing decorativa.
- `ScrollTrigger` queda limitado a reveals `once` del dashboard; no debe expandirse a listas densas, shell global ni dominios criticos sin sprint separado.

## Riesgos nuevos de Motion Phase 3

- `FullscreenStepFlow` ya admite transicion GSAP compartida; cualquier ampliacion futura debe seguir animando la superficie y no los campos de formulario de forma individual o repetitiva.
- `ActionFlowOverlay` y `ConfirmDialog` ya tienen entrada comun; no deben recibir timelines mas largas ni cierres retrasados que bloqueen la accion del usuario.
- La compactacion de copy no puede suavizar warnings fiscales, mismatch o estados bloqueados en facturas.

## Riesgos nuevos de Motion Phase 4

- `Home` ya es mas visual y compacto; cualquier ampliacion futura debe seguir el criterio de una sola decision clara y no reintroducir bloques densos o charts decorativos.
- Las sugerencias locales de formularios son una ayuda de velocidad, no una fuente autoritativa de datos ni un sustituto de validacion de negocio.

## Riesgos nuevos de Motion Phase 5

- el acknowledgement local de alertas solo reduce ruido en `Home`; no debe confundirse con un workflow real de resolucion o revision
- el cliente sigue guardando `billing_address` como string unico; la separacion visual de ubicacion no debe interpretarse como cambio de modelo

## Riesgos nuevos de One-Line Filters + Invoice 2026-045

- el patron `one-line filters` depende de que cada modulo ordene bien su primer grupo de filtros; una mala configuracion puede hacer que los chips rapidos no sean los mas utiles
- `AnnualClosingPage` y `QuarterlyClosingPage` mantienen filtros legacy fuera de `ListToolbar`; no asumir homogeneidad total en todo el repo
- la 2026-045 sigue pendiente porque no existe soporte explicito de rectificativa; usar la edicion mayor de una emitida sin validacion fiscal puede ser un riesgo operativo real

## Riesgos nuevos de Invoice 2026-045 Safe Correction Flow

- el borrador guiado reutiliza `InvoiceCreateFlow`, pero no certifica por si solo que el cierre fiscal correcto no requiera rectificativa
- la card de correccion esta acotada al caso auditado `2026-045`; si aparecen mas casos, conviene mover la configuracion a un registro controlado y no replicar logica ad hoc
- la correccion interna del mismo registro ya tiene rama UI separada, pero el write real sigue dependiendo de sesion o credencial autorizada; sin eso no hay aplicacion efectiva

## Riesgos nuevos de Same-Number RPC Update Fix

- la migracion nueva protege el caso de update con mismo numero en la misma anualidad, pero si se ampliara sin criterio podria relajar de forma accidental la emision de facturas nuevas
- el repo ya tiene la migracion creada, pero mientras no se aplique en Supabase real la factura `2026-045` sigue parcial y no debe enviarse
- el fallback directo por sesion autenticada sigue sin permiso para actualizar `public.invoices`; incluso con el bug de hueco resuelto, una base real con policies distintas puede requerir una via de servidor autorizada

## Riesgos especiales que merecen sprint separado

- Numeracion de facturas
- Hardening Supabase / RLS / RPC
- Cualquier write path de facturas
- Cualquier cambio de auth
- Cualquier cambio que mezcle UX con regularizaciones SQL

## Lectura final de cierre

- La base UX del roadmap queda cerrada.
- El riesgo principal ya no es visual; es tecnico-operativo en dominios sensibles.
- La siguiente fase no debe reabrir un rediseño general, sino atacar riesgos concretos con pruebas y alcance aislado.
