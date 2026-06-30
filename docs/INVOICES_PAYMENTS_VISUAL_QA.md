# Invoices and Payments Visual QA

Fecha: 2026-06-30

## Alcance

- `src/pages/InvoicesPage.tsx`
- `src/pages/PaymentsPage.tsx`
- `src/features/invoices/types.ts`
- `src/features/payments/types.ts`
- `src/features/invoices/InvoicesList.tsx`
- `src/features/payments/PaymentsList.tsx`
- `src/features/invoices/InvoiceDetailCard.tsx`
- `src/features/payments/PaymentDetailCard.tsx`
- `src/features/financial/financialWriteApi.ts`

## Diagnostico real

- `Facturas` tenia lista y detail correctos, pero la cabecera no priorizaba cobro pendiente ni separaba bien emision frente a seguimiento de saldo.
- `Pagos` ya funcionaba como modulo auxiliar, aunque su hero generico podia competir visualmente demasiado con `Facturas`.
- El dato disponible soporta `payment_status`, `paid_amount`, `outstanding_amount`, `payment_count` y enlace factura-cobro.
- No hay `due_date` fiable en `InvoiceListItem`, ni reconciliacion bancaria, ni forecast de caja, ni morosidad dura soportada en primer nivel.

## Ajustes aplicados

- `Facturas` pasa a lectura cobro-first con `ExecutiveHeader`, checklist corto y 4 KPIs maximo.
- La accion principal de `Facturas` abre un cobro pendiente real cuando existe una factura abierta.
- La alta directa de factura queda como accion secundaria.
- `Pagos` se mantiene como consola auxiliar con cabecera mas ligera y KPIs compactos de auditoria.

## Confirmaciones QA

- No se introdujeron metricas de vencimiento basadas en datos no fiables.
- No se introdujeron previsiones de caja, conciliacion bancaria ni promesas de morosidad seria.
- No se crearon modulos nuevos.
- `Facturas` sigue siendo la superficie principal del circuito de cobro.
- `Pagos` conserva rutas y acciones reales hacia factura vinculada.
- No se tocó persistencia financiera: `save_payment_and_refresh_invoice`, `settle_invoice_by_transfer` y `refresh_invoice_payment_status` siguen siendo la base operativa.

## Validacion pendiente de superficie

- Queda cubierta la revision de codigo y layout.
- La verificacion visual en navegador debe considerarse separada de esta nota si no se ejecuta una sesion interactiva contra la app levantada.
