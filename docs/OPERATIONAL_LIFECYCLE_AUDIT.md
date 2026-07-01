# Operational Lifecycle Audit

Fecha: 2026-07-01

## Hallazgos reales

- `jobs` y `invoices` tenian estados operativos, pero no una capa transversal de `archived_at`, `deleted_at` y `cancelled_at`.
- `quotes`, `expenses`, `clients` y `properties` tampoco cargaban ni filtraban metadatos de archivo/papelera en la UI principal.
- `leads` ya usaba `archived_at`, pero el resto de listas y KPIs seguian mezclando registros archivados/cancelados con trabajo activo.
- Las vistas principales ocultaban a veces `cancelled`, pero no tenian un criterio comun para archivados, anulados o papelera.

## Modelo aplicado

- Archivo: `archived_at`
- Papelera segura: `deleted_at`
- Cancelacion/anulacion: `cancelled_at` + `cancel_reason`
- Las vistas diarias ahora deben priorizar activos y excluir archivados, cancelados y papelera por defecto.

## Prioridad implementada

- Servicios:
  cancelacion confirmada, archivado/restauracion, papelera segura sin romper facturacion.
- Facturas:
  anulacion protegida, archivado/restauracion, borrador a papelera.
- Presupuestos:
  archivado/restauracion y borrador a papelera.
- Listas/KPIs:
  filtros por defecto orientados a trabajo activo en servicios, facturas, presupuestos y gastos.

## Entidades con borrado fisico no recomendado

- Facturas emitidas o cobradas.
- Servicios con factura asociada.
- Clientes con facturas, servicios o presupuestos.
- Inmuebles con servicios o facturas.
- Cobros reales.

## Validacion pendiente fuera de repo

- Aplicar `sql/20260701_operational_lifecycle_foundation.sql` en la base real.
- Verificar que las politicas/RPC activos en Supabase coincidan con esta version.
