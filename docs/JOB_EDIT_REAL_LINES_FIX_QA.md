# Job Edit Real Lines Fix QA

## Fecha

- 2026-07-01

## Bug confirmado

- La base ya guardaba servicios multi-linea correctamente.
- Casos reales confirmados en Supabase como `JOB-0052`, `JOB-0051` y `JOB-0050` tenian `line_count = 3`.
- Aun asi, al abrir el editor de servicio la UI mostraba una sola linea legacy con el total agregado.

## Causa exacta

- `src/app/appDataApi.ts` ya cargaba `job_lines`, las agrupaba por `job_id` y las adjuntaba como `billing_lines`.
- `src/features/jobs/JobDetailCard.tsx` si recibia el `job` completo y construia el editor desde `getJobBillingDraftLines(job)`.
- El punto real de perdida visual estaba en `src/features/jobs/jobBilling.ts`:
  - `getJobBillingLines()` validaba `line.quantity` y `line.unit_price` con `Number.isFinite(...)` sobre el valor crudo
  - cuando PostgREST devolvia esos numericos como texto, las lineas persistidas se filtraban como invalidas
  - al quedarse sin lineas validas, el helper caia al fallback legacy y el editor abria con una sola linea

## Archivos modificados

- `src/app/appDataApi.ts`
- `src/features/jobs/jobBilling.ts`
- `src/features/jobs/JobDetailCard.tsx`
- `src/features/jobs/jobBilling.test.ts`
- `docs/JOB_LINES_NO_SUMMARY_FIX_QA.md`
- `docs/ENTITY_CREATION_FLOWS_AUDIT_FIX_QA.md`

## Nueva regla

1. Para formularios editables, `billing_lines` es la fuente primaria.
2. Los numericos persistidos de `job_lines` deben normalizarse antes de validarse.
3. El fallback legacy solo aplica cuando no existen `billing_lines` o quedan realmente vacias.
4. Display y edicion quedan separados: el resumen visual no decide el estado editable.

## Como se corrigio el editor

- `appDataApi.ts` ahora normaliza `sort_order`, `quantity`, `unit_price` y `line_subtotal` al agrupar `job_lines`.
- `jobBilling.ts` tambien endurece la lectura y vuelve a convertir esos campos con `Number(...)` antes de validarlos.
- `JobDetailCard.tsx` inicializa el editor a partir de las lineas ya normalizadas y deja logging DEV con:
  - `jobId`
  - `displayCode`
  - `billingLinesFromJob`
  - `initialLines`
  - `source`

## Como queda el fallback legacy

- Si `job.billing_lines` existe y tiene lineas validas, el editor abre un bloque por linea.
- Solo si no hay lineas persistidas validas se reconstruye una unica linea desde:
  - `billing_concept`
  - `billing_quantity`
  - `billing_unit`
  - `billing_unit_price`

## Tests anadidos o actualizados

- `src/features/jobs/jobBilling.test.ts`
  - verifica que un job con `billing_lines` numericas serializadas como texto sigue generando 3 lineas reales
  - verifica que `getJobBillingDraftLines()` crea 3 bloques editables

## QA manual

- Pendiente en navegador autenticado.
- Probar:
  1. abrir `JOB-0052`
  2. entrar en edicion
  3. confirmar 3 bloques editables
  4. guardar sin cambios
  5. refrescar
  6. reabrir y confirmar que siguen 3 bloques
  7. crear factura y confirmar que hereda 3 lineas

## SQL usado

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

- No hice QA autenticada en navegador en este turno.
- No ejecute SQL directo desde este entorno.
- Si aparece otro path de edicion que no pase por `JobDetailCard -> getJobBillingDraftLines`, habra que alinearlo con la misma normalizacion.
- Seguimiento posterior: ver `docs/JOB_FORM_STATE_LINES_FINAL_FIX_QA.md`. El fix de normalizacion era necesario, pero el cierre definitivo exige tratar el estado editable como fuente propia, separada de helpers de display y con logs DEV del conteo real hasta la RPC.
