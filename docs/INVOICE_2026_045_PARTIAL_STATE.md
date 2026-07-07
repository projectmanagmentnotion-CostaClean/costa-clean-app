# Invoice 2026-045 Partial State

## Estado real

La factura `2026-045 / INV-0045` sigue en estado **parcialmente corregido**.

No esta lista para enviar.

## Factura auditada

- `id`: `INVOICE-0a0d880b-05ee-42a0-8da2-6f5bdad4e398`
- `invoice_number`: `2026-045`
- `display_code`: `INV-0045`
- cliente: `FUSTERIA PINEDA MAR SL`

## Lineas reales

- `limpieza y mantenimiento de local`: `12 x 18,00 EUR = 216,00 EUR`
- `limpieza de taller`: `6 x 18,00 EUR = 108,00 EUR`

## Cabecera real actual

- base imponible / `subtotal`: `234,00 EUR`
- IVA / `tax_amount`: `49,14 EUR`
- total: `283,14 EUR`

## Cabecera correcta esperada

- base imponible / `subtotal`: `324,00 EUR`
- IVA / `tax_amount`: `68,04 EUR`
- total: `392,04 EUR`

## Por que sigue parcial

Se confirmaron dos bloqueos distintos:

1. La RPC oficial `save_invoice_with_lines_v2` delega en `save_invoice_with_lines`, y esa funcion vuelve a ejecutar `assert_invoice_numbering_regular(..., v_invoice_id)` incluso al actualizar una factura ya emitida.
2. En la secuencia real `2026-043` a `2026-050` no hay huecos. Pero al excluir la propia `2026-045` del chequeo, la funcion interpreta artificialmente que falta `2026-045` y rechaza la actualizacion como si fuera una nueva emision con hueco fiscal.
3. El fallback de `update` directo con sesion autenticada puede modificar `invoice_lines`, pero no puede persistir la fila de `public.invoices`: el `update` afecta `0` filas.

## Consecuencia operativa

- la linea ya esta corregida a `6` horas
- la cabecera sigue antigua
- la factura no debe enviarse asi
- no se creo factura nueva
- no se creo rectificativa
- no cambio ni `invoice_number` ni `display_code`

## Siguiente accion minima necesaria

Hace falta una de estas dos vias:

1. una credencial con permisos de servidor (`SUPABASE_SERVICE_ROLE_KEY`) para sincronizar solo la cabecera de esta factura existente, o
2. una migracion minima en el write path SQL para permitir actualizar una factura ya emitida con el mismo numero sin disparar el falso hueco por autoexclusion.

Sin una de esas dos vias, la factura seguira parcial aunque el script quede endurecido.
