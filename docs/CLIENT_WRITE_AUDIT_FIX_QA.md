# Client Write Audit Fix QA

Fecha: 2026-06-30

## Bug reportado

- En la edicion directa de clientes, al pulsar `Guardar cambios`, la UI mostraba:
  - `Cannot coerce the result to a single JSON object`

## Causa real

- Las escrituras de clientes ya estaban centralizadas en `src/features/clients/clientWriteApi.ts`, pero esa API seguia usando `.select(...).single()` tanto en `createClientRecord` como en `updateClientRecord`.
- Si Supabase devolvia 0 filas por permisos/RLS o devolvia un array en vez de objeto unico, `.single()` arrojaba el error crudo de coercion.
- Ese error llegaba a la UI de edicion directa de clientes sin una capa de traduccion suficientemente robusta.

## Archivos auditados

- `src/features/clients/clientWriteApi.ts`
- `src/features/clients/clientFiscalData.ts`
- `src/features/clients/clientFiscalBackfill.ts`
- `src/features/clients/ClientCreateForm.tsx`
- `src/features/clients/ClientDetailCard.tsx`
- `src/features/clients/ClientBillingDetailsInlineForm.tsx`
- `src/pages/ClientsPage.tsx`
- `src/features/invoices/InvoiceCreateFlow.tsx`
- `src/features/invoices/InvoiceCreateForm.tsx`
- `src/app/appDataApi.ts`
- `src/features/clients/types.ts`

## Archivos modificados

- `src/features/clients/clientWriteApi.ts`
- `src/features/clients/clientWriteApi.test.ts`
- `docs/CLIENT_WRITE_AUDIT_FIX_QA.md`
- `docs/FISCAL_CLIENT_DATA_FIX_QA.md`

## Flujos que escriben clientes

- Creacion de cliente:
  - `ClientCreateForm.tsx` -> `createClientRecord`
- Edicion directa de cliente:
  - `ClientDetailCard.tsx` -> `updateClientRecord`
- Guardado fiscal inline:
  - `ClientBillingDetailsInlineForm.tsx` -> `updateClientFiscalData`
- Backfill interno:
  - `clientFiscalBackfill.ts` -> `updateClientFiscalData`

## Que estaba roto

- `.single()` asumía una unica fila sin controlar:
  - 0 filas actualizadas
  - multiples filas devueltas
  - coercion interna de Supabase al intentar convertir array a objeto
- El write API no validaba `clientId` vacio antes del `update`.
- El mensaje interno de coercion podia filtrarse a la UI.

## Como se centralizo la escritura

- Todas las escrituras de `clients` siguen pasando por `clientWriteApi.ts`.
- Ya no hay llamadas directas a `rest/v1/clients` en `src/`.
- `clientWriteApi.ts` ahora:
  - valida `clientId`
  - usa `.select(...)` sin `.single()`
  - inspecciona el numero real de filas devueltas
  - lanza mensajes controlados para 0 filas o multiples filas
  - traduce el error interno `Cannot coerce the result to a single JSON object` a un mensaje util

## Como se arreglo la edicion directa

- `ClientDetailCard.tsx` ya usaba la API central.
- El fix real estuvo en estabilizar `updateClientRecord`.
- Ahora `Guardar cambios`:
  - no depende de `.single()`
  - obtiene una sola fila por control explicito
  - falla con mensaje util si no hay fila actualizada o si la respuesta es ambigua

## Como se confirmo el guardado fiscal inline

- `ClientBillingDetailsInlineForm.tsx` sigue usando `updateClientFiscalData`.
- Ese flujo ya quedo montado sobre la API segura autenticada.
- La auditoria critica confirma que el inline fiscal ya no usa REST directo y hereda la misma proteccion contra 0 filas, multiples filas y mensajes internos ambiguos.

## Como se evitan `.single()` inseguros

- Se sustituyo el patron por:
  - `.select(...)`
  - validacion manual del array devuelto
- Casos controlados:
  - `rows.length === 0`
  - `rows.length > 1`
  - `clientId` vacio
  - error de coercion interno de Supabase

## Normalizacion fiscal confirmada

- Campo fiscal definitivo: `tax_id`
- Campo de direccion fiscal/facturacion definitivo: `billing_address`
- Helper compartido:
  - `normalizeClientFiscalData`
  - `getClientFiscalData`
  - `hasCompleteClientFiscalData`

## Tests y validaciones

Tests añadidos/actualizados:

- `src/features/clients/clientWriteApi.test.ts`
- `src/features/clients/clientFiscalData.test.ts`

Cobertura relevante:

- `clientId` vacio
- respuesta con 0 filas
- respuesta con multiples filas
- traduccion del error `Cannot coerce...`
- coherencia entre normalizacion fiscal y escritura

Validaciones ejecutadas:

- `npm run lint`
- `npm run build`
- `npm run test`

## Limitaciones pendientes

- No se pudo hacer QA manual autenticado completo desde navegador embebido sin sesion real del CRM.
- El backfill sigue siendo utilidad interna sin UI, por diseno deliberado de bajo riesgo.
