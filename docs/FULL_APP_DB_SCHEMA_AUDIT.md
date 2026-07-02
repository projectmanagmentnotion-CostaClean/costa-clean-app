# Full App DB Schema Audit

## Fecha

- 2026-07-02

## Estado general

- La auditoria real detecto un desfase repo ↔ Supabase.
- La parte minima y segura ya fue aplicada manualmente en Supabase:
  - `public.properties.status`
  - `public.properties.archived_at`
  - `public.properties.deleted_at`
  - `public.invoices.property_id`
  - `gen_random_uuid`
  - `require_authenticated_financial_write`
- El repo queda reconciliado para convivir tanto con bases nuevas como con una base legacy que aun no tenga esos campos.

## Evidencia real obtenida

### Produccion publica

- `https://app.costacleanbcn.com/?debugBuild=1`
  - responde `200`
  - build visible durante la auditoria previa: `4fa759d`
- Esa build publica no incluia todavia el panel de Data Health ni los ultimos cambios fiscales del repo.

### REST real contra Supabase

- `leads`: `200`
- `clients`: `200`
- `properties`: `400`
  - error observado antes del ajuste manual: `column properties.status does not exist`
- `quotes`: `200`
- `jobs`: `200`
- `job_lines`: `401`
  - `permission denied for table job_lines`
- `invoices`: `400`
  - error observado antes del ajuste manual: `column invoices.property_id does not exist`
- `invoice_lines`: `200`
- `payments`: `200`
- `expenses`: `200`
- `recurring_invoice_plans`: `404`
  - ausente en schema cache
- `quarterly_closings`: `200`
- `annual_closings`: `200`

### RPCs reales

- `save_quote_with_lines`: existe, `anon` no puede ejecutar
- `save_invoice_with_lines`: existe, `anon` no puede ejecutar
- `save_job_with_lines`: existe y exige autenticacion financiera
- `record_audit_event`: existe, `anon` no puede ejecutar
- `reassign_property_client(text, text)`: existe
- `save_client_recurring_invoice_plan`: ausente
- `generate_invoice_from_recurring_plan`: ausente

## Reconciliacion aplicada en repo

- `src/app/appDataApi.ts`
  - `listProperties()` intenta leer el schema completo.
  - Si una base legacy aun no tiene `status`, `archived_at` o `deleted_at`, cae a un select legacy controlado.
  - El fallback solo captura columnas legacy conocidas y no silencia errores ajenos.
- `src/app/dataHealth.ts`
  - centraliza probes REST reales por modulo.
- `src/app/DataHealthDebugPanel.tsx`
  - expone `?debugDataHealth=1` sin tumbar la app si falla un probe.
- `src/app/AppShell.tsx`
  - integra el panel sin bloquear la shell principal.

## Data Health esperado

Con `?debugDataHealth=1` la app debe exponer como minimo:

- `clients`
- `properties`
- `quotes`
- `jobs`
- `job_lines`
- `invoices`
- `invoice_lines`
- `payments`
- `expenses`
- `quarterly_closings`
- `annual_closings`
- `recurring_invoice_plans`

Notas:

- `job_lines` puede seguir mostrando un problema de permisos si la sesion real no es `authenticated`.
- `recurring_invoice_plans` debe seguir marcado como pendiente hasta completar su preflight y despliegue.

## Recurrentes: estado real

- No se deben aplicar todavia a ciegas.
- El SQL consolidado de este sprint excluye la creacion de `recurring_invoice_plans` y sus RPCs.
- Antes de habilitar recurrentes en Supabase hay que completar este preflight:

### Tabla `invoices`

- `id`
- `job_id`
- `quote_id`
- `client_id`
- `property_id`
- `issue_date`
- `status`
- `subtotal`
- `tax_amount`
- `total`
- `notes`
- `internal_notes`
- `pricing_metadata`

### Tabla `invoice_lines`

- `id`
- `invoice_id`
- `sort_order`
- `concept`
- `quantity`
- `unit`
- `unit_price`
- `line_subtotal`

### Funciones requeridas

- `refresh_invoice_payment_status`
- `require_authenticated_financial_write`

## Regla de despliegue para recurrentes

- Si falta `refresh_invoice_payment_status`, no crear `generate_invoice_from_recurring_plan` en su forma actual.
- En ese caso, recurrentes queda como pendiente tecnico documentado.
- Ese pendiente no debe bloquear Propiedades, Facturas ni el resto de la app principal.

## SQL consolidado del sprint

- Archivo:
  - `sql/20260702_reconcile_app_schema_with_supabase.sql`
- Alcance actual:
  - solo columnas minimas ya validadas
  - idempotente
  - sin tocar numeracion
  - sin tocar snapshots fiscales
  - sin crear recurrentes a ciegas

## Riesgos de seguridad separados

- `job_lines` requiere verificacion auth real.
- Las RPCs financieras ya no deberian ser ejecutables por `anon`.
- El hardening completo queda fuera de este sprint y esta documentado en:
  - `docs/SECURITY_RLS_HARDENING_PLAN.md`

## QA recomendado tras deploy

1. Abrir `/?debugBuild=1&debugDataHealth=1` con sesion autenticada.
2. Confirmar que Propiedades carga sin `properties.status missing`.
3. Confirmar que Facturas no acusa `invoices.property_id missing`.
4. Confirmar que cada probe muestra su error de forma aislada y no tumba la app.
5. Dejar recurrentes como pendiente si el preflight no esta completo.
