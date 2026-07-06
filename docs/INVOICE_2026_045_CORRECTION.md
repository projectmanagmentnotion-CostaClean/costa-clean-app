# Invoice 2026-045 Correction

## Factura detectada

- numero: `2026-045`
- cliente: `FUSTERIA PINEDA MAR SL`
- servicio o referencia: `JOB-0068 · PRO-0007 · FUSTERIA PINEDA MAR SL`
- estado visual auditado: `Emitida`

## Linea incorrecta

- concepto: `limpieza de taller`
- valor actual visible: `1 Horas x 18,00 EUR = 18,00 EUR`
- valor correcto solicitado: `6 Horas x 18,00 EUR = 108,00 EUR`

## Valores actuales visibles

- limpieza y mantenimiento de local: `216,00 EUR`
- limpieza de taller: `18,00 EUR`
- base imponible: `234,00 EUR`
- IVA 21%: `49,14 EUR`
- total: `283,14 EUR`

## Valores corregidos esperados

- limpieza y mantenimiento de local: `216,00 EUR`
- limpieza de taller: `108,00 EUR`
- base imponible: `324,00 EUR`
- IVA 21%: `68,04 EUR`
- total: `392,04 EUR`

## Flujo encontrado en el repo

- la app expone `InvoiceEditFlow` y edicion mayor desde `InvoicesPage` y `InvoiceDetailCard`.
- esa edicion vuelve a pasar por `saveInvoiceWithLines`.
- la app recalcula subtotal, IVA y total usando la logica existente antes de guardar.
- no se detecto soporte explicito de factura rectificativa ni flujo dedicado de correccion fiscal para emitidas.

## Decision tomada

Decision actual: **flujo seguro preparado con borrador guiado**.

Motivo:

- la factura sigue auditada como emitida
- el repo sigue sin exponer una rectificativa real
- pero la app si permite reutilizar `InvoiceCreateFlow` con `prefill` sin crear nada automaticamente

Resultado:

- no se modifica la factura real `2026-045`
- no se hardcodea ningun write
- se muestra una card compacta de correccion segura en el detalle
- desde esa card se puede abrir un borrador guiado con la linea corregida a `6 horas`

## Instruccion operativa clara

Para factura emitida `2026-045`, abrir el borrador guiado de correccion o generar rectificativa segun el criterio fiscal vigente. No editar directamente la factura emitida sin validar ese criterio.

## Confirmacion de no-touch critico

- no se toco Supabase
- no se toco SQL
- no se toco RPC
- no se tocaron migrations
- no se toco `appDataApi`
- no se toco `financialWriteApi`
- no se toco `invoice_number`
- no se toco `display_code`
- no se toco `save_invoice_with_lines`
- no se toco `save_invoice_with_lines_v2`
- no se altero numeracion
- no se altero fiscalidad global
- no se alteraron calculos globales
- no se alteraron contratos de datos
- no se alteraron reglas de negocio

## Proximos pasos recomendados

1. confirmar con criterio fiscal si la 2026-045 debe cerrarse como rectificativa o como nuevo borrador administrativo controlado.
2. si exige rectificativa, implementar un flujo dedicado en sprint separado.
3. si el borrador guiado es valido para la operativa, revisarlo y confirmarlo manualmente desde `InvoiceCreateFlow`.
