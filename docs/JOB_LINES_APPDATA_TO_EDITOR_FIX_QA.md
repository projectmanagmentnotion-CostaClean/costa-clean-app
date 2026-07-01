# Job Lines AppData To Editor Fix QA

## Fecha

- 2026-07-01

## Evidencia inicial

- Dominio probado:
  - `https://app.costacleanbcn.com/?debugBuild=1&debugJobLines=1`
- Build confirmada por el usuario:
  - `4c0883b`
- Panel visible en `JobDetailCard` para `JOB-0052`:
  - `billingLinesLength = 0`
  - `editableLinesLength = 1`
- SQL reportado por el usuario:
  - `line_count = 2`
  - `total_lines = 277.00`

Conclusion inicial:

- la DB tenia lineas
- el editor visible no estaba recibiendo `billing_lines`

## Diagnostico real

Archivos auditados:

- `src/app/appDataApi.ts`
- `src/app/entitySchemas.ts`
- `src/app/relationships.ts`
- `src/pages/JobsPage.tsx`
- `src/features/jobs/JobWorkspace.tsx`
- `src/features/jobs/JobDetailCard.tsx`
- `src/features/jobs/jobBilling.ts`
- `src/features/jobs/jobEditableLines.ts`
- `src/features/jobs/types.ts`
- `src/lib/supabaseRest.ts`

Hallazgos:

1. `appDataApi.ts` si consulta `job_lines`.
2. `JobsPage` y `JobWorkspace` no eliminaban `billing_lines`.
3. `JobDetailCard` estaba mirando la propiedad correcta: `job.billing_lines`.
4. El problema principal estaba en la lectura REST, no en el paso de props.

## Evidencia REST reproducida

Probe contra `jobs` con la misma `anon key` del frontend:

- resultado:
  - HTTP `200`
  - `JOB-0052` visible correctamente

Probe contra `job_lines` para `JOB-0052` con la misma `anon key`:

- resultado:
  - HTTP `200`
  - body `[]`

Conclusion:

- la app estaba leyendo `jobs` correctamente
- la app no estaba viendo las filas de `job_lines` con credenciales `anon`
- por eso `listJobs()` terminaba adjuntando `billing_lines: []`

## Causa exacta

- `src/lib/supabaseRest.ts` leia por REST con bearer `anon` por defecto.
- `src/app/appDataApi.ts` usaba esa ruta tambien para `job_lines`.
- En este caso real, `anon` podia ver el job pero no las lineas del job.
- `src/app/appDataApi.ts` ademas silenciaba el fallo de lectura de `job_lines` y devolvia `billing_lines: []`, ocultando la causa en produccion.

Resumen:

- causa primaria:
  - lectura REST de `job_lines` con credencial incorrecta para este caso
- causa secundaria:
  - fallback silencioso que escondia el error o vacio de lectura

## Fix aplicado

### 1. Lectura autenticada para `job_lines`

- `src/app/appDataApi.ts` ahora intenta leer `job_lines` con el `access_token` de la sesion activa.
- `src/lib/supabaseRest.ts` ahora admite `accessToken` opcional para lecturas REST.

### 2. Debug visible de AppData

- cuando la URL incluye `?debugJobLines=1`, `appDataApi` guarda en:
  - `window.__COSTA_CLEAN_JOB_LINES_DEBUG__`

Contenido:

- `authMode`
- `jobLinesFetchStatus`
- `jobLinesRawCount`
- `jobLinesError`
- `groupedJobIds`
- `sampleForJob0052`
- `attachedPropertyName`
- `sessionError`

### 3. Debug visible de shape completo en el editor

- `src/features/jobs/JobDetailCard.tsx` ahora muestra:
  - `jobKeys`
  - `billing_lines_length`
  - `billingLines_length`
  - `job_lines_length`
  - muestras de `billing_lines`, `billingLines` y `job_lines`
  - snapshot completo de `window.__COSTA_CLEAN_JOB_LINES_DEBUG__`

### 4. Soporte defensivo de naming drift

- `src/features/jobs/types.ts`
- `src/features/jobs/jobEditableLines.ts`
- `src/features/jobs/jobBilling.ts`

Ahora los helpers soportan:

- `billing_lines`
- `billingLines`
- `job_lines`

Esto no sustituye el fix de lectura, pero evita que un drift de shape esconda lineas reales si el objeto llega con otro nombre.

## Archivos modificados

- `src/lib/supabaseRest.ts`
- `src/app/appDataApi.ts`
- `src/app/appDataApi.test.ts`
- `src/features/jobs/types.ts`
- `src/features/jobs/jobEditableLines.ts`
- `src/features/jobs/jobEditableLines.test.ts`
- `src/features/jobs/jobBilling.ts`
- `src/features/jobs/jobBilling.test.ts`
- `src/features/jobs/JobDetailCard.tsx`

## SQL relevante

SQL reportado por el usuario para confirmar DB:

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

SQL sugerido para revisar permisos/policies en Supabase real:

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('jobs', 'job_lines');
```

```sql
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('jobs', 'job_lines')
order by tablename, policyname;
```

```sql
select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'job_lines'
order by grantee, privilege_type;
```

## Tests

- `src/app/appDataApi.test.ts`
  - valida agrupacion y adjuncion de `job_lines`
  - valida payload debug visible para fallo de lectura
- `src/features/jobs/jobBilling.test.ts`
  - valida soporte de `billingLines`
- `src/features/jobs/jobEditableLines.test.ts`
  - valida soporte de `job_lines`

## Validaciones ejecutadas

- `npm run lint`
- `npm run test`
- `npm run build`

Resultado:

- todo en verde

## QA online esperada tras deploy

Abrir:

- `https://app.costacleanbcn.com/?debugBuild=1&debugJobLines=1`

Luego abrir `JOB-0052` y entrar en `Editar servicio`.

El panel deberia mostrar:

```json
{
  "billingLinesLength": 2,
  "editableLinesLength": 2,
  "authMode": "session",
  "jobLinesRawCount": 2,
  "attachedPropertyName": "billing_lines"
}
```

Si la lectura autenticada siguiera fallando, el panel deberia mostrar ahora el motivo:

```json
{
  "jobLinesFetchStatus": 401,
  "jobLinesError": "..."
}
```

o:

```json
{
  "jobLinesFetchStatus": 403,
  "jobLinesError": "..."
}
```

## Pendientes reales

- desplegar este fix a `main`
- verificar online con sesion autenticada real
- confirmar si la base real permite `SELECT` a `authenticated` sobre `job_lines`
- si aun falla con sesion, aplicar o corregir policy/grants reales en Supabase
- seguimiento DB/RLS posterior:
  - `docs/JOB_LINES_RLS_SELECT_FIX_QA.md`
