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

Decision: **pendiente de accion manual segura**.

Motivo:

- la factura esta auditada como emitida.
- el repo no muestra un flujo explicito de rectificativa.
- aunque la UI permite editar, no existe una guarda funcional que certifique que la edicion directa de una emitida sea el procedimiento fiscal correcto.

Por tanto:

- no se modifica el dato real desde codigo en este sprint.
- no se hardcodea ninguna correccion.
- no se toca DB, SQL, RPC ni write path.
- se deja documentada la correccion esperada y una guarda visual en los editores de facturas emitidas.

## Instruccion operativa clara

Para factura emitida `2026-045`, generar rectificativa o usar el flujo seguro de edicion solo si la operativa fiscal vigente lo permite. No editar directamente la factura emitida sin validar ese criterio.

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

1. confirmar con criterio fiscal si la 2026-045 admite edicion directa o exige rectificativa.
2. si exige rectificativa, implementar un flujo dedicado en sprint separado.
3. si admite edicion directa, ejecutar la correccion desde la UI viva con validacion final de importes y documento regenerado.
