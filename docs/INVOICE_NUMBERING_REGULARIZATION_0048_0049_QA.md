# Invoice Numbering Regularization 0048 0049 QA

## Fecha

- 2026-07-02

## Confirmacion del usuario

- El usuario confirmo que:
  - `INV-0048 / 2026-048`
  - `INV-0049 / 2026-049`
- fueron creadas por el, pero todavia no se enviaron al cliente.

## Auditoria previa verificada

Lectura real desde Supabase visible para la app:

- `INV-0043 / 2026-043`: no existe
- `INV-0044 / 2026-044`: no existe
- `INV-0048 / 2026-048`: existe
- `INV-0049 / 2026-049`: existe
- `deleted_at`: null en `0048` y `0049`
- `archived_at`: null en `0048` y `0049`
- `cancelled_at`: null en `0048` y `0049`
- `pricing_metadata`: `{}` en ambas

## Campos reales que afectan numeracion y documento

- Lista / cards:
  - `display_code`
  - `invoice_number`
- Documento / preview / PDF:
  - `invoice.invoice_number` en `InvoiceDocumentA4`
- Metadata disponible:
  - `pricing_metadata`

No se detectaron en este schema:

- columna `document_number`
- columna `series`
- columna `number`
- campos de envio/exportacion dedicados en tabla `invoices`

## SQL preparado

- `sql/20260702_regularize_unsent_invoice_numbers_0048_0049.sql`

Hace esto:

1. bloquea si `043/044` ya existen
2. bloquea si `048/049` no existen
3. bloquea si `0048/0049` estan en papelera
4. bloquea si aparece metadata de envio/exportacion/documento final
5. actualiza exactamente:
   - `INV-0048 / 2026-048` -> `INV-0043 / 2026-043`
   - `INV-0049 / 2026-049` -> `INV-0044 / 2026-044`
6. conserva traza en `pricing_metadata`:
   - `renumbered_from_display_code`
   - `renumbered_from_invoice_number`
   - `renumbered_at`
   - `renumbered_reason`

## Estado real de aplicacion

- El patch SQL quedo versionado en repo.
- No se aplico desde este entorno porque aqui solo hay acceso publico de lectura a Supabase, no un canal verificado de escritura SQL administrativa.

## Resultado esperado despues de aplicar SQL

- Existen:
  - `INV-0043 / 2026-043`
  - `INV-0044 / 2026-044`
- No existen:
  - `INV-0048 / 2026-048`
  - `INV-0049 / 2026-049`
- Proximo numero esperado:
  - `INV-0045 / 2026-045`

## Blindaje futuro relacionado

- La regularizacion debe ir seguida de:
  - `sql/20260702_stabilize_invoice_numbering_sequence.sql`

Eso deja la regla futura asi:

- borrador no consume numero
- emitida/pagada/anulada conserva numero
- siguiente numero sale del maximo fiscal real del ejercicio

## Pendiente de verificacion post-SQL

- rerun de auditoria sobre `0043/0044/0048/0049`
- control de numeracion mostrando:
  - ultimo emitido `2026-044`
  - proximo sugerido `2026-045`
  - huecos hasta `044`: ninguno
