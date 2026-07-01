# Entity Creation Flows Audit Fix QA

## Bugs reportados

- Los servicios con varias lineas podian terminar resumidos en una sola referencia operativa.
- El alta de servicios en el flow principal no persistia `job_lines` con la misma ruta que el resto de escrituras.
- Varias rutas de factura desde presupuesto o resincronizacion desde servicio reconstruian una sola linea desde `subtotal` o la primera linea disponible.
- Los descartes de duplicados se guardaban por grupo completo; si el grupo cambiaba, el mismo par reaparecia.
- No existian acciones seguras de "crear como esta" para reutilizar estructura sin copiar estados finales.
- El snapshot fiscal de factura no guardaba marca temporal propia del momento de emision.

## Causas reales encontradas

1. `src/features/jobs/JobCreateFlow.tsx` seguia haciendo `POST` directo a `jobs` en vez de usar `save_job_with_lines`.
2. `src/features/invoices/InvoiceCreateFlow.tsx`, `InvoiceCreateForm.tsx`, `InvoiceEditFlow.tsx` e `InvoiceDetailCard.tsx` tenian adapters locales que, al caer en presupuesto, fabricaban una sola linea desde `subtotal` o la primera linea del presupuesto.
3. `src/features/jobs/jobCreatePrefill.ts` solo copiaba el primer concepto del presupuesto, no la lista completa de lineas.
4. `src/features/duplicates/duplicateResolution.ts` persistia una clave basada en todo el grupo; al variar el conjunto de registros o razones, el descarte previo dejaba de coincidir.
5. Faltaban builders de prefill para duplicar factura, presupuesto, gasto y servicio sin reutilizar ids, estados finales ni snapshots antiguos.

## Archivos auditados

- `src/app/appDataApi.ts`
- `src/app/entitySchemas.ts`
- `src/app/relationships.ts`
- `src/features/jobs/jobWriteApi.ts`
- `src/features/jobs/jobBilling.ts`
- `src/features/jobs/JobCreateForm.tsx`
- `src/features/jobs/JobCreateFlow.tsx`
- `src/features/jobs/JobDetailCard.tsx`
- `src/features/jobs/JobWorkspace.tsx`
- `src/features/invoices/InvoiceCreateForm.tsx`
- `src/features/invoices/InvoiceCreateFlow.tsx`
- `src/features/invoices/InvoiceEditFlow.tsx`
- `src/features/invoices/InvoiceDetailCard.tsx`
- `src/features/invoices/invoiceCreatePrefill.ts`
- `src/features/quotes/QuoteCreateFlow.tsx`
- `src/features/quotes/QuoteDetailCard.tsx`
- `src/features/quotes/quoteLineUtils.ts`
- `src/features/duplicates/duplicateResolution.ts`
- `src/features/clients/clientFiscalData.ts`
- `src/features/expenses/ExpenseCreateFlow.tsx`
- `src/features/expenses/ExpenseDetailCard.tsx`
- `src/pages/JobsPage.tsx`
- `src/pages/InvoicesPage.tsx`
- `src/pages/QuotesPage.tsx`
- `src/pages/ExpensesPage.tsx`

## Archivos modificados

- Servicios, facturas, presupuestos y gastos: flows, cards y pages listados arriba.
- Nuevos helpers: `src/features/shared/quoteBillingDrafts.ts`, `src/features/invoices/invoiceDuplicatePrefill.ts`, `src/features/quotes/quoteCreatePrefill.ts`, `src/features/expenses/expenseCreatePrefill.ts`.
- Nuevos tests: `src/features/shared/quoteBillingDrafts.test.ts`, `src/features/duplicates/duplicateResolution.test.ts`, `src/features/entityCreationPrefills.test.ts`.

## Como se arreglaron servicios y lineas

