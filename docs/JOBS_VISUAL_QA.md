# Jobs Visual QA

Fecha: 2026-06-30

## Auditoria real

- Estados reales detectados: `scheduled`, `in_progress`, `completed`, `cancelled`.
- `JobListItem` tiene `scheduled_date`, `quote_id` e `invoice_id`.
- Es fiable detectar:
  - servicios de hoy
  - pendientes o en curso
  - completados sin facturar
  - agenda futura
- CTAs reales confirmados:
  - crear servicio
  - abrir workspace
  - crear factura desde servicio
  - abrir factura
  - registrar cobro
  - abrir cliente, propiedad o presupuesto relacionados

## Cambios aplicados

- Cabecera ejecutiva nueva con prioridad en trabajo sin facturar o agenda de hoy.
- KPI superior limitado a 4.
- Checklist operativo corto para hoy, sin facturar, pendiente y duplicados.
- Se preserva `JobWorkspace` como superficie viva principal.

## Limites respetados

- No se introdujeron horas reales, payroll, coste laboral ni margen por servicio.
- El valor de trabajo sin facturar se trata como lectura operativa basada en lineas/precio del servicio, no como margen ni caja futura.
