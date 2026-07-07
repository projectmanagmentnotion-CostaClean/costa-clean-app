# Invoice 2026-045 Applied QA

## Estado

Aplicada en datos reales.

La factura queda corregida y lista para enviar.

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

- el `--apply` completo termino con `Result: correction applied successfully.`
- lectura real inmediata por el propio script:
  - subtotal `324,00`
  - IVA `68,04`
  - total `392,04`
- lectura real de confirmacion posterior:
  - `invoice_number = 2026-045`
  - `display_code = INV-0045`
  - una sola coincidencia por `invoice_number`
  - una sola coincidencia por `display_code`

## Confirmaciones

- no se creo factura nueva
- no se creo rectificativa
- no cambio `invoice_number`
- no cambio `display_code`
- no se toco otra factura
- la factura queda lista para enviar

## Estado del fix de UI

- aplicado en `InvoiceEditFlow`
- la correccion interna deja separado el modo de guardado frente a emision nueva
- el flujo queda verificado contra la RPC remota ya corregida

## Estado de la migracion SQL

- creada: [20260707_fix_same_number_invoice_update_gap.sql](C:/Users/USUARIO/costa-clean-app/supabase/migrations/20260707_fix_same_number_invoice_update_gap.sql)
- aplicada en Supabase real: si
