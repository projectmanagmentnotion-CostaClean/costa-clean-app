# Invoice 2026-045 Execution Blocked

## Estado

La factura `2026-045` sigue sin poder sincronizar cabecera en este turno.

La linea ya esta corregida, pero la factura no quedo completa.

## Fecha y hora

- `2026-07-06T18:34:58.1921019+02:00`

## Metodo preparado

- script operativo: `scripts/ops/correct-invoice-2026-045.mjs`
- comando de aplicacion: `node scripts/ops/correct-invoice-2026-045.mjs --apply`
- write path objetivo: RPC `save_invoice_with_lines_v2`
- fallback preparado: RPC `save_invoice_with_lines`
- soporte opcional de autenticacion por variables:
  - `SUPABASE_AUTH_EMAIL`
  - `SUPABASE_AUTH_PASSWORD`

## Precondiciones verificadas

- factura localizada por `invoice_number = 2026-045`
- `display_code` persistido actual: `INV-0045`
- cliente real: `FUSTERIA PINEDA MAR SL`
- linea objetivo encontrada: `limpieza de taller`
- cantidad original esperada: `1`
- cantidad real actual detectada al reintentar: `6`
- unidad: `Horas`
- precio unitario: `18,00 EUR`
- subtotal actual factura: `234,00 EUR`
- IVA actual: `49,14 EUR`
- total actual: `283,14 EUR`
- pagos asociados: `0`
- una sola coincidencia para `invoice_number = 2026-045`
- señal disponible de no enviada en `pricing_metadata.renumbered_reason`

## Bloqueo exacto

Primero, el write path oficial por RPC sigue fallando para esta factura emitida:

- `save_invoice_with_lines_v2`
- delega en `save_invoice_with_lines`
- `save_invoice_with_lines` llama a `assert_invoice_numbering_regular(..., v_invoice_id)` aunque sea una actualizacion de una emitida ya existente
- como la funcion excluye la propia `2026-045`, convierte esa exclusion en un hueco artificial y devuelve:
  - `No se puede emitir factura. Hay huecos en la numeracion fiscal: 2026-045.`

Segundo, el fallback directo con sesion autenticada no puede cerrar la cabecera:

- `invoice_lines` si acepta el update de la linea corregida
- `invoices` devuelve `0` filas afectadas al intentar actualizar `subtotal`, `tax_amount` y `total`
- error operativo consolidado del script:
  - `Direct invoices update affected 0 rows. The authenticated session can edit lines but cannot persist invoice header totals for INVOICE-0a0d880b-05ee-42a0-8da2-6f5bdad4e398.`

## Evidencia adicional

- con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` de `.env.local` se pudo leer la factura real
- con `SUPABASE_ACCESS_TOKEN` y `SUPABASE_REFRESH_TOKEN` se pudo abrir una sesion valida para pruebas de write
- esa sesion puede actualizar `invoice_lines`
- esa sesion no puede actualizar la fila de `public.invoices`
- la secuencia real leida en datos es continua entre `2026-043` y `2026-050`, por lo que el hueco `2026-045` que devuelve la RPC es artificial para esta actualizacion

## Que falta

Se necesita una de estas dos condiciones para completar la correccion real:

1. una credencial de servidor autorizada para actualizar la cabecera real (`SUPABASE_SERVICE_ROLE_KEY` u otra via aprobada), o
2. una migracion minima del write path SQL para que `save_invoice_with_lines` no trate la propia factura emitida como hueco al revalidar numeracion en updates del mismo registro

## Que no se hizo

- no se sincronizo la cabecera real
- no se creo factura nueva
- no se creo rectificativa
- no se cambio `invoice_number`
- no se cambio `display_code`
- no se toco SQL
- no se tocaron migrations
- no se cambio `appDataApi`
- no se cambio `financialWriteApi`
- no se altero la numeracion global

## Siguiente paso seguro

Si aparece `SUPABASE_SERVICE_ROLE_KEY`, reejecutar un apply controlado que actualice solo la cabecera de `INVOICE-0a0d880b-05ee-42a0-8da2-6f5bdad4e398`.

Si no aparece esa credencial, la via minima pasa por una migracion SQL dedicada sobre `save_invoice_with_lines` / `save_invoice_with_lines_v2` para permitir la correccion interna de emitidas con mismo numero sin falso hueco de autoexclusion.

Mientras tanto, el estado parcial real queda documentado en `docs/INVOICE_2026_045_PARTIAL_STATE.md`.

## Comandos auditados

Comandos reales usados en este ciclo:

```bash
node scripts/ops/correct-invoice-2026-045.mjs
node scripts/ops/correct-invoice-2026-045.mjs --apply
```
