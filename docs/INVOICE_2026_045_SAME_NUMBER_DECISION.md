# Invoice 2026-045 Same Number Decision

## Confirmacion de origen

- el usuario confirma que la factura `2026-045` no ha sido enviada al cliente
- el usuario confirma que la factura `2026-045` no ha sido declarada ni exportada fiscalmente
- por tanto la correccion se trata como **correccion interna sobre la misma factura existente**

## Decision aplicada

- se mantiene el mismo `invoice_number`
- se mantiene el mismo `display_code` persistido (`INV-0045`)
- no se crea una factura nueva
- no se crea rectificativa
- no se reutiliza numeracion nueva
- no se dispara validacion de huecos como si fuera una emision nueva

## Motivo tecnico

El bloqueo real estaba en `src/features/invoices/InvoiceEditFlow.tsx`:

- para facturas no borrador, el flujo calculaba `expectedInvoiceNumber` y `expectedDisplayCode`
- ademas ejecutaba validacion de huecos de numeracion antes de guardar
- eso hacia que una factura ya emitida se tratase como si estuviera intentando emitirse otra vez

## Cambio minimo aplicado

- se anade confirmacion explicita:
  - `Confirmo que esta factura no ha sido enviada y puede corregirse internamente manteniendo el numero.`
- cuando esa confirmacion esta activa para una factura emitida:
  - el guardado sigue usando la factura existente
  - no se envian expectativas de numeracion nueva al write path
  - no se ejecuta la validacion de huecos como emision nueva
  - el CTA pasa a `Guardar correccion interna`

## Ajuste posterior del fix

- la rama interna usa ahora `resolvedSaveStatus`
- la UI deja bloqueado el selector de estado para evitar ambiguedad entre corregir y emitir
- la confirmacion interna limpia errores stale de validacion
- la traza distingue el modo `invoice_edit_flow_internal_correction`

## Correccion documentada

Valores anteriores:

- `limpieza y mantenimiento de local`: `216,00 EUR`
- `limpieza de taller`: `1 x 18,00 EUR = 18,00 EUR`
- base imponible: `234,00 EUR`
- IVA 21%: `49,14 EUR`
- total: `283,14 EUR`

Valores corregidos esperados:

- `limpieza y mantenimiento de local`: `12 x 18,00 EUR = 216,00 EUR`
- `limpieza de taller`: `6 x 18,00 EUR = 108,00 EUR`
- base imponible: `324,00 EUR`
- IVA 21%: `68,04 EUR`
- total: `392,04 EUR`

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
- contratos de datos
- numeracion global
- fiscalidad global
- reglas globales de calculo
- `save_invoice_with_lines`
- `save_invoice_with_lines_v2`

## Validacion realizada

- `npm run lint`
- `npm run build`
- revision de `git status`
- intento real de write por RPC bloqueado por autenticacion
