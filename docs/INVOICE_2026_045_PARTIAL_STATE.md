# Invoice 2026-045 Partial State

## Estado real

La incidencia de estado parcial queda **resuelta**.

La factura `2026-045 / INV-0045` ya no esta parcial y queda lista para enviar.

## Factura auditada

- `id`: `INVOICE-0a0d880b-05ee-42a0-8da2-6f5bdad4e398`
- `invoice_number`: `2026-045`
- `display_code`: `INV-0045`
- cliente: `FUSTERIA PINEDA MAR SL`

## Lineas reales

- `limpieza y mantenimiento de local`: `12 x 18,00 EUR = 216,00 EUR`
- `limpieza de taller`: `6 x 18,00 EUR = 108,00 EUR`

## Cabecera final real

- base imponible / `subtotal`: `324,00 EUR`
- IVA / `tax_amount`: `68,04 EUR`
- total: `392,04 EUR`

## Confirmaciones finales

- la linea queda en `6` horas
- la cabecera queda sincronizada
- no se creo factura nueva
- no se creo rectificativa
- no cambio ni `invoice_number` ni `display_code`
- no se toco otra factura

## Causa ya resuelta

La causa del estado parcial fue el falso hueco por autoexclusion en `save_invoice_with_lines`.

El usuario confirmo que la migracion remota ya fue aplicada y el script operativo pudo completar la sincronizacion final.

## Migracion preparada

- [20260707_fix_same_number_invoice_update_gap.sql](C:/Users/USUARIO/costa-clean-app/supabase/migrations/20260707_fix_same_number_invoice_update_gap.sql)

Estado desde este turno:

- migracion creada: si
- migracion aplicada en Supabase real: si
