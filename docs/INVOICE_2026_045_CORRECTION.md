# Invoice 2026-045 Correction

## Confirmacion del usuario

- la factura `2026-045` no ha sido enviada al cliente
- la factura `2026-045` no ha sido declarada ni exportada fiscalmente
- por tanto puede corregirse internamente manteniendo el mismo numero

## Factura auditada

- `invoice_number`: `2026-045`
- `display_code` real persistido: `INV-0045`
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

En el write path SQL real se confirmo la causa exacta:

- `save_invoice_with_lines_v2` delega en `save_invoice_with_lines`
- `save_invoice_with_lines` llama a `assert_invoice_numbering_regular(..., v_invoice_id)`
- esa llamada excluye la propia factura del chequeo de continuidad
- al actualizar una emitida existente con el mismo numero, esa exclusion convierte `2026-045` en un hueco artificial aunque la secuencia real `2026-043` a `2026-050` sea continua

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

## Ajuste posterior del fix

En la pasada del `2026-07-07` se refuerza la rama interna para evitar mezcla con la superficie de emision:

- `resolvedSaveStatus` fija el estado real a guardar durante la correccion interna
- el `Estado administrativo` queda bloqueado en facturas ya emitidas
- la confirmacion interna limpia el error previo para no arrastrar mensajes de validacion stale
- la traza distingue `invoice_edit_flow_internal_correction`

Con esto, el bloqueo pendiente deja de ser de numeracion UI.

El siguiente bloqueo real ya no es visual:

- la RPC remota necesita incorporar la migracion SQL de mismo numero
- y el fallback directo sigue sin permisos para persistir la cabecera de `invoices`

## Intento de aplicacion real

Fecha del intento: `2026-07-06T18:34:58.1921019+02:00`

Metodo intentado:

- script operativo `node scripts/ops/correct-invoice-2026-045.mjs --apply`
- write path real por RPC `save_invoice_with_lines_v2`
- fallback preparado a `save_invoice_with_lines`

Precondiciones reales verificadas antes del write:

- una sola factura con `invoice_number = 2026-045`
- `display_code` persistido actual `INV-0045`
- cliente real `FUSTERIA PINEDA MAR SL`
- linea objetivo encontrada: `limpieza de taller`
- cantidad actual `1`
- `unit_price` `18,00 EUR`
- `line_subtotal` actual `18,00 EUR`
- subtotal actual `234,00 EUR`
- IVA actual `49,14 EUR`
- total actual `283,14 EUR`
- sin pagos asociados
- `pricing_metadata.renumbered_reason` contiene `Factura creada pero no enviada`

Resultado del intento:

- la RPC oficial devolvio el falso hueco `2026-045` al revalidar la emitida existente
- el fallback directo con sesion autenticada solo pudo sostener la linea, no la cabecera
- la correccion **no** quedo completada en datos reales en este turno
- no se creo nueva factura
- no se creo rectificativa
- no cambio `invoice_number`
- no cambio `display_code`
- no se modifico ninguna otra factura

## Migracion preparada

- [20260707_fix_same_number_invoice_update_gap.sql](C:/Users/USUARIO/costa-clean-app/supabase/migrations/20260707_fix_same_number_invoice_update_gap.sql)

Resumen:

- ajusta `save_invoice_with_lines`
- mantiene validacion estricta en altas nuevas
- mantiene validacion estricta cuando una factura aun no consumia numeracion fiscal
- evita que la propia emitida existente se trate como hueco durante una actualizacion con mismo numero y mismo ejercicio

Estado:

- creada en repo: si
- aplicada en Supabase real: no

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
- lectura real de Supabase con `.env.local`
- verificacion de que la factura sigue en `234,00 / 49,14 / 283,14` antes del intento de escritura
- intento real de escritura por RPC bloqueado por falso hueco de autoexclusion
- `npm run lint` OK
- `npm run build` OK
- pendiente de aplicar la migracion en Supabase real para poder reintentar la correccion y confirmar persistencia final
