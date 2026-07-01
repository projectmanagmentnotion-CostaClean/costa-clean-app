# Job Form State Lines Final Fix QA

## Fecha

- 2026-07-01

## Bug persistente reportado

- La DB podia tener `line_count = 3` para un servicio como `JOB-0052`.
- El editor seguia mostrando una sola linea editable con el total agregado.
- Al anadir una linea nueva y guardar, el problema reaparecia como compactacion del estado editable o del submit.

## Evidencia

- Supabase ya devolvia servicios nuevos con `job_lines` reales.
- La UI de edicion seguia abriendo con:
  - `CONCEPTO 1`
  - concepto legacy
  - importe total agregado
- El problema ya no estaba en RPC ni permisos, sino en estado interno y adapters del formulario.

## Causa exacta encontrada

- `src/app/appDataApi.ts` ya cargaba `job_lines` y las adjuntaba a `job.billing_lines`.
- `src/features/jobs/JobDetailCard.tsx` si abria el editor desde `getJobBillingDraftLines(job)`.
- La compactacion restante estaba en el adapter editable:
  - `src/features/jobs/jobBilling.ts`
  - usaba validacion directa sobre valores crudos
  - si PostgREST devolvia numericos como texto, las lineas reales se descartaban y el editor caia al fallback legacy
- Faltaba un helper unico que separara:
  - display
  - editable state
  - fallback legacy

## Archivo exacto y tipo de bug

- Tipo real: adapter editable + normalizacion insuficiente, no RPC.
- Archivo principal original: `src/features/jobs/jobBilling.ts`
- Archivos finales del fix:
  - `src/features/jobs/jobEditableLines.ts`
  - `src/features/jobs/jobBilling.ts`
  - `src/app/appDataApi.ts`
  - `src/features/jobs/JobDetailCard.tsx`
  - `src/features/jobs/jobWriteApi.ts`

## Nuevo helper de lineas editables

- `src/features/jobs/jobEditableLines.ts`

Expone:

- `buildEditableJobLinesFromJob(job)`
- `normalizeEditableJobLines(lines)`
- `buildLegacyEditableLine(job)`

Reglas:

1. Si existen `billing_lines` validas, se usan siempre.
2. Los numericos aceptan `string` o `number`.
3. El fallback legacy solo corre si no hay lineas persistidas utilizables.
4. Los helpers de display no alimentan formularios editables.

## Logs DEV anadidos

- `appDataApi.ts`
  - `[appDataApi] jobs billing lines grouped`
- `JobDetailCard.tsx`
  - `[JobDetailCard] open edit job`
  - `[JobDetailCard] initial billing lines`
  - `[JobDetailCard] submit lines`
- `jobWriteApi.ts`
  - `[jobWriteApi] rpc p_lines`

Todos quedan solo en DEV.

## Como se corrigio la inicializacion

- `JobDetailCard` sigue inicializando desde el job real, pero ahora usa la ruta editable consolidada y normalizada.
- `appDataApi.ts` normaliza `sort_order`, `quantity`, `unit_price` y `line_subtotal` antes de adjuntar `billing_lines`.
- `jobBilling.ts` reutiliza `normalizeEditableJobLines()` y `buildEditableJobLinesFromJob()`.

## Como se corrigio anadir linea

- El estado editable sigue siendo un array real de lineas.
- Anadir linea hace append sobre el array actual.
- No se modifica el concepto de la primera linea.
- No se recalcula una linea resumen para reemplazar el estado.

## Como se corrigio submit

- El submit sigue usando el array real `billingLines`.
- Antes de RPC se deja log DEV del conteo real.
- `jobWriteApi` deja log DEV de `p_lines.length` y conceptos.
- `buildJobBillingSummary()` solo mantiene campos legacy del job; no reemplaza `p_lines`.

## Tests anadidos o actualizados

- `src/features/jobs/jobEditableLines.test.ts`
  - 3 `billing_lines` con numericos string producen 3 lineas editables
  - fallback legacy solo sin lineas
  - al expandir a 4 lineas el estado sigue expandido
- `src/features/jobs/jobBilling.test.ts`
  - verifica que `getJobBillingDraftLines()` crea 3 bloques editables
  - verifica que las lineas string no se descartan

## QA manual

- No se pudo hacer QA autenticada en navegador dentro de este turno.
- Logs exactos a revisar en DEV:
  - `[appDataApi] jobs billing lines grouped`
  - `[JobDetailCard] open edit job`
  - `[JobDetailCard] initial billing lines`
  - `[JobDetailCard] submit lines`
  - `[jobWriteApi] rpc p_lines`
- Para la visibilidad del editor real, el debug ya no depende solo de `import.meta.env.DEV`.
- Si el usuario abre un runtime donde DEV sea false, puede forzarlo con `?debugJobLines=1`.
- Seguimiento detallado del bloqueo visual:
  - `docs/JOB_EDITOR_DEBUG_VISIBILITY_BLOCKER_QA.md`
- Seguimiento especifico de publicacion online y version servida:
  - `docs/ONLINE_DEPLOY_VERSION_QA.md`
- Seguimiento especifico del corte de lectura `appData -> editor`:
  - `docs/JOB_LINES_APPDATA_TO_EDITOR_FIX_QA.md`

## SQL de verificacion

```sql
select
  job_id,
  sort_order,
  concept,
  quantity,
  unit,
  unit_price,
  line_subtotal
from public.job_lines
where job_id = 'JOB-4a5bdfcc-cd2a-4d1e-ae9e-91a804df49b0'
order by sort_order asc;
```

```sql
select
  j.id,
  j.display_code,
  count(jl.id) as line_count,
  coalesce(sum(jl.line_subtotal), 0) as total_lines
from public.jobs j
left join public.job_lines jl on jl.job_id = j.id
where j.id = 'JOB-4a5bdfcc-cd2a-4d1e-ae9e-91a804df49b0'
group by j.id;
```

## Pendientes reales

- Falta QA manual autenticada para confirmar:
  1. editor con 3 bloques en `JOB-0052`
  2. anadir cuarta linea
  3. guardar
  4. confirmar `line_count = 4`
  5. reabrir y ver 4 bloques
- Si apareciera otro editor de servicio fuera de `JobDetailCard`, debera reutilizar el mismo helper editable.
- Seguimiento de visibilidad: ver `docs/JOB_LINES_DEBUG_PANEL_NOT_VISIBLE_AUDIT.md`. El panel debug anterior no estaba publicado en `origin/main`, asi que el usuario seguia probando un build sin ese trazado visible.
- A fecha 2026-07-01 tambien quedo confirmado que el usuario estaba mirando el dominio online y no el entorno local, asi que parte del bloqueo visible podia venir de un build no publicado todavia y no de una regresion nueva de la logica de lineas.
- A fecha 2026-07-01 el siguiente cuello real ya no era el editor en si, sino la lectura de `job_lines` en `appDataApi` con bearer `anon` y fallback silencioso a `billing_lines: []` para `JOB-0052`.
