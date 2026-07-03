# Invoices Safe UX Polish

## Objetivo del sprint

Mejorar la lectura y la jerarquia del workspace de facturas sin tocar ninguna logica critica de emision, numeracion, fiscalidad, totales o persistencia.

## Archivos auditados

- `src/pages/InvoicesPage.tsx`
- `src/features/invoices/InvoiceDetailCard.tsx`
- `src/features/invoices/InvoicesList.tsx`
- `src/features/invoices/InvoiceCreateFlow.tsx`
- `src/features/invoices/InvoiceEditFlow.tsx`
- `src/features/invoices/InvoiceDocumentScreen.tsx`
- `src/features/invoices/InvoiceNumberingControlCard.tsx`
- `src/features/financial/financialWriteApi.ts` solo para confirmar zonas no tocables

## Acciones sensibles mapeadas

- Crear factura:
  - `src/pages/InvoicesPage.tsx`
  - `src/features/invoices/InvoiceCreateFlow.tsx`
- Editar factura:
  - `src/pages/InvoicesPage.tsx`
  - `src/features/invoices/InvoiceEditFlow.tsx`
  - `src/features/invoices/InvoiceDetailCard.tsx`
- Emitir / cambiar estado administrativo:
  - `src/features/invoices/InvoiceDetailCard.tsx`
  - write path en `src/features/financial/financialWriteApi.ts`
- Cobrar / registrar cobro:
  - `src/features/invoices/InvoiceDetailCard.tsx`
  - `src/features/payments/PaymentCreateFlow.tsx`
- Generar / abrir documento:
  - `src/features/invoices/InvoiceDocumentScreen.tsx`
  - `src/features/invoices/InvoiceDetailCard.tsx`
- Acciones bulk:
  - `src/pages/InvoicesPage.tsx`
- Numeracion:
  - `src/features/invoices/invoiceNumbering.ts`
  - `src/features/invoices/InvoiceNumberingControlCard.tsx`
- Fiscal / mismatch:
  - `src/features/invoices/invoiceFiscalSnapshot.ts`
  - `src/features/invoices/invoiceFiscalSnapshotApi.ts`
  - `src/features/invoices/InvoiceDetailCard.tsx`

## Decision tecnica

Decision tomada: **StepFlow pospuesto para el workspace de facturas**.

Motivo:

- `InvoiceCreateFlow` y `InvoiceEditFlow` ya son flujos sensibles y dependen de numeracion, snapshots fiscales, mismatch handling y `saveInvoiceWithLines`.
- Forzar una nueva migracion del workspace completo a `FullscreenStepFlow` en este sprint elevaria demasiado el riesgo operativo.
- El objetivo seguro era ordenar la superficie de trabajo, no tocar el write path ni reorquestar emision.

Resultado:

- Se mantiene el StepFlow existente donde ya vive.
- No se crea un segundo motor.
- No se migra `InvoicesPage` a un StepFlow nuevo.
- Se deja el workspace preparado para una migracion futura solo si se separa antes la logica sensible.

## Cambios UX aplicados

- Se separa visualmente el control diario de cobro del control fiscal y numeracion en `InvoicesPage`.
- El bloque fiscal queda agrupado como soporte operativo, no como competidor del CTA principal.
- El detalle de factura se reparte en tres capas:
  - cobro y conciliacion
  - documento y gestion
  - contexto de factura
- `Abrir documento` deja de competir como accion primaria cuando la factura aun tiene cobro pendiente.
- Se reduce la mezcla visual entre cobro, relaciones, estado administrativo y contexto fiscal.
- Se mantiene visible la informacion de mismatch, snapshots fiscales incompletos y bloqueos reales.

## Que no se toco

- Supabase
- SQL
- RPC
- migrations
- auth
- rutas
- sistema `?view=`
- `src/app/appDataApi.ts`
- `src/features/financial/financialWriteApi.ts`
- `invoice_number`
- `display_code`
- `save_invoice_with_lines`
- `save_invoice_with_lines_v2`
- logica de numeracion
- logica fiscal
- calculo de totales
- persistencia
- validaciones
- autoemision
- autoenvio

## Riesgos pendientes

- El workspace sigue siendo denso por la convivencia de listado, detalle, bulk actions, documento y overlays sensibles.
- Create/edit siguen teniendo mucha orquestacion propia aunque ya usen StepFlow.
- Numeracion y mismatch siguen siendo un dominio de alto riesgo y requieren sprint separado si se quiere simplificar mas.
- Las acciones bulk siguen vivas en la misma pagina y merecen una auditoria propia si vuelven a crecer.

## Siguiente paso recomendado

Antes de cualquier migracion nueva de StepFlow en facturas:

1. aislar mejor contratos visuales vs contratos de write path
2. estabilizar create/edit con componentes compartidos no funcionales
3. decidir si bulk/documento viven dentro o fuera del workspace principal
