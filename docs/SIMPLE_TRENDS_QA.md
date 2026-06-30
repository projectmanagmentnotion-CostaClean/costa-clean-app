# Simple Trends QA

Fecha: 2026-06-30

## Auditoria real

Series reales detectadas:

- facturacion por `issue_date`
- cobros por `payment_date`
- gastos por `expense_date`
- presupuestos por `created_at`
- cierres por periodo mediante selector fiscal

## Decision de esta fase

- No se implemento una capa visual de tendencias en este sprint.

## Motivo

- El mega sprint ya exigia extender jerarquia y decision en modulos principales sin abrir una mini capa BI apresurada.
- Aunque hay fechas reales, faltaba cerrar un patron de tendencia reutilizable antes de pintar barras o comparativas en varias vistas.
- Se priorizo claridad operativa en Quotes, Jobs, Expenses, Clients, Properties y el informe integral del cierre.

## Pendiente razonable

- Si se retoma, la primera version segura deberia salir sobre series deterministas ya confirmadas:
  - facturacion por mes
  - cobros por mes
  - gastos por mes
- Sin forecast, sin prediccion y sin librerias nuevas.
