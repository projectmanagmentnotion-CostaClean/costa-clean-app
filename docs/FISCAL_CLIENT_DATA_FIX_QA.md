# Fiscal Client Data Fix QA

Fecha: 2026-06-30

## Bug detectado

- En el flujo de emision de factura, el bloque `Completar datos fiscales aqui mismo` permitia escribir NIF/CIF y direccion.
- Al pulsar `Guardar datos fiscales`, el flujo seguia mostrando:
  - `No puedes emitir todavia`
  - `No se pudo completar el flujo`
  - `Faltan NIF/CIF o direccion de facturacion en la ficha del cliente`

## Causa real encontrada

- `ClientBillingDetailsInlineForm` actualizaba `clients` por REST directo usando `Authorization: Bearer <anon_key>`.
- Ese write path no reutilizaba la sesion autenticada normal del CRM y dependia de permisos anonimos/RLS.
- El modelo real del cliente si valida contra `tax_id` y `billing_address`, asi que no era un problema de nombres de campo.
- Ademas, el flow podia conservar `submitError` anterior aunque el cliente quedara completo, porque no se limpiaba explicitamente tras el guardado fiscal.

## Archivos revisados

- `src/features/invoices/InvoiceCreateFlow.tsx`
- `src/features/clients/ClientBillingDetailsInlineForm.tsx`
- `src/features/clients/ClientDetailCard.tsx`
- `src/features/clients/ClientCreateForm.tsx`
- `src/features/clients/types.ts`
- `src/features/invoices/types.ts`
- `src/features/financial/financialWriteApi.ts`
- `src/app/appDataApi.ts`
- `src/app/AppShell.tsx`
- `src/lib/supabase.ts`
- `src/lib/supabaseRest.ts`

## Archivos modificados

- `src/features/clients/ClientBillingDetailsInlineForm.tsx`
- `src/features/clients/ClientCreateForm.tsx`
- `src/features/clients/ClientDetailCard.tsx`
- `src/features/clients/clientFiscalData.ts`
- `src/features/clients/clientFiscalBackfill.ts`
- `src/features/clients/clientWriteApi.ts`
- `src/features/invoices/InvoiceCreateFlow.tsx`
- `src/features/invoices/InvoiceCreateForm.tsx`
- `src/features/clients/clientFiscalData.test.ts`

## Que se corrigio en Guardar datos fiscales

- El boton ahora normaliza y valida `tax_id` y `billing_address`.
- El guardado ya no usa REST anonimo directo; usa cliente Supabase autenticado del repo.
- Se espera el `update` real antes de continuar.
- Si el guardado termina bien:
  - se refresca `appData`
  - se limpia el error fiscal previo del flow
  - la ficha fiscal visible se reevalua en el mismo paso
  - se muestra feedback de exito
- Si falla:
  - el usuario ve error util
  - los campos escritos no se pierden
  - el boton queda en estado `Guardando...` mientras persiste

## Como se revalida el flujo

- `InvoiceCreateFlow` usa ahora helper fiscal compartido para leer completitud real del cliente.
- Tras `onSaved`, el flow hace `await onRefreshData()` y limpia el error fiscal pendiente.
- Si `tax_id` y `billing_address` ya estan completos, desaparece el bloqueo de emision sin salir del fullscreen flow.

## Helper fiscal creado

- `src/features/clients/clientFiscalData.ts`

Responsabilidades:

- normalizar NIF/CIF y direccion
- obtener estado fiscal del cliente
- determinar completitud y campos faltantes
- generar snapshot fiscal estructurado para facturas nuevas
- extraer snapshot fiscal desde facturas que ya lo tengan en `pricing_metadata`

## Como funciona el backfill desde facturas emitidas

- `src/features/clients/clientFiscalBackfill.ts`
- Solo considera facturas con estado `issued` o `paid`.
- Solo usa snapshot fiscal estructurado dentro de `pricing_metadata`.
- Solo completa campos vacios del cliente.
- No sobrescribe datos fiscales existentes.
- Si varias facturas aportan valores distintos para el mismo campo faltante, se marca conflicto y no se aplica automaticamente.
- Si una factura no trae snapshot estructurado, no se inventa nada ni se parsea desde texto libre o PDF.

## Datos que no se inventan

- No se hardcodearon NIF/CIF ni direcciones del ejemplo aportado.
- No se extraen datos desde imagenes, texto externo ni OCR.
- No se parsea HTML/PDF de factura como fuente fiscal.
- El backfill solo usa datos estructurados ya persistidos en la app.

## Conflictos detectados

- conflicto por `tax_id`
- conflicto por `billing_address`

Cuando existe conflicto:

- no se elige automaticamente
- no se actualiza el cliente
- queda reportado por el plan de backfill

## UI de backfill

- No se anadio boton UI en esta fase.
- Se deja utilidad interna segura y testeada.
- Motivo: primero habia que corregir persistencia y limitar el backfill a snapshots fiscales reales; la base actual de facturas antiguas puede no tenerlos todavia.

## Validaciones ejecutadas

- `npm run lint`
- `npm run build`
- `npm run test`

## Auditoria relacionada

- Ver tambien `docs/CLIENT_WRITE_AUDIT_FIX_QA.md` para el cierre estructural de todas las escrituras de clientes y la eliminacion del patron inseguro con `.single()`.
- Ver tambien `docs/CLIENT_FISCAL_BACKFILL_APPLIED_QA.md` para la corrida real del backfill sobre facturas emitidas/pagadas ya existentes.

## Cierre posterior del backfill real

- Se ejecuto una auditoria real posterior sobre `clients` e `invoices`.
- Resultado: 43 facturas `issued`/`paid`, 43 con `client_id` y 0 con snapshot fiscal estructurado en `pricing_metadata`.
- No se aplicaron cambios a clientes historicos porque no existia fuente estructurada suficiente para hacerlo sin inventar datos.
- La utilidad de backfill quedo reforzada para soportar updates parciales seguros y forzar `status: active` solo en clientes realmente actualizados.
