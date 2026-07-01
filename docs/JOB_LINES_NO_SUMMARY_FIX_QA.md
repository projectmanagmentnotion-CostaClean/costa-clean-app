# Job Lines No Summary Fix QA

## Fecha

- 2026-07-01

## Bug confirmado visualmente

- Los servicios ya guardaban correctamente tras el fix de autenticacion de `save_job_with_lines`.
- Aun asi, la UI seguia mostrando un concepto resumido como `Limpieza estandar (+2 linea(s))`.
- El problema seguia apareciendo en superficies de servicio y podia contaminar prefills o descripciones auxiliares aunque `job_lines` reales existieran.

## Donde se generaba `(+N linea(s))`

- `src/features/jobs/jobWriteApi.ts`
  - `buildJobBillingSummary()` guardaba `billing_concept: \`${firstConcept} (+${lines.length - 1} linea(s))\``
- `src/features/jobs/jobBilling.ts`
  - `getJobBillingDisplayConcept()` reconstruia el mismo patron para mostrarlo en UI

## Causa real

- El modelo multi-linea ya estaba persistido en `job_lines`, pero el resumen textual seguia entrando en `billing_concept`.
- Algunas vistas y adapters seguian leyendo ese resumen como si fuera el concepto principal del servicio.
- Resultado: no se perdian necesariamente las lineas en base, pero si se simplificaba su representacion visible.

## Archivos modificados

- `src/features/jobs/jobWriteApi.ts`
- `src/features/jobs/jobBilling.ts`
- `src/features/jobs/jobCreatePrefill.ts`
- `src/features/invoices/InvoiceCreateFlow.tsx`
- `src/features/jobs/jobWriteApi.test.ts`
- `src/features/jobs/jobBilling.test.ts`
- `src/features/entityCreationPrefills.test.ts`
- `docs/JOB_SAVE_AUTH_FIX_QA.md`
- `docs/ENTITY_CREATION_FLOWS_AUDIT_FIX_QA.md`

## Nueva regla de fuente de verdad

1. `job.billing_lines` es la fuente primaria.
2. `billing_concept`, `billing_quantity`, `billing_unit` y `billing_unit_price` quedan como compatibilidad legacy.
3. Si existen `billing_lines`, el concepto principal visible sale de la primera linea real.
4. El conteo de lineas queda separado en resumen auxiliar, nunca incrustado en el concepto editable.

## Como se preservan las lineas

- `buildJobBillingSummary()` ya no incrusta `(+N linea(s))` en `billing_concept`.
- Para multi-linea, `billing_concept` guarda solo el primer concepto real.
- `getJobBillingDisplayConcept()` devuelve solo el primer concepto real cuando existen lineas persistidas.
- `getJobBillingDisplaySummary()` sigue siendo el lugar del conteo (`3 linea(s)`).
- `buildJobCreatePrefillFromJob()` prioriza la primera linea real sobre un `billing_concept` legacy resumido.
- `InvoiceCreateFlow` usa `getJobBillingDisplayConcept(selectedJob)` en descripciones auxiliares en vez de leer `selectedJob.billing_concept` a ciegas.

## Como queda el fallback legacy

- Solo se usa cuando `job.billing_lines` no existe o esta vacio.
- En ese caso, `getJobBillingLines()` puede reconstruir una unica linea desde `billing_concept` y campos legacy.
- Si hay lineas reales, ese fallback no corre.

## Tests anadidos o actualizados

- `src/features/jobs/jobBilling.test.ts`
  - verifica que un job con 3 `billing_lines` devuelve 3 lineas
  - verifica que no reaparece `(+N linea(s))` como concepto principal
- `src/features/jobs/jobWriteApi.test.ts`
  - verifica que el request RPC conserva `p_lines.length === 3`
  - verifica que `buildJobBillingSummary()` guarda el primer concepto real y el total multi-linea
- `src/features/entityCreationPrefills.test.ts`
  - verifica que los prefills desde servicio y hacia factura conservan las 3 lineas reales

## QA manual

- Pendiente en navegador autenticado.
- Casos a verificar:
  1. editar un servicio existente multi-linea y confirmar que cada linea aparece separada
  2. crear un servicio con 3 lineas, refrescar y reabrir edicion
  3. crear factura desde ese servicio y confirmar que hereda las 3 lineas

## SQL de verificacion

```sql
select
  j.id,
  j.display_code,
  count(jl.id) as line_count,
  coalesce(sum(jl.line_subtotal), 0) as total_lines
from public.jobs j
left join public.job_lines jl on jl.job_id = j.id
group by j.id
order by j.created_at desc
limit 20;
```

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
where job_id = 'JOB_ID_AQUI'
order by sort_order asc;
```

## Pendientes reales

- No hice QA autenticada en navegador en este turno.
- No ejecute SQL directo desde este entorno.
- Si existen servicios antiguos con `billing_concept` resumido pero `job_lines` correctas, ahora la UI deberia mostrar el primer concepto real y conservar todas las lineas al refacturar o duplicar.
- Seguimiento posterior: ver `docs/JOB_EDIT_REAL_LINES_FIX_QA.md`. El resumen textual ya estaba corregido, pero faltaba normalizar `job_lines` reales al entrar en el editor para no caer por error en el fallback legacy de una sola linea.
