# Invoice Fiscal Snapshot Audit Backfill QA

## Fecha

- 2026-07-02

## Objetivo

- Auditar por que las facturas historicas no llevaban snapshot fiscal estructurado.
- Garantizar que el PDF y la emision futura lean siempre un snapshot estable.
- Exponer control visible para detectar, reparar y resolver bloqueos fiscales.

## Diagnostico real

- `src/features/invoices/InvoiceDocumentA4.tsx` ya leia bien el snapshot cuando existia.
- El problema real estaba en la cobertura historica:
  - muchas facturas antiguas no tenian `pricing_metadata.client_fiscal_snapshot`
  - un borrador podia necesitar guardarse aunque la ficha fiscal del cliente siguiera incompleta
  - emitir una factura debia seguir bloqueado sin `tax_id` o `billing_address`

## Auditoria real en base

- Lectura real ejecutada el 2026-07-02 sobre `invoices` + `clients`.
- Resultado auditado:
  - total facturas: `44`
  - snapshots completos: `0`
  - reparables desde cliente: `42`
  - bloqueadas por cliente incompleto: `2`

## Bug confirmado en produccion

- Build visible con panel fiscal: `7acf8fa`
- Tras pulsar `Completar reparables`:
  - la UI mostraba toast success
  - el panel seguia en `0 completas / 42 reparables / 2 bloqueadas`
  - SQL seguia confirmando `with_snapshot = 0`
- Causa exacta encontrada:
  - `src/features/invoices/invoiceFiscalSnapshotApi.ts` usaba `update(...).eq('id', ...)` sin `select()` ni read-after-write
  - bajo RLS eso podia devolver `error = null` aunque no se hubiera actualizado ninguna fila visible
  - la UI contaba como exito las facturas detectadas como reparables, no las filas realmente confirmadas por Supabase

## Segunda causa real detectada despues

- La tabla `public.clients` no tiene columna `fiscal_name`.
- Las columnas reales auditadas para el cliente son:
  - `full_name`
  - `tax_id`
  - `billing_address`
  - `email`
- Ademas, varias facturas quedaron con `pricing_metadata` como `array`, no como objeto JSONB.
- En ese estado, aunque dentro del array hubiese wrappers con snapshot, la comprobacion:
  - `pricing_metadata ? 'client_fiscal_snapshot'`
  seguia devolviendo `false`.
- Por eso el panel podia seguir mostrando pendientes aunque hubiera datos fiscales anidados en estructuras corruptas.

## Cambios implementados

- `src/features/clients/clientFiscalData.ts`
  - mantiene el snapshot fiscal normalizado
  - conserva `email` y `source`
- `src/features/invoices/invoiceFiscalSnapshot.ts`
  - valida snapshot
  - clasifica `complete / reparable / incomplete`
  - construye bloqueos compactos
  - expone `shouldShowInvoiceFiscalDebug()`
- `src/features/invoices/invoiceFiscalSnapshotApi.ts`
  - intenta primero la RPC `backfill_invoice_fiscal_snapshots`
  - si la RPC no existe, cae a REST con `select('id,pricing_metadata').maybeSingle()`
  - solo cuenta como reparada una factura cuyo `client_fiscal_snapshot` queda confirmado
  - ya no reporta success si Supabase no confirma ninguna actualizacion
  - mantiene auditoria de escritura en fallback REST
- `src/features/clients/clientFiscalData.ts`
  - acepta `snapshot.fiscal_name || snapshot.name`
  - ignora snapshots corruptos anidados dentro de arrays
- `src/features/invoices/InvoiceDocumentA4.tsx`
  - prioriza `fiscal_name` y, si no existe, `name`
- `src/features/invoices/InvoiceCreateFlow.tsx`
  - permite guardar borrador con ficha fiscal incompleta
  - mantiene bloqueo al emitir si faltan datos fiscales
- `src/features/invoices/InvoiceCreateForm.tsx`
  - replica la misma regla
- `src/features/invoices/InvoiceEditFlow.tsx`
  - mantiene la validacion al editar
- `src/features/invoices/InvoiceDetailCard.tsx`
  - avisa si la factura sigue fiscalmente incompleta
