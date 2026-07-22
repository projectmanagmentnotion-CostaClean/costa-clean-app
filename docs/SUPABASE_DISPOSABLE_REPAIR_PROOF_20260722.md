# Supabase Disposable Repair Proof — 2026-07-22

## Resultado remoto original

- Proof Supabase remoto ejecutado: **NO**.
- Ref desechable: no disponible.
- Repair real: **NO**.
- `db push`: **NO**.
- QA oficial modificada: **NO**.
- Producción modificada: **NO**.
- Listo para repair remoto: **NO**.

## Sustitución temporal por proof local

La limitación del plan gratuito impide provisionar un tercer proyecto Supabase. El gate usa temporalmente el **Local Disposable Postgres Migration Repair Proof**, ejecutado con PostgreSQL 17.10 en un clúster nuevo, loopback-only y eliminado al terminar.

- Proof local ejecutado: **SÍ**.
- Baseline QA-only aplicada localmente: **SÍ**; 17 tablas.
- Incrementales aplicadas en orden canónico: **SÍ**.
- Metadata `supabase_migrations.schema_migrations` simulada: **SÍ**; tres aliases únicos.
- Baseline registrada en metadata: **NO**; conserva `never-push`.
- Clúster descartado: **SÍ**.
- QA oficial / producción contactadas o modificadas: **NO**.

Este resultado prueba sintaxis PostgreSQL, bootstrap, orden, fingerprints y consistencia de metadata simulada. No equivale por completo a Supabase Cloud, no prueba `supabase migration repair`, `migration list`, diff remoto, extensiones/roles gestionados ni schema cache del proveedor. No desbloquea `db push` ni autoriza repair real. El primer repair remoto, si se autoriza por separado, debe ser únicamente en QA oficial.

Evidencia versionable: [LOCAL_DISPOSABLE_POSTGRES_MIGRATION_REPAIR_PROOF_20260722.md](LOCAL_DISPOSABLE_POSTGRES_MIGRATION_REPAIR_PROOF_20260722.md). Evidencia detallada: `qa-reports/private/migration-repair/local-proof-latest.md`, ignorada por Git.

## Evidencia de bloqueo

La inspección local segura encontró únicamente:

- `.env.local` apuntando a producción `wfxnwfcdjainpojhbdri`;
- `.env.qa.local` apuntando a QA oficial `kpvvydthlxupjjqqdpxy`;
- ningún `.env.disposable.local`;
- ningún `supabase/.temp/project-ref`;
- ninguna variable de entorno de proceso que identifique un tercer destino desechable.

Solo se leyeron nombres de variables y project refs derivados; no se imprimieron valores, tokens, passwords ni connection strings. Las dos configuraciones existentes están expresamente excluidas por el sprint, por lo que no se intentó conexión ni write.

## Qué se había probado antes del proof PostgreSQL

- Inventario y SHA-256 de las cuatro migraciones.
- Identidades lógicas únicas propuestas.
- Clasificación baseline/incrementales y estrategia fail-closed.
- Presencia del lock npm.
- `npm run db:push` falla intencionalmente.
- `npm run supabase:db:push` falla intencionalmente.

Esto prueba controles del repositorio, no un repair Supabase.

## Qué sigue sin probarse

- Inicialización o repair real de `supabase_migrations` en Supabase Cloud.
- Interpretación real de aliases por Supabase CLI.
- `migration list`, diff o plan de cero SQL contra un historial remoto reparado.
- Descarte/restauración de un proyecto Supabase remoto.

El proof local sí generó `qa-reports/private/migration-repair/local-proof-latest.md`; permanece ignorado y no se versiona.

## Requisitos exactos para repetir el proof en Supabase Cloud

1. Provisionar manualmente un proyecto o branch Supabase vacío y descartable.
2. Entregar por canal privado su project ref y una credencial de operador/DB limitada al proof.
3. Confirmar que el ref es distinto de QA y producción.
4. Guardar la configuración en un archivo ignorado específico, por ejemplo `.env.disposable.local`, sin service role frontend.
5. Definir y probar el mecanismo de descarte antes de aplicar SQL.
6. Autorizar explícitamente writes de schema e historial **solo** en ese destino desechable.
7. Ejecutar el [plan de repair](SUPABASE_MIGRATION_REPAIR_PLAN_20260722.md) y generar el reporte privado.

## Stop conditions

Abortar antes de escribir si el target coincide con QA/producción, falta una credencial, no existe descarte, cambia un hash, el bootstrap no es determinista, aparece SQL financiero/datos reales o el plan final no es cero SQL.

## Veredicto

El proof PostgreSQL local pasa y resuelve la hipótesis de sintaxis/orden/metadata simulada. El proof Supabase Cloud queda honestamente diferido por infraestructura externa ausente. No se simula equivalencia, `db push` sigue bloqueado y el repair remoto requiere un gate QA separado.
