# App DB Reconciliation And Fiscal Control QA

## Fecha

- 2026-07-02

## Que se aplico manualmente en Supabase

- `public.properties.status`
- `public.properties.archived_at`
- `public.properties.deleted_at`
- `public.invoices.property_id`
- `gen_random_uuid`
- `require_authenticated_financial_write`

## Que se ajusto en repo

- Fallback seguro de `properties` en `src/app/appDataApi.ts`
- `DataHealthDebugPanel` y probes en `src/app/dataHealth.ts`
- Integracion del panel en `src/app/AppShell.tsx`
- Panel `Control fiscal de facturas` en `src/pages/InvoicesPage.tsx`
- Backfill autenticado en `src/features/invoices/invoiceFiscalSnapshotApi.ts`
- Helpers y auditoria fiscal en `src/features/invoices/invoiceFiscalSnapshot.ts`

## Por que no se veia el panel fiscal

- El panel si estaba montado en la pagina real de Facturas.
- La build publica observada seguia en `4fa759d`.
- Mientras el deploy no reflejara el commit nuevo, el usuario seguia viendo una version anterior sin estos cambios.

## Donde aparece ahora

- Pagina real: `src/pages/InvoicesPage.tsx`
- Posicion:
  - debajo de KPIs
  - antes de `InvoiceNumberingControlCard`
  - visible sin factura seleccionada

## Que muestra el panel

- `Completas: X`
- `Reparables desde cliente: X`
- `Incompletas: X`
- `Revisar incompletas`
- `Completar reparables`

## Debug opcional

- `?debugDataHealth=1`
  - activa probes de salud App ↔ Supabase
- `?debugInvoiceFiscal=1`
  - muestra JSON compacto:

```json
{
  "totalInvoices": 44,
  "complete": 0,
  "repairable": 42,
  "blocked": 2,
  "canRunBackfill": true
}
```

## Recurrentes

- Estado: pendiente tecnico
- Motivo:
  - no se debe crear `generate_invoice_from_recurring_plan` sin confirmar dependencias reales
  - falta preflight de `invoice_lines`, `invoices` y `refresh_invoice_payment_status`
- Decision de este sprint:
  - no aplicar SQL grande de recurrentes a ciegas
  - no bloquear la app principal por ese pendiente

## Resultado esperado de Data Health

- Propiedades debe dejar de romper por `properties.status`
- Facturas debe dejar de depender de un `property_id` ausente
- Cada fallo debe verse aislado y no tumbar toda la shell

## QA ejecutado en repo

- `npm run lint`
- `npm run test`
- `npm run build`

## QA online pendiente de confirmar con sesion autenticada

1. `/?debugBuild=1&debugDataHealth=1`
2. Entrar en Facturas con `?debugInvoiceFiscal=1`
3. Ver `Control fiscal de facturas`
4. Ejecutar `Completar reparables`
5. Confirmar que solo siguen bloqueadas las facturas con cliente incompleto

## Limites reales del cierre

- Este cierre no confirma por si solo que el backfill ya se ejecuto en produccion.
- Este cierre no confirma por si solo que la build publica ya dejo atras `4fa759d`.
- Ambas comprobaciones dependen del commit/push y del deploy resultante.
