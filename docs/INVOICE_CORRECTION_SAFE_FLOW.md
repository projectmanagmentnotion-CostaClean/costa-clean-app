# Invoice Correction Safe Flow

## Problema

La factura emitida `2026-045` necesita corregir una linea sin tocar la base de datos directamente, sin romper numeracion y sin reutilizar la edicion mayor de emitidas como si fuera una rectificativa real.

## Factura 2026-045

- cliente: `FUSTERIA PINEDA MAR SL`
- estado: `Emitida`
- linea afectada: `limpieza de taller`

## Valores actuales

- cantidad actual: `1 hora`
- base visible: `234,00 EUR`
- IVA visible: `49,14 EUR`
- total visible: `283,14 EUR`

## Valores corregidos

- cantidad correcta: `6 horas`
- nueva base esperada: `324,00 EUR`
- nuevo IVA esperado: `68,04 EUR`
- nuevo total esperado: `392,04 EUR`

## Diferencia

- diferencia de horas: `+5`
- diferencia base: `+90,00 EUR`
- diferencia IVA 21%: `+18,90 EUR`
- diferencia total: `+108,90 EUR`

## Archivos auditados

- `src/features/invoices/InvoiceDetailCard.tsx`
- `src/features/invoices/InvoiceEditFlow.tsx`
- `src/features/invoices/InvoiceCreateFlow.tsx`
- `src/features/invoices/InvoiceDocumentScreen.tsx`
- `src/features/invoices/InvoiceDocumentPreview.tsx`
- `src/features/invoices/invoiceDuplicatePrefill.ts`
- `src/pages/InvoicesPage.tsx`

## Decision tecnica

La app sigue sin exponer una rectificativa real, pero ahora hay dos superficies diferenciadas:

- `InvoiceCreateFlow` con `prefill` para borrador guiado
- `InvoiceEditFlow` para correccion interna de una emitida no enviada

La decision actual para la `2026-045` es:

- mantener el borrador guiado como alternativa trazable
- habilitar la correccion interna del mismo registro solo cuando el usuario confirma que la factura no fue enviada ni exportada

## Que permite la app ahora

- detectar la correccion conocida de la `2026-045`
- mostrar comparativa actual / corregido / diferencia dentro del detalle
- copiar un resumen operativo al portapapeles
- abrir una edicion mayor con correccion interna del mismo registro
- abrir un borrador guiado con:
  - mismo cliente
  - misma propiedad si existe
  - lineas precargadas
  - `limpieza de taller` ya ajustada a `6 horas`
  - nota visible de correccion guiada

## Que queda pendiente

- flujo real de rectificativa
- politica funcional que diferencie correccion administrativa simple vs rectificativa obligatoria
- sesion o credencial autorizada para aplicar el write real desde Codex

## Que no se toco

- Supabase
- SQL
- RPC
- migrations
- `appDataApi`
- `financialWriteApi`
- `invoice_number`
- `display_code`
- `save_invoice_with_lines`
- `save_invoice_with_lines_v2`
- numeracion
- fiscalidad global
- calculos globales
- contratos de datos
- reglas de negocio

## Riesgos pendientes

- el borrador guiado no sustituye una rectificativa real si el criterio fiscal la exige
- el write path financiero sigue bloqueado sin autenticacion
- la app sigue permitiendo edicion mayor de emitidas; este sprint anade una alternativa mas segura, no una prohibicion funcional total

## Proximos pasos

1. validar con criterio fiscal si la `2026-045` debe resolverse como rectificativa
2. si procede, confirmar el borrador guiado desde `InvoiceCreateFlow`
3. abrir sprint separado si se quiere soporte explicito de rectificativas
