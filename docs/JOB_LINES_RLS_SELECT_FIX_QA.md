# Job Lines RLS Select Fix QA

## Fecha

- 2026-07-01

## Estado del sprint

- Dominio probado:
  - `https://app.costacleanbcn.com`
- Build visible:
  - `dd41628`
- Debug activo:
  - `?debugBuild=1&debugJobLines=1`

## Evidencia del panel real

En `JOB-0052`, el panel visible mostraba:

```json
{
  "authMode": "session",
  "jobLinesFetchStatus": 200,
  "jobLinesError": null,
  "jobLinesRawCount": 0,
  "groupedJobIds": [],
  "sampleForJob0052": [],
  "sessionError": null,
  "billingLinesLength": 0,
  "editableLinesLength": 1
}
```

Conclusión:

- la app ya no estaba leyendo con `anon`
- la app ya no estaba ocultando el modo de auth
- el `access_token` de sesión alcanzaba PostgREST
- aun así PostgREST devolvía `0` filas visibles

## Evidencia DB conocida

SQL previa reportada por el usuario:

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

Resultado comunicado:

- `line_count = 2`
- `total_lines = 277.00`

## Causa exacta

La causa ya no apunta a React.

El patrón visible es compatible con:

- `grant select` existente pero sin visibilidad efectiva por RLS
- o `RLS` activo en `public.job_lines` con policy inexistente o incorrecta
- o policy basada en columnas no presentes en `job_lines`

Dado que el panel ya mostraba:

- `authMode = "session"`
- `jobLinesFetchStatus = 200`
- `jobLinesRawCount = 0`

la causa más probable es:

- `SELECT` autenticado sobre `public.job_lines` filtrado por RLS/policy

## Repo auditado

- `src/app/appDataApi.ts`
- `src/lib/supabaseRest.ts`
- `src/features/jobs/JobDetailCard.tsx`
- `sql/20260629_create_job_lines_and_save_job_with_lines.sql`
- `sql/20260701_harden_job_lines_rpc_permissions.sql`

Hallazgo clave:

- en el repo no aparece una policy explícita de `SELECT` para `public.job_lines`
- sí aparece grant de lectura:
  - `grant select on public.job_lines to anon, authenticated`
- eso no basta si la base real tiene `RLS` activo

## SQL preparado en repo

Nueva migración:

- `sql/20260701_fix_job_lines_select_policy.sql`

Contenido:

- `grant usage on schema public to authenticated`
- `grant select on public.job_lines to authenticated`
- `revoke select on public.job_lines from anon`
- si `RLS` está activo en `public.job_lines`, recrea policy:
  - `"authenticated can read job lines for readable jobs"`

Regla usada:

```sql
exists (
  select 1
  from public.jobs j
  where j.id = job_lines.job_id
)
```

Motivo:

- si `jobs` ya es visible para el usuario autenticado, `job_lines` hereda esa visibilidad desde el job padre
- si la base real tiene una restricción más fina en `jobs`, este patrón la respeta a través de la subquery

## Aplicación en Supabase real

No pude aplicarla desde este entorno.

Bloqueo real:

- no hay Supabase CLI configurada
- no hay acceso SQL privilegiado en terminal
- no había sesión utilizable del dashboard de Supabase en el navegador de trabajo

Por tanto:

- la migración quedó preparada en repo
- la aplicación real en Supabase sigue pendiente

## Verificaciones SQL que siguen siendo necesarias en Supabase

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
  permissive,
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

## Resultado esperado después de aplicar SQL real

En:

- `https://app.costacleanbcn.com/?debugBuild=1&debugJobLines=1`

al abrir `JOB-0052`, el panel debería pasar a algo como:

```json
{
  "authMode": "session",
  "jobLinesFetchStatus": 200,
  "jobLinesRawCount": 2,
  "sampleForJob0052": [
    "...",
    "..."
  ],
  "billingLinesLength": 2,
  "editableLinesLength": 2
}
```

## Pendientes reales

- aplicar `sql/20260701_fix_job_lines_select_policy.sql` en Supabase real
- confirmar policies/grants actuales de `jobs` y `job_lines`
- reabrir `JOB-0052` online y comprobar que ya muestra 2 líneas
