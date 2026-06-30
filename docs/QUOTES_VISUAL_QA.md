# Quotes Visual QA

Fecha: 2026-06-30

## Auditoria real

- Estados reales detectados: `draft`, `sent`, `accepted`, `rejected`, `expired`.
- `QuoteListItem` soporta `job_id` e `invoice_id`, por lo que es fiable detectar aceptados sin convertir y aceptados sin factura visible.
- CTAs reales confirmados:
  - crear presupuesto
  - abrir presupuesto
  - abrir documento
  - aceptar presupuesto
  - aceptar y facturar desde detalle
  - crear servicio desde presupuesto aceptado
- No hay base madura para forecast comercial, scoring ni probabilidad de cierre.

## Cambios aplicados

- Cabecera cambiada a lectura de conversion con `ExecutiveHeader`.
- KPI superior limitado a 4: seguimiento, aceptados, aceptados sin convertir, valor aceptado.
- Embudo simple `accepted -> job` mediante `ProgressMetric`.
- Cola de accion corta con aceptados sin servicio, aceptados sin factura, enviados por seguir y duplicados.
- La lista y el detail card se mantienen como superficie de ejecucion real.

## Limites respetados

- No se introdujo tasa de conversion global artificial.
- No se invento dinero esperado fuera de estados reales.
- No se crearon CTAs a vistas inexistentes.
