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
- RPC batch segura en `sql/20260702_backfill_invoice_fiscal_snapshots_rpc.sql`

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

## Bug adicional detectado tras el despliegue

- El panel ya visible en `7acf8fa` calculaba bien `42` reparables y `2` bloqueadas.
- El backfill mostraba success, pero no escribia snapshots en Supabase.
- La causa real fue un `update` REST sin `select()` ni confirmacion de fila escrita.
- Bajo RLS, eso podia devolver `error = null` y dejar `pricing_metadata` intacto.

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

## Solucion aplicada

- La app intenta primero `backfill_invoice_fiscal_snapshots()` si existe.
- Si la RPC no existe, usa fallback REST con read-after-write por factura.
- Solo hay success si `repaired > 0`.
- Si Supabase no confirma ninguna actualizacion, la UI muestra:
  - `No se guardaron cambios`
  - `El backfill detecto facturas reparables, pero Supabase no confirmo ninguna actualizacion.`
- La capa fiscal del frontend ya no depende de `clients.fiscal_name`.
- El snapshot ahora admite `name` y `fiscal_name`.
- El PDF y la vista documental priorizan `snapshot.fiscal_name || snapshot.name`.
- La RPC nueva normaliza `pricing_metadata` corrupto cuando llega como array.

## Numeracion fiscal 0050

- Nuevo escenario reportado:
  - `2026-044` existe
  - `2026-045` a `2026-049` faltan
  - `2026-050 / INV-0050` existe
- Decision en repo:
  - no seguir sugiriendo `2026-051` mientras haya huecos
  - bloquear emision no borrador si quedan huecos fiscales
  - dejar preparada regularizacion segura `0050 -> 0045`
- SQL preparada:
  - `sql/20260702_fix_invoice_fiscal_metadata_and_numbering_0050.sql`

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
4. Aplicar `sql/20260702_backfill_invoice_fiscal_snapshots_rpc.sql` en Supabase
5. Ejecutar `Completar reparables`
6. Confirmar que el panel pasa a `42 completas / 0 reparables / 2 incompletas`
7. Confirmar por SQL que existen `42` snapshots reales

## Limites reales del cierre

- Este cierre corrige el falso success en repo.
- La persistencia batch real en produccion requiere aplicar `sql/20260702_backfill_invoice_fiscal_snapshots_rpc.sql` si el entorno sigue bloqueando el update REST bajo RLS.
- La verificacion final del backfill sigue dependiendo de una sesion autenticada y de la SQL aplicada.

## Cierre final post-0053

- Reconciliacion actual observada:
  - build online `24c8d8e`
  - DB fiscal sin huecos hasta `2026-048`
  - `48/48` facturas con `client_fiscal_snapshot`
- Control de escritura:
  - el frontend no inserta ni actualiza `invoices` directamente en los paths reales de emision
  - los flujos reales pasan por `saveInvoiceWithLines()`
  - la capa de escritura contrasta numero esperado vs numero persistido antes de confirmar la operacion
- Verificacion SQL que sigue recomendada en Supabase:
  - funciones `find_first_missing_invoice_sequence`, `sync_invoice_numbering`, `save_invoice_with_lines_v2`, `build_client_fiscal_snapshot`, `ensure_invoice_pricing_metadata`, `assert_invoice_numbering_regular`
  - trigger real sobre `public.invoices`
  - emision manual de `0049` para cierre operativo definitivo

## Incidencia 0054 y reconciliacion pendiente

- La reconciliacion app ↔ DB sigue incompleta mientras Supabase no aplique:
  - `sql/20260702_enforce_authoritative_invoice_numbering.sql`
  - `sql/20260702_regularize_unsent_invoice_0054_to_0049.sql`
- Motivo:
  - el frontend ya detecta mismatch y no persiste numeracion en el payload normal
  - aun asi la DB real acepto/persistio `2026-054`
  - eso demuestra desalineacion entre repo y write layer efectiva en Supabase
- Resultado esperado tras aplicar:
  - `INV-0049 / 2026-049` regularizada desde `INV-0054 / 2026-054`
  - siguiente real `INV-0050 / 2026-050`
  - huecos `0`
  - `without_snapshot = 0`