- `src/pages/InvoicesPage.tsx`
  - muestra `Control fiscal de facturas`
  - publica conteos `completas / reparables / incompletas`
  - expone `Completar reparables`
  - expone `Revisar incompletas`
  - muestra JSON compacto con `?debugInvoiceFiscal=1`
  - despliega lista compacta de bloqueadas

## Visibilidad del panel

- El panel ya existia en repo.
- La causa mas probable de que el usuario no lo viera fue el desfase de deploy:
  - la build publica observada seguia en `4fa759d`
  - ese deploy no contenia este bloque de trabajo
- La ubicacion final del panel es:
  - debajo de las KPIs superiores
  - antes del control de numeracion
  - visible aunque no haya factura seleccionada

## Acciones del panel

- `Completar reparables`
  - muestra toast loading: `Completando datos fiscales...`
  - ejecuta backfill autenticado con verificacion de escritura real
  - muestra toast success solo si `repaired > 0`
  - si quedan bloqueadas, muestra toast warning separado
  - si Supabase no confirma ninguna actualizacion, muestra error y no falsea el exito
- `Revisar incompletas`
  - selecciona una factura bloqueada
  - abre una lista compacta con:
    - `display_code`
    - `invoice_number`
    - cliente
    - motivo fiscal faltante
    - acceso rapido a factura o cliente

## Regla operativa final

- `draft`
  - puede guardarse aunque falten datos fiscales
  - queda visible como fiscalmente incompleta
- `issued`
  - bloquea si falta `tax_id` o `billing_address`
- `pricing_metadata.client_fiscal_snapshot`
  - se usa como fuente congelada para PDF y preview
  - no depende del dato vivo del cliente una vez emitida la factura

## Seguridad del backfill

- Solo toca:
  - `pricing_metadata`
  - `updated_at`
- No toca:
  - numeracion
  - importes
  - lineas
  - estado
  - cobros
- No sobreescribe un snapshot ya completo.
- No inventa datos si el cliente sigue incompleto.

## SQL nueva para produccion

- Archivo:
  - `sql/20260702_backfill_invoice_fiscal_snapshots_rpc.sql`
- Crea:
  - `public.backfill_invoice_fiscal_snapshots()`
- Alcance:
  - `security definer`
  - exige `public.require_authenticated_financial_write()`
  - normaliza `pricing_metadata` array/null/scalar a objeto antes del backfill
  - usa `clients.full_name` como `name` y `fiscal_name`
  - rellena solo facturas sin snapshot
  - no toca numeracion, importes, lineas ni estados
  - devuelve `normalized / repaired / blocked / failed` e ids para la UI

## Verificacion final esperada

- Antes del fix:
  - `complete: 0`
  - `repairable: 42`
  - `blocked: 2`
- Despues de ejecutar el backfill con RPC aplicada:
  - `complete: 42`
  - `repairable: 0`
  - `blocked: 2`
- SQL esperada:
  - `with_snapshot: 42`
  - `without_snapshot: 2`

## Tests

- `src/features/invoices/invoiceFiscalSnapshot.test.ts`
  - detecta snapshot completo
  - detecta facturas reparables
  - conserva bloqueadas las incompletas
  - no sobreescribe snapshots completos
  - construye bloqueos compactos
  - activa debug solo con query param
- `src/features/invoices/invoiceFiscalSnapshotApi.test.ts`
  - no cuenta writes REST sin fila confirmada
  - exige `client_fiscal_snapshot` en read-after-write
  - usa RPC si existe y fallback REST si no
- `src/pages/InvoicesPage.test.ts`
  - renderiza el panel real
  - muestra `Completar reparables`
  - muestra `Revisar incompletas`
  - enseña JSON solo con `?debugInvoiceFiscal=1`

## Limite real de este QA

- Este documento no afirma que las `42` facturas reparables ya se hayan escrito en base.
- El repo deja de falsear el exito aunque la DB no escriba.
- La persistencia batch robusta en produccion depende de aplicar `sql/20260702_backfill_invoice_fiscal_snapshots_rpc.sql`.
- La ejecucion real del backfill debe confirmarse en una sesion autenticada despues del deploy y de aplicar esa SQL.
