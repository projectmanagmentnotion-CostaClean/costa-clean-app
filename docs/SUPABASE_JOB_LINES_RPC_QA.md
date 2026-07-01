# Supabase Job Lines RPC QA

## Estado del sprint

- Fecha de verificacion: 2026-07-01.
- Objetivo: confirmar si la base real de Supabase ya tiene `job_lines` y `save_job_with_lines` operativos para el codigo introducido en `baa216e`.
- Alcance ejecutado: auditoria de repo, probes REST/RPC contra Supabase real con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, tests unitarios, validacion de build y migracion minima de permisos reproducibles.

## Migraciones existentes en repo

- `sql/20260629_create_job_lines_and_save_job_with_lines.sql`
  - crea `public.job_lines`
  - crea indice `job_lines_job_id_sort_order_idx`
  - crea `public.save_job_with_lines(jsonb, jsonb)`
- `sql/20260413_harden_financial_rpc_permissions.sql`
  - define `public.require_authenticated_financial_write()`
  - endurece varias RPC financieras previas, pero no incluia `save_job_with_lines` porque todavia no existia

## Estado del codigo

- `src/features/jobs/jobWriteApi.ts` llama `save_job_with_lines` con `p_job` y `p_lines`.
- `src/features/jobs/jobBilling.ts` usa `job.billing_lines` como fuente primaria y deja fallback legacy solo cuando no hay lineas persistidas.
- `src/app/appDataApi.ts` lee `job_lines` por REST y las agrupa por `job_id`.
- `src/app/entitySchemas.ts` y `src/app/relationships.ts` ya modelan `job_lines`.

## Resultado de diagnostico real contra Supabase

### 1. Tabla `job_lines`

Probe ejecutado:

- `GET /rest/v1/job_lines?select=id,job_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at&limit=1`

Resultado:

- HTTP `200`
- Respuesta `[]`

Conclusion:

- la tabla `public.job_lines` existe
- el rol `anon` del proyecto puede leerla por REST
- no habia filas visibles en la muestra tomada

### 2. Columnas esperadas

Probe ejecutado:

- `GET /rest/v1/job_lines?select=id,job_id,updated_at&limit=1`

Resultado:

- HTTP `400`
- error: `column job_lines.updated_at does not exist`

Conclusion:

- la tabla real coincide con el esquema del repo en algo importante: tiene `created_at` pero no `updated_at`
- esto encaja con `sql/20260629_create_job_lines_and_save_job_with_lines.sql`

### 3. RPC `save_job_with_lines`

Probe ejecutado:

- `POST /rest/v1/rpc/save_job_with_lines` con payload controlado de 1 job y 1 linea

Resultado:

- HTTP `400`
- mensaje: `Authentication required for financial writes.`

Conclusion:

- la RPC existe y esta registrada en Supabase real
- la llamada alcanzo el cuerpo de la funcion y fallo exactamente en `require_authenticated_financial_write()`
- eso confirma que no estamos ante "funcion inexistente"

## Estado de policies / RLS

No fue posible inspeccionar `pg_policies` ni `information_schema` desde este entorno porque solo habia acceso con `VITE_SUPABASE_ANON_KEY`:

- `GET /rest/v1/pg_policies?...` devolvio `404` fuera del schema cache expuesto
- `GET /rest/v1/information_schema.columns?...` devolvio `404`
- `GET /rest/v1/information_schema.routines?...` devolvio `404`

Conclusion operativa:

- no pude auditar las policies reales con visibilidad SQL completa
- si pude confirmar por comportamiento que `anon` puede leer `job_lines`
- si pude confirmar por comportamiento que `save_job_with_lines` existe y exige autenticacion antes de escribir

## Migracion creada/corregida

Se anadio:

- `sql/20260701_harden_job_lines_rpc_permissions.sql`

Que hace:

- `grant usage on schema public to anon, authenticated`
- `grant select on public.job_lines to anon, authenticated`
- `revoke execute on function public.save_job_with_lines(jsonb, jsonb) from public, anon`
- `grant execute on function public.save_job_with_lines(jsonb, jsonb) to authenticated`

Motivo:

- la verificacion real mostro que `anon` ya alcanza la RPC hoy
- el repo no dejaba explicito ese contrato de permisos para nuevas bases
- esta migracion hace reproducible el comportamiento deseado: lectura REST del detalle y escritura solo por usuario autenticado

## Test real de guardar 3 lineas

No se pudo ejecutar desde este entorno.

Motivo:

- no habia CLI de Supabase
- no habia conexion SQL directa
- no habia credenciales de usuario autenticado reutilizables desde terminal
- el unico acceso disponible era `anon`, y la RPC bloquea correctamente la escritura con `Authentication required for financial writes.`

Estado:

- test de escritura real pendiente
- la verificacion alcanzada fue de existencia y guardia de autenticacion, no de persistencia end-to-end con sesion valida

## Alineacion con JobCreateFlow

- El codigo actual ya usa `saveJobWithLines()` en los flows de alta y edicion.
- La base real ya tiene `job_lines` y `save_job_with_lines`.
- La parte todavia no validada en vivo es la escritura autenticada completa con 3 lineas y su relectura posterior en `appDataApi`.
- Desde este turno, `src/features/jobs/jobWriteApi.ts` fuerza la llamada a `save_job_with_lines` mediante `POST /rest/v1/rpc/save_job_with_lines` con bearer token de la sesion activa.

## Tests anadidos

- `src/features/jobs/jobWriteApi.test.ts`
  - asegura que el payload conserva multiples lineas, conceptos y `sort_order`
  - asegura que el guardado usa bearer token autenticado
  - asegura que los fallos de sesion se traducen a un mensaje accionable
- `src/features/jobs/jobBilling.test.ts`
  - asegura que `jobBilling` usa `job_lines` cuando existen
  - asegura que el fallback legacy solo corre cuando no hay lineas persistidas

## Validaciones ejecutadas

- `npm run lint`
- `npm run test`
- `npm run build`

Todas en verde tras los cambios de este sprint.

## Limitaciones reales

- No hay `supabase/` ni CLI enlazada en este checkout.
- No hay acceso SQL privilegiado desde este entorno para inspeccionar `pg_policies`, `grants` o ejecutar una escritura autenticada controlada.
- La nueva migracion de permisos quedo en repo pero no se aplico a la base desde aqui.

## Que probar manualmente en la app

1. Iniciar sesion real en la app.
2. Crear un servicio con 3 lineas distintas.
3. Guardar y confirmar que no aparece el error de autenticacion.
4. Refrescar la pagina.
5. Confirmar que el servicio sigue mostrando 3 lineas.
6. Verificar en el workspace de servicio que no cae al resumen legacy si existen `job_lines`.
7. Crear factura desde ese servicio.
8. Confirmar que la factura hereda las 3 lineas intactas.
9. Si falla el guardado, revisar la consola DEV: `jobWriteApi` ahora deja trazas con `job_id`, `line_count`, resumen de lineas y error devuelto por la RPC.
