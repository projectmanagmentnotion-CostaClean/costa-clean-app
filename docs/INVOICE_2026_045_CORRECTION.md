# Invoice 2026-045 Correction

## Confirmacion del usuario

- la factura `2026-045` no ha sido enviada al cliente
- la factura `2026-045` no ha sido declarada ni exportada fiscalmente
- por tanto puede corregirse internamente manteniendo el mismo numero

## Factura auditada

- numero y `display_code`: `2026-045`
- cliente: `FUSTERIA PINEDA MAR SL`
- servicio o referencia: `JOB-0068 · PRO-0007 · FUSTERIA PINEDA MAR SL`
- estado visual actual: `Emitida`

## Valores anteriores

- `limpieza y mantenimiento de local`: `12 x 18,00 EUR = 216,00 EUR`
- `limpieza de taller`: `1 x 18,00 EUR = 18,00 EUR`
- base imponible: `234,00 EUR`
- IVA 21%: `49,14 EUR`
- total: `283,14 EUR`

## Valores corregidos esperados

- `limpieza y mantenimiento de local`: `12 x 18,00 EUR = 216,00 EUR`
- `limpieza de taller`: `6 x 18,00 EUR = 108,00 EUR`
- base imponible: `324,00 EUR`
- IVA 21%: `68,04 EUR`
- total: `392,04 EUR`

## Bloqueo real encontrado

La edicion mayor de facturas emitidas estaba tratando el guardado como si fuese una emision nueva:

- ejecutaba validacion de huecos de numeracion
- calculaba `expectedInvoiceNumber` y `expectedDisplayCode`
- si existia drift de secuencia, mostraba:
  - `No se puede emitir factura. Hay huecos en la numeracion fiscal: 2026-045.`

Ese comportamiento era incorrecto para una correccion interna de una factura ya existente y no enviada.

## Solucion aplicada

Se mantiene el flujo normal de `InvoiceEditFlow`, pero con un modo seguro de correccion interna:

- confirmacion explicita de correccion interna sin envio
- CTA especifico: `Guardar correccion interna`
- conservacion del mismo `invoice_number/display_code`
- sin reemision
- sin renumeracion
- sin validacion de huecos como nueva emision
- con vuelta al detalle al guardar, igual que el flujo normal

Ademas, para el caso conocido `2026-045`, el editor ofrece `Aplicar correccion conocida` para precargar:

- `limpieza de taller` a `6` horas
- base esperada `324,00 EUR`
- IVA esperado `68,04 EUR`
- total esperado `392,04 EUR`

## Archivos tocados

- `src/features/invoices/InvoiceEditFlow.tsx`
- `src/features/shared/fullscreen-create-flow.css`
- `docs/INVOICE_2026_045_CORRECTION.md`
- `docs/INVOICE_2026_045_SAME_NUMBER_DECISION.md`

## Que no se toco

- Supabase directo
- SQL
- RPC
- migrations
- `appDataApi`
- `financialWriteApi`
- `save_invoice_with_lines`
- `save_invoice_with_lines_v2`
- numeracion global
- fiscalidad global
- reglas globales de calculo
- contratos de datos
- reglas de negocio

## Validacion realizada

- auditoria del guardado en `InvoiceEditFlow`
- confirmacion de que `saveInvoiceWithLines` elimina `invoice_number` y `display_code` del payload
- confirmacion de que el mismatch solo se dispara cuando se envian expectativas nuevas de numeracion
- `npm run lint` OK
- `npm run build` OK
- pendiente de verificacion funcional en entorno con datos reales para confirmar que la factura persistida queda actualizada como `2026-045`
