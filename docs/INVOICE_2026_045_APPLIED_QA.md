# Invoice 2026-045 Applied QA

## Estado

Parcialmente aplicada en datos reales.

La linea ya esta corregida, pero la cabecera sigue desincronizada.

## Fecha

- `2026-07-07`

## Lectura real antes del intento

- `invoice_number`: `2026-045`
- `display_code`: `INV-0045`
- cliente: `FUSTERIA PINEDA MAR SL`
- linea 1: `limpieza y mantenimiento de local` - `12 x 18,00 = 216,00`
- linea 2: `limpieza de taller` - `6 x 18,00 = 108,00`
- subtotal: `234,00`
- IVA: `49,14`
- total: `283,14`
- pagos asociados: `0`

## Metodo probado

- `node scripts/ops/correct-invoice-2026-045.mjs`
- `node scripts/ops/correct-invoice-2026-045.mjs --apply`

## Resultado del dry-run

- precondiciones OK
- recalculo esperado OK:
  - `limpieza de taller = 6`
  - subtotal `324,00`
  - IVA `68,04`
  - total `392,04`

## Resultado del apply

- la RPC oficial sigue bloqueando la correccion interna de una emitida por falso hueco de autoexclusion:
  - `No se puede emitir factura. Hay huecos en la numeracion fiscal: 2026-045.`
- el fallback directo con sesion autenticada puede actualizar `invoice_lines`, pero no la fila de `invoices`
- la cabecera sigue:
  - subtotal `234,00`
  - IVA `49,14`
  - total `283,14`
- se creo una migracion correctiva en repo para el write path SQL, pero no pudo aplicarse a Supabase real desde este turno

## Confirmaciones

- no se creo factura nueva
- no se creo rectificativa
- no cambio `invoice_number`
- no cambio `display_code`
- no se toco otra factura
- la factura no esta lista para enviar

## Estado del fix de UI

- aplicado en `InvoiceEditFlow`
- la correccion interna deja separado el modo de guardado frente a emision nueva
- el bloqueo pendiente ya no es de UI, sino de write path / permisos de cabecera

## Estado de la migracion SQL

- creada: [20260707_fix_same_number_invoice_update_gap.sql](C:/Users/USUARIO/costa-clean-app/supabase/migrations/20260707_fix_same_number_invoice_update_gap.sql)
- aplicada en Supabase real: no