- `JobCreateFlow` ahora usa `saveJobWithLines` igual que `JobCreateForm` y `JobDetailCard`, de modo que servicio y `job_lines` se guardan por la misma RPC.
- Los prefills de servicio desde presupuesto y desde servicio ahora copian todas las lineas reales, no solo el primer concepto.
- Los formularios de servicio reutilizan las lineas del presupuesto completo cuando el origen es un presupuesto.

## Como se arreglaron facturas y snapshot fiscal

- Las rutas de factura desde servicio/presupuesto/detail/edit ahora consumen listas de lineas completas mediante `getBillingDraftLinesFromQuote`.
- Se eliminó la reconstruccion de una sola linea desde `subtotal` cuando el presupuesto ya tiene detalle persistido.
- El snapshot fiscal de cliente mantiene la estructura previa y ahora añade `captured_at` para fijar el momento de emision.
- Las acciones "crear factura como esta" abren un formulario nuevo en modo manual y fuerzan snapshot fiscal nuevo al guardar.

## Como se revisaron presupuestos

- Se añadió prefill de "crear presupuesto como este" copiando cliente, propiedad, notas y lineas completas.
- `QuoteCreateFlow` acepta prefills y siempre arranca en `draft`, sin copiar estados finales.

## Como se revisaron gastos

- Se añadió prefill de "crear gasto como este" copiando proveedor, categoria, descripcion e importes.
- El nuevo gasto no copia adjuntos ni soporte previo; arranca con soporte `missing`, revision fiscal `pending` y riesgo `medium`.

## Como se arreglaron duplicados

- La persistencia de resoluciones ahora se guarda por par estable `entityType + idA + idB + reasonCodes`.
- Ignorar o revisar un grupo marca todos sus pares actuales; si el grupo se recompone, los pares ya descartados siguen ocultos.

## Como queda memoria y sugerencias

- Las sugerencias siguen siendo opt-in; no se añadió ninguna sobreescritura automatica de texto manual.
- Los nuevos adapters solo leen lineas historicas reales y no fusionan conceptos durante el prefill.

## Como funciona "crear como esta"

- Factura: desde detalle de factura, abre una nueva factura prellenada sin `job_id`, `quote_id`, numero ni snapshot viejo.
- Presupuesto: desde detalle de presupuesto, abre una nueva propuesta en `draft` con lineas completas.
- Gasto: desde detalle de gasto, abre alta nueva sin adjuntos ni estados fiscales definitivos.
- Servicio: desde detalle/workspace de servicio, abre alta nueva con cliente, propiedad, tipo y lineas completas, pero sin ids ni estados finales heredados.

## Tests añadidos

- Preservacion de lineas completas desde presupuesto hacia drafts de facturacion.
- Generacion estable de claves de resolucion de duplicados por par.
- Prefills de duplicado para factura, presupuesto, gasto y servicio.

## QA manual y limitaciones

- QA automatizada completada con `npm run lint`, `npm run test` y `npm run build`.
- No se ejecutó QA manual en navegador dentro de este turno.
- La migracion SQL de `job_lines` sigue siendo un requisito externo: si una base no tiene `save_job_with_lines` o `job_lines`, la persistencia real seguira bloqueada fuera del repo.

## Pendientes reales

- Verificar en entorno con base actualizada los flujos manuales: servicio multi-linea -> refresco -> factura, presupuesto multi-linea -> conversion, duplicado descartado -> refresco.
- Si existe algun create path de factura fuera de `InvoiceCreateForm`, `InvoiceCreateFlow`, `InvoiceEditFlow` o `InvoiceDetailCard`, revisar que use los mismos helpers nuevos.
- Resultado DB relacionado: ver `docs/SUPABASE_JOB_LINES_RPC_QA.md`. A fecha 2026-07-01 la base real ya responde con tabla `job_lines` y RPC `save_job_with_lines`, pero la prueba de escritura autenticada con 3 lineas siguio pendiente desde terminal por falta de credenciales de sesion reutilizables y acceso SQL directo.
