# Invoice Emission Total Audit 2026-07-02

## Estado real auditado

- Supabase visible por REST con `anon`:
  - `INV-0045 / 2026-045`: existe, regularizada desde `0050`, con snapshot fiscal.
  - `INV-0046 / 2026-046`: existe, regularizada desde `0051`, con snapshot fiscal.
  - `INV-0047` a `INV-0051`: no existen como numeros activos.
  - `INV-0052 / 2026-052`: existe, `status = issued`, sin snapshot fiscal, sin senales de envio/exportacion.
- Cliente de `INV-0052`:
  - `Josefa Mas Grassot`
  - `tax_id = 38696030W`
  - `billing_address = ,C/Colon, 12, 1-D, Playa Arinaga 35118 Gran Canarias`
- Build publica visible en `https://app.costacleanbcn.com/?debugBuild=1`:
  - `build 5c99060`

## Diagnostico raiz

La incidencia no es un unico bug. Son dos fallos de rollout simultaneos:

1. La base sigue ejecutando la logica vieja de numeracion.
   - Evidencia: despues de existir `0045` y `0046`, una nueva emision produjo `0052`.
   - Eso solo encaja con la logica vieja `max + 1`.
   - La migracion local `sql/20260702_fix_invoice_save_readback_and_gap_sequence.sql` no estaba aplicada en Supabase.

2. La app publica sigue en build `5c99060`.
   - Esa build todavia no incluye el cambio local para intentar `save_invoice_with_lines_v2`.
   - Por eso el StepFlow puede seguir mostrando `No se pudo leer la factura guardada.` despues de escribir.

## Matriz de entradas auditadas

| Entrada | Archivo | Funcion | Usa `save_invoice_with_lines_v2` | Snapshot fiscal | Control de huecos antes de escribir | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| Factura manual nueva | `src/features/invoices/InvoiceCreateFlow.tsx` | `handleSave()` | Si, via `saveInvoiceWithLines()` local | Si en frontend; ahora tambien endurecido en SQL | Si en frontend; ahora tambien endurecido en SQL | Corregido en repo, pendiente deploy + SQL |
| Factura desde servicio/job | `src/features/invoices/InvoiceCreateFlow.tsx` | `handleSave()` con `prefill` de job | Si | Si | Si | Corregido en repo, pendiente deploy + SQL |
| Factura desde presupuesto/quote | `src/features/invoices/InvoiceCreateFlow.tsx` | `handleSave()` con `origin_mode = quote` | Si | Si | Si | Corregido en repo, pendiente deploy + SQL |
| Emitir borrador / editar factura | `src/features/invoices/InvoiceEditFlow.tsx`, `src/features/invoices/InvoiceDetailCard.tsx` | `handleSave()` / `saveInvoiceEdits()` | Si | Si | Si | Corregido en repo, pendiente deploy + SQL |
| Duplicar factura | `src/pages/InvoicesPage.tsx` + `invoiceDuplicatePrefill.ts` | reutiliza `InvoiceCreateFlow` | Si | Si | Si | Corregido en repo, pendiente deploy + SQL |
| Crear factura desde cobro | `src/features/payments/PaymentCreateFlow.tsx`, `PaymentCreateForm.tsx` | incrusta `InvoiceCreateFlow` | Si | Si | Si | Corregido en repo, pendiente deploy + SQL |
| Crear factura desde workspace cliente/job/propiedad | `ClientWorkspace.tsx`, `JobWorkspace.tsx`, `PropertyWorkspace.tsx` | cargan `InvoiceCreateFlow` | Si | Si | Si | Corregido en repo, pendiente deploy + SQL |
| Aceptar presupuesto y crear factura | `src/features/quotes/quoteAcceptanceWorkflow.ts`, SQL `accept_quote_workflow` | RPC directa | No en frontend; SQL directo | Antes no garantizado; ahora endurecido en SQL | Antes no; ahora endurecido en SQL | Corregido en repo SQL, pendiente aplicar |
| Factura recurrente | `src/features/recurringInvoices/recurringInvoiceApi.ts`, SQL `generate_invoice_from_recurring_plan` | RPC directa | No en frontend; SQL directo | Antes no garantizado; ahora endurecido en SQL | Antes no; ahora endurecido en SQL | Corregido en repo SQL, pendiente aplicar |
| `InvoiceCreateForm.tsx` legado | `src/features/invoices/InvoiceCreateForm.tsx` | formulario antiguo | No montado en rutas reales auditadas | Parcial | No | Codigo legado no montado; no identificado como via real actual |

## Cambios preparados en repo

- `src/features/financial/financialWriteApi.ts`
  - intenta `save_invoice_with_lines_v2`
  - cae a `save_invoice_with_lines` solo si el RPC nuevo aun no existe
- `sql/20260702_fix_invoice_save_readback_and_gap_sequence.sql`
  - agrega `find_first_missing_invoice_sequence`
  - agrega `save_invoice_with_lines_v2`
- `sql/20260702_harden_invoice_emission_core.sql`
  - hace autoritativa la capa SQL para facturas normales
  - agrega `build_client_fiscal_snapshot`
  - agrega `ensure_invoice_pricing_metadata`
  - agrega `assert_invoice_numbering_regular`
  - endurece `save_invoice_with_lines`
  - endurece `accept_quote_workflow`
- `sql/20260702_harden_invoice_emission_recurring_optional.sql`
  - redefine `generate_invoice_from_recurring_plan` solo si existe `public.recurring_invoice_plans`
- `sql/20260702_harden_invoice_emission_paths.sql`
  - primer intento combinado
  - queda supersedido para aplicar en entornos sin tabla recurrente
- `sql/20260702_regularize_unsent_invoice_0052_to_0047.sql`
  - regularizacion idempotente de `0052 -> 0047`

## Cierre real pendiente

El sprint no puede darse por cerrado hasta hacer estas acciones sobre Supabase real:

1. aplicar `sql/20260702_fix_invoice_save_readback_and_gap_sequence.sql`
2. aplicar `sql/20260702_harden_invoice_emission_core.sql`
3. aplicar `sql/20260702_harden_invoice_emission_recurring_optional.sql` solo si el producto usa recurrentes y la tabla existe
4. aplicar `sql/20260702_regularize_unsent_invoice_0052_to_0047.sql`
5. volver a auditar `0045` a `0052`
6. confirmar:
   - `huecos = 0`
   - `INV-0047 / 2026-047` existe
   - `INV-0052 / 2026-052` ya no existe como numero activo
   - snapshots fiscales completos
   - siguiente numero `INV-0048 / 2026-048`

## Limitacion de este entorno

Desde este entorno no habia:

- `SUPABASE_SERVICE_ROLE_KEY`
- `supabase` CLI enlazada
- sesion autenticada reutilizable en el navegador interno para operar Supabase

Por tanto se pudo auditar la DB por lectura REST, pero no aplicar SQL directamente.
