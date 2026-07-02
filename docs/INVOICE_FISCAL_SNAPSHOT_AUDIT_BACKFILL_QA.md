# Invoice Fiscal Snapshot Audit Backfill QA

## Fecha

- 2026-07-02

## Objetivo

- Auditar por que las facturas historicas no llevaban snapshot fiscal estructurado.
- Garantizar que el PDF y la emision futura lean siempre un snapshot estable.
- Exponer control visible para detectar, reparar y resolver bloqueos fiscales.

## Diagnostico real

- `src/features/invoices/InvoiceDocumentA4.tsx` ya leia bien el snapshot cuando existia.
- El problema real estaba en la cobertura historica:
  - muchas facturas antiguas no tenian `pricing_metadata.client_fiscal_snapshot`
  - un borrador podia necesitar guardarse aunque la ficha fiscal del cliente siguiera incompleta
  - emitir una factura debia seguir bloqueado sin `tax_id` o `billing_address`

## Auditoria real en base

- Lectura real ejecutada el 2026-07-02 sobre `invoices` + `clients`.
- Resultado auditado:
  - total facturas: `44`
  - snapshots completos: `0`
  - reparables desde cliente: `42`
  - bloqueadas por cliente incompleto: `2`

## Cambios implementados

- `src/features/clients/clientFiscalData.ts`
  - mantiene el snapshot fiscal normalizado
  - conserva `email` y `source`
- `src/features/invoices/invoiceFiscalSnapshot.ts`
  - valida snapshot
  - clasifica `complete / reparable / incomplete`
  - construye bloqueos compactos
  - expone `shouldShowInvoiceFiscalDebug()`
- `src/features/invoices/invoiceFiscalSnapshotApi.ts`
  - hace backfill autenticado
  - escribe auditoria sobre `pricing_metadata`
- `src/features/invoices/InvoiceCreateFlow.tsx`
  - permite guardar borrador con ficha fiscal incompleta
  - mantiene bloqueo al emitir si faltan datos fiscales
- `src/features/invoices/InvoiceCreateForm.tsx`
  - replica la misma regla
- `src/features/invoices/InvoiceEditFlow.tsx`
  - mantiene la validacion al editar
- `src/features/invoices/InvoiceDetailCard.tsx`
  - avisa si la factura sigue fiscalmente incompleta
- `src/pages/InvoicesPage.tsx`
  - muestra `Control fiscal de facturas`
  - publica conteos `completas / reparables / incompletas`
  - expone `Completar reparables`
  - expone `Revisar incompletas`
  - muestra JSON compacto con `?debugInvoiceFiscal=1`
  - despliega lista compacta de bloqueadas

## Visibilidad del panel

- El panel ya existia en repo.
- La causa mas probable de que el usuario no lo viera fue el desfase de deploy:
  - la build publica observada seguia en `4fa759d`
  - ese deploy no contenia este bloque de trabajo
- La ubicacion final del panel es:
  - debajo de las KPIs superiores
  - antes del control de numeracion
  - visible aunque no haya factura seleccionada

## Acciones del panel

- `Completar reparables`
  - muestra toast loading: `Completando datos fiscales...`
  - ejecuta backfill autenticado
  - muestra toast success con el total reparado
  - si quedan bloqueadas, muestra toast warning separado
- `Revisar incompletas`
  - selecciona una factura bloqueada
  - abre una lista compacta con:
    - `display_code`
    - `invoice_number`
    - cliente
    - motivo fiscal faltante
    - acceso rapido a factura o cliente

## Regla operativa final

- `draft`
  - puede guardarse aunque falten datos fiscales
  - queda visible como fiscalmente incompleta
- `issued`
  - bloquea si falta `tax_id` o `billing_address`
- `pricing_metadata.client_fiscal_snapshot`
  - se usa como fuente congelada para PDF y preview
  - no depende del dato vivo del cliente una vez emitida la factura

## Seguridad del backfill

- Solo toca:
  - `pricing_metadata`
  - `updated_at`
- No toca:
  - numeracion
  - importes
  - lineas
  - estado
  - cobros
- No sobreescribe un snapshot ya completo.
- No inventa datos si el cliente sigue incompleto.

## Tests

- `src/features/invoices/invoiceFiscalSnapshot.test.ts`
  - detecta snapshot completo
  - detecta facturas reparables
  - conserva bloqueadas las incompletas
  - no sobreescribe snapshots completos
  - construye bloqueos compactos
  - activa debug solo con query param
- `src/pages/InvoicesPage.test.tsx`
  - renderiza el panel real
  - muestra `Completar reparables`
  - muestra `Revisar incompletas`
  - enseña JSON solo con `?debugInvoiceFiscal=1`

## Limite real de este QA

- Este documento no afirma que las `42` facturas reparables ya se hayan escrito en base.
- El backfill queda implementado y listo para ejecutarse desde UI autenticada.
- La ejecucion real del backfill debe confirmarse en una sesion autenticada despues del deploy correcto.
