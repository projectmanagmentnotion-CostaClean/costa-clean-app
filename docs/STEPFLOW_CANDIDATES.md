# StepFlow Candidates

## Lectura general

El repo ya tiene una base reutilizable en `src/components/FullscreenStepFlow.tsx`. No parte de cero. El problema actual es que cada flujo grande sigue implementando mucha logica de orquestacion por separado, y algunos flujos step-based aun no usan el mismo motor.

## Decision oficial tomada en Sprint 3

- `src/components/FullscreenStepFlow.tsx` queda reconocido como base oficial unica del sistema StepFlow.
- `src/features/stepflow/` se crea como fachada tipada y punto de entrada estable para futuras migraciones.
- No se crea un segundo motor paralelo.
- `src/features/publicIntake/PublicQuoteRequestForm.tsx` queda migrado en Sprint 6 al motor oficial `FullscreenStepFlow`.

| Flujo | Modulo | Archivos relacionados | Por que necesita StepFlow | Riesgo de migracion | Pasos sugeridos | Sprint recomendado |
| --- | --- | --- | --- | --- | --- | --- |
| Alta publica de presupuesto | Public intake | `src/features/publicIntake/PublicQuoteRequestForm.tsx`, `src/pages/PublicQuoteRequestPage.tsx`, `api/public-quote-request.js`, `src/features/publicIntake/intakePipeline.mjs` | Ya era secuencial y de cara publica. Sprint 6 la migra al StepFlow oficial para unificar progreso, revision y success sin tocar payload ni pipeline. | medio | Completado: migracion visual completa sobre `FullscreenStepFlow`, manteniendo contratos y compatibilidad legacy | Sprint 6 completado |
| Crear presupuesto | Presupuestos | `src/features/quotes/QuoteCreateFlow.tsx`, `QuoteCreateForm.tsx`, `src/pages/QuotesPage.tsx`, `src/features/quotes/QuoteDocumentA4.tsx` | Sprint 7 adapta el flujo ya existente sobre `FullscreenStepFlow` hacia 7 pasos, revision final y success state sin tocar el write path. | medio | Completado: adaptacion progresiva sobre el motor oficial, preservando duplicados, guardado, leads y salida documental | Sprint 7 completado |
| Editar presupuesto | Presupuestos | `src/features/quotes/QuoteEditFlow.tsx`, `src/features/quotes/QuoteDetailCard.tsx`, `src/features/quotes/QuoteDocumentScreen.tsx` | Sprint 7 alinea edit con create para evitar drift entre ambas superficies y mantener la misma lectura StepFlow. | medio | Completado: misma estructura de pasos, review y confirmacion, sin tocar aceptacion ni conversiones | Sprint 7 completado |
| Crear servicio | Servicios | `src/features/jobs/JobCreateFlow.tsx`, `JobCreateForm.tsx` | Flujo operativo largo con relaciones, facturacion y duplicados. | medio | Reusar step contracts comunes para contexto, review, duplicados y guardado | Sprint 10 y 3 |
| Crear factura | Facturas | `src/features/invoices/InvoiceCreateFlow.tsx`, `InvoiceCreateForm.tsx` | Flujo mas sensible de la app. Ya usa StepFlow y en Sprint 8 se decide no reorquestarlo desde el workspace por riesgo de write path, numeracion y fiscalidad. | alto | Mantener el StepFlow actual, pulir solo la superficie del workspace y preparar una futura simplificacion sin tocar `saveInvoiceWithLines` | Sprint 8 parcial y seguimiento posterior |
| Editar factura | Facturas | `src/features/invoices/InvoiceEditFlow.tsx` | Variante sensible del mismo dominio. Sigue ya sobre StepFlow, pero no conviene empujar una migracion nueva del workspace mientras convivan mismatch, snapshot fiscal y cambios administrativos. | alto | Mantener estructura actual, compartir piezas no funcionales solo cuando el dominio este mas desacoplado | Sprint 8 parcial y seguimiento posterior |
| Registrar cobro | Cobros | `src/features/payments/PaymentCreateFlow.tsx`, `PaymentCreateForm.tsx` | Flujo mas corto, pero aun con duplicados, confirmacion y relacion obligatoria con factura. | medio | Reusar shell de progreso, review y confirmacion final | Sprint 11 y 3 |
| Crear gasto | Gastos | `src/features/expenses/ExpenseCreateFlow.tsx`, `ExpenseCreateForm.tsx` | Flujo largo con soporte documental, lectura fiscal y duplicados. | medio | Separar captura, soporte, fiscal review y confirmacion en pasos consistentes | Sprint 11 y 3 |
| Editar gasto | Gastos | `src/features/expenses/ExpenseEditFlow.tsx` | Mismo problema de create: flujo largo con logica propia. | medio | Reusar el mismo contrato de pasos y estados | Sprint 11 y 3 |
| Alta de propiedad | Propiedades | `src/features/properties/PropertyCreateFlow.tsx`, `PropertyCreateForm.tsx` | Ya usa StepFlow y Sprint 9 confirma que la deuda principal no esta en la entrada al flujo, sino en el detalle editable posterior y en su write path directo. | bajo | Mantenerla como referencia de flujo corto y no mezclarla con rediseño del detalle de propiedad | Sprint 9 completado en capa UX de workspace |
| Plan recurrente | Recurrentes | `src/features/recurringInvoices/RecurringInvoicePlanFlow.tsx`, `RecurringInvoicePlanForm.tsx` | Flujo administrativo largo con reglas de emision y plantilla. | medio | Reusar estructura de pasos, review y success, sin tocar RPC | Sprint 11 y 3 |
| Alta de cliente | Clientes | `src/features/clients/ClientCreateForm.tsx`, `ClientBillingDetailsInlineForm.tsx`, `ClientWorkspace.tsx` | Sprint 9 mejora la lectura del workspace, pero el alta sigue repartiendo identidad, contacto y fiscalidad sin secuencia guiada. | medio | Diseñar onboarding por etapas: identidad, contacto, fiscal, relaciones | Sprint posterior separado |
| Lead a cliente a propuesta | Leads / Clientes / Presupuestos | `src/features/leads/LeadDetailCard.tsx`, `src/features/financial/financialWriteApi.ts`, `src/features/quotes/QuoteCreateFlow.tsx` | El handoff existe, pero cruza modulos y puede beneficiarse de un flujo guiado de conversion. | alto | Auditar primero el dominio y luego encapsular handoff en pasos | Sprint posterior separado |
| Snapshot y paquete fiscal | Cierre fiscal | `src/pages/FiscalClosingPage.tsx`, `src/features/closingExports/FiscalPeriodExportSection.tsx` | Ya hay overlays separados, pero no un contrato unico de flujo para guardar, revisar, exportar y cerrar. | medio | Diseñar mini StepFlow de revision documental -> snapshot -> exportacion | Sprint 11 |

## Base ya existente que Sprint 3 debe aprovechar

- `src/components/FullscreenStepFlow.tsx`
- `src/components/ActionFlowOverlay.tsx`
- `src/components/ConfirmDialog.tsx`
- `src/components/DeferredContentFallback.tsx`
- `src/components/NestedFlowSurfaceContext.ts`

## Riesgos de estandarizacion

- No mezclar StepFlow con cambios de negocio.
- No tocar writes RPC, numeracion, auth ni Supabase en el sprint de motor reusable.
- No rehacer todos los flujos a la vez.
- Empezar por un flujo corto y uno medio antes de tocar Facturas.
- Sprint 8 confirma que `InvoicesPage` no debe forzarse aun a un nuevo StepFlow completo: el workspace necesita primero separacion visual segura y menor densidad antes de replantear la orquestacion.
