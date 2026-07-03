# Client Creation DB Audit QA

## Fecha

- 2026-07-03

## Resumen ejecutivo

- La causa real del error de produccion estaba en el repo, no en el formulario visible.
- `ClientCreateForm` enviaba el alta al write API con `id`.
- `createClientRecord()` volvia a pasar por `buildClientPayload()`.
- `buildClientPayload()` descartaba `id`.
- Resultado: el `POST /rest/v1/clients` salia sin `id` y Supabase respondia `23502 null value in column "id"`.

## Evidencia verificada en DB real

- `GET /rest/v1/clients?select=id&limit=1` con el token publico devolvio una fila real con `id = HIST-CLIENT-50280522F1ECD425`.
- `POST /rest/v1/clients` sin `id`, con solo `full_name` y `status`, devolvio exactamente:

```json
{
  "code": "23502",
  "details": null,
  "hint": null,
  "message": "null value in column \"id\" of relation \"clients\" violates not-null constraint"
}
```

## Limite de auditoria DB

- No fue posible consultar `information_schema.columns` con el token publico disponible en `.env.local`.
- `GET /rest/v1/information_schema.columns?...` devolvio `PGRST205`, porque esa metadata no esta expuesta en el schema cache publico.
- Con el acceso disponible, si se puede afirmar esto:
  - `clients.id` es efectivamente `NOT NULL` en produccion
  - no existe un default efectivo aplicable al `POST` anonimo actual

## Entradas auditadas

| Entrada | Archivo / ruta real | Mecanismo | Genera id | Estado |
| --- | --- | --- | --- | --- |
| Nuevo cliente desde Clientes | `src/pages/ClientsPage.tsx` -> `src/features/clients/ClientCreateForm.tsx` -> `src/features/clients/clientWriteApi.ts` | REST `POST /clients` | Ahora si, centralizado en app | Corregido |
| Nuevo cliente desde Presupuestos | `src/features/quotes/QuoteCreateForm.tsx`, `QuoteCreateFlow.tsx` | Reusa `ClientCreateForm` | Ahora si, centralizado en app | Corregido |
| Nuevo cliente desde Servicios | `src/features/jobs/JobCreateForm.tsx`, `JobCreateFlow.tsx` | Reusa `ClientCreateForm` | Ahora si, centralizado en app | Corregido |
| Nuevo cliente desde Propiedades | `src/features/properties/PropertyCreateForm.tsx`, `PropertyCreateFlow.tsx` | Reusa `ClientCreateForm` | Ahora si, centralizado en app | Corregido |
| Nuevo cliente desde Facturas | `src/features/invoices/InvoiceCreateForm.tsx`, `InvoiceCreateFlow.tsx` | Reusa `ClientCreateForm` | Ahora si, centralizado en app | Corregido a nivel de componente compartido |
| Nuevo cliente desde planes recurrentes | `src/features/recurringInvoices/RecurringInvoicePlanFlow.tsx` | Reusa `ClientCreateForm` | Ahora si, centralizado en app | Corregido |
| Lead -> cliente | `src/features/financial/financialWriteApi.ts` -> RPC `convert_lead_to_client` -> `sql/20260420_lead_owned_quotes_and_acceptance_rpc.sql` | RPC SQL | Si, con `CLIENT-` o `p_client_id` | Ya era seguro |
| Presupuesto aceptado que convierte lead | `src/features/quotes/quoteAcceptanceWorkflow.ts` -> `acceptQuoteWorkflow()` | RPC SQL | Si, via conversion SQL | Ya era seguro |
| Import historico | `scripts/import-historical-invoices.mjs` | upsert batch | Si, ids deterministas `...-CLIENT-...` | Sin cambio |

## Causa exacta

- Archivo: `src/features/clients/clientWriteApi.ts`
- Funcion: `buildClientPayload()`
- Bug: no copiaba `input.id` al payload final.
- Impacto: todas las altas que reutilizan `ClientCreateForm` fallaban contra una tabla `clients` cuyo `id` no admite `null`.

## Fix aplicado

### Nueva capa central

- `src/features/clients/clientIdentity.ts`

Funciones nuevas:

- `createClientId()`
- `trimNullable()`
- `normalizeClientStatus()`
- `normalizeClientInput()`
- `validateClientForCreate()`

### Reglas ahora vigentes

- Toda alta nueva de cliente genera `CLIENT-${uuid}` si no llega `id`.
- Si llega un `id` historico o importado, se preserva.
- `full_name` se valida antes de escribir.
- `status` cae por defecto en `active`.
- `phone`, `email`, `tax_id`, `billing_address`, `source_lead_id` se normalizan antes del write.
- `createClientRecord()` es ahora el punto unico de alta REST.

### Ajuste de formulario

- `ClientCreateForm` ya no construye `id`.
- El formulario solo entrega datos crudos al write API.
- El write API decide identidad y normalizacion.

## Safety net SQL

- No se aplico ningun cambio SQL en este sprint.
- Recomendacion si el equipo quiere red de seguridad adicional en DB:

```sql
alter table public.clients
alter column id set default ('CLIENT-' || gen_random_uuid()::text);
```

- Estado actual: pendiente de decision explicita y de ejecucion manual en Supabase.

## Fiscal y snapshots

- `src/features/clients/clientFiscalData.ts` sigue tomando el nombre fiscal desde `clients.full_name`.
- No hay paths activos que lean una columna `clients.fiscal_name`.
- `tax_id` y `billing_address` se normalizan al crear cliente.
- Un cliente nuevo puede crearse sin datos fiscales completos.
- La emision de factura sigue bloqueandose si faltan `tax_id` o `billing_address`, sin romper la creacion del cliente.

## Tests añadidos o reforzados

- `src/features/clients/clientIdentity.test.ts`
- `src/features/clients/clientWriteApi.test.ts`

Cobertura añadida:

- genera `id` cuando falta
- preserva ids historicos
- normaliza `status`, `tax_id`, `billing_address`, `phone`, `email`
- el payload REST de alta siempre incluye `id`
- traduce `23502` de `clients.id` a un mensaje util
- `ClientCreateForm` no llama Supabase directo y delega en `createClientRecord()`

## QA local ejecutado

- `npm run lint`
- `npm test`
- `npm run build`

## QA online pendiente

1. Esperar a que el deploy de `main` publique el commit del fix.
2. Abrir `https://app.costacleanbcn.com/?debugBuild=1`.
3. Crear el cliente real del caso reportado.
4. Confirmar por SQL o vista de clientes:
   - `id` no nulo
   - prefijo `CLIENT-` o id definido por app
   - `status = active`
   - `tax_id` guardado
   - `billing_address` guardada

## Prueba controlada contra DB real

- Se ejecuto una alta temporal desde el write API del repo, sin pasar `id` de entrada.
- Resultado persistido en DB:
  - `id`: `CLIENT-ce90dbfc-4e4a-41b8-99e7-ef1a30cf67f8`
  - `display_code`: `CLI-0036`
  - `full_name`: `ZZZ Codex Audit Client Creation 2026-07-03T09-55-12-284Z`
  - `email`: `codex-audit-client-2026-07-03T09-55-12-284Z@example.com`
  - `status`: `inactive`
- Esto confirma que:
  - el write API ya genera y envia `id`
  - Supabase acepta el insert
  - la fila queda disponible por REST inmediatamente despues del write

## Riesgos pendientes

- Sigue sin haber evidencia de un default DB para `clients.id`.
- El fix actual deja a la app autoritativa para ids de clientes REST.
- Si existen flujos externos a este repo que inserten en `public.clients`, seguiran necesitando generar `id` o un default DB explicito.
