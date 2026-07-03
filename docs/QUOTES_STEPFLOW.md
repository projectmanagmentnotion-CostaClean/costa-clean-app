# Quotes StepFlow

## Estado anterior

Antes de Sprint 7, presupuestos ya usaba el StepFlow oficial en:

- `src/features/quotes/QuoteCreateFlow.tsx`
- `src/features/quotes/QuoteEditFlow.tsx`

Pero el flujo seguia corto y muy concentrado:

- create: 4 pasos
- edit: 3 pasos

La orquestacion existia, pero quedaban deudas claras:

- pasos demasiado gruesos para decisiones comerciales distintas
- sin success state propio util tras crear o editar
- salida poco guiada hacia detalle o documento
- lectura economica contradictoria con la nota existente `Los precios indicados no incluyen IVA.`

## Archivos auditados

- `src/pages/QuotesPage.tsx`
- `src/features/quotes/QuoteCreateFlow.tsx`
- `src/features/quotes/QuoteEditFlow.tsx`
- `src/features/quotes/QuoteDetailCard.tsx`
- `src/features/quotes/QuotesList.tsx`
- `src/features/quotes/QuoteDocumentScreen.tsx`
- `src/features/quotes/QuoteDocumentA4.tsx`
- `src/features/quotes/QuoteDocumentPreview.tsx`
- `src/features/quotes/quoteAcceptanceWorkflow.ts`
- `src/features/quotes/quoteCreatePrefill.ts`
- `src/features/quotes/useQuoteDocumentLines.ts`
- `src/features/shared/quoteBillingDrafts.ts`
- `src/features/financial/financialWriteApi.ts` solo para auditoria del write path

## Campos preservados

En create/edit se preservan los mismos campos funcionales:

- `client_id`
- `lead_id` cuando ya existe en edicion
- `property_id`
- `status`
- `notes`
- lineas con:
  - `concept`
  - `quantity`
  - `unit`
  - `unit_price`
  - `line_subtotal`
- totales persistidos:
  - `subtotal`
  - `tax_amount`
  - `total`
- metadatos ya existentes como `internal_notes` y `pricing_metadata` en edicion

## Pasos finales

### Create

1. Cliente o lead
2. Tipo de servicio
3. Inmueble
4. Condiciones
5. Estimacion
6. Revision final
7. Confirmacion

### Edit

1. Cliente o lead
2. Tipo de servicio
3. Inmueble
4. Condiciones
5. Estimacion
6. Revision final
7. Confirmacion

## Decision tecnica

Decision tomada: **adaptacion progresiva sobre el StepFlow oficial ya existente**.

No se ha creado otro motor ni otro wrapper paralelo.

Motivo:

- presupuestos ya dependia de `FullscreenStepFlow`
- el riesgo no estaba en el shell del flujo, sino en su orquestacion y en su handoff con detalle/documento
- el write path sigue sensible por `saveQuoteWithLines` y `acceptQuoteWorkflow`
- una migracion total de dominio no era necesaria para cumplir el sprint

## Logica preservada

Se mantiene intacto:

- `saveQuoteWithLines`
- chequeo de duplicados
- `acceptQuoteOnly`
- `acceptQuoteAndCreateInvoice`
- conversion lead -> cliente al aceptar
- relacion presupuesto -> servicio
- relacion presupuesto -> factura
- lectura de lineas con `useQuoteDocumentLines`
- apertura manual de documento/PDF
- no envio automatico de emails o WhatsApps

Tambien se mantiene el contrato de persistencia con:

- `subtotal`
- `tax_amount`
- `total`

Sprint 7 no cambia RPC ni contratos de base de datos.

## Cambios UX realizados

- create/edit se reorganizan en 7 pasos reales con una sola decision dominante por paso
- se separa alcance base de estimacion economica
- se anade revision final obligatoria antes de guardar
- se anade success state util con salida a detalle o documento
- se eliminan multiples consecuencias primarias simultaneas dentro del flujo
- se mejora mobile-first con pasos mas cortos, CTA claras y footer sticky
- se alinea la lectura comercial de presupuestos con `precios sin IVA` en flujo, detalle, lista y documento
- el IVA queda como referencia visible, no como total comercial dominante, cuando la regla del negocio asi lo marca

## Que no se toco

- auth
- rutas
- sistema `?view=`
- Supabase contracts
- `appDataApi`
- `financialWriteApi`
- facturas
- numeracion de facturas
- servicios
- finanzas
- envio automatico de documentos o mensajes

## Riesgos pendientes

- el write path sigue siendo sensible por su relacion con leads, clientes, servicio y factura
- el contrato persistido aun conserva `tax_amount` y `total`, aunque la capa comercial visible ya prioriza precios sin IVA
- la aceptacion comercial y la conversion a factura siguen fuera de este flujo y viven en el workspace/detalle
- no existe aun una accion propia de “preparar mensaje” dentro del StepFlow; sigue siendo un paso posterior del workspace si aplica
