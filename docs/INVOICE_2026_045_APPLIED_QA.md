# Invoice 2026-045 Applied QA

## Estado

No aplicada en datos reales en este turno.

## Fecha

- `2026-07-07`

## Lectura real antes del intento

- `invoice_number`: `2026-045`
- `display_code`: `INV-0045`
- cliente: `FUSTERIA PINEDA MAR SL`
- linea 1: `limpieza y mantenimiento de local` - `12 x 18,00 = 216,00`
- linea 2: `limpieza de taller` - `1 x 18,00 = 18,00`
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

- write real bloqueado por:
  - `Authentication required for financial writes.`

## Confirmaciones

- no se creo factura nueva
- no se creo rectificativa
- no cambio `invoice_number`
- no cambio `display_code`
- no se toco otra factura

## Estado del fix de UI

- aplicado en `InvoiceEditFlow`
- la correccion interna deja separado el modo de guardado frente a emision nueva
- pendiente de verificacion funcional con sesion autenticada real
