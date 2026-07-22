# Supabase Disposable Repair Proof — 2026-07-22

## Resultado

- Proof ejecutado: **NO**.
- Ref desechable: no disponible.
- Repair real: **NO**.
- `db push`: **NO**.
- QA oficial modificada: **NO**.
- Producción modificada: **NO**.
- Listo para repair remoto: **NO**.

## Evidencia de bloqueo

La inspección local segura encontró únicamente:

- `.env.local` apuntando a producción `wfxnwfcdjainpojhbdri`;
- `.env.qa.local` apuntando a QA oficial `kpvvydthlxupjjqqdpxy`;
- ningún `.env.disposable.local`;
- ningún `supabase/.temp/project-ref`;
- ninguna variable de entorno de proceso que identifique un tercer destino desechable.

Solo se leyeron nombres de variables y project refs derivados; no se imprimieron valores, tokens, passwords ni connection strings. Las dos configuraciones existentes están expresamente excluidas por el sprint, por lo que no se intentó conexión ni write.

## Qué se probó localmente

- Inventario y SHA-256 de las cuatro migraciones.
- Identidades lógicas únicas propuestas.
- Clasificación baseline/incrementales y estrategia fail-closed.
- Presencia del lock npm.
- `npm run db:push` falla intencionalmente.
- `npm run supabase:db:push` falla intencionalmente.

Esto prueba controles del repositorio, no un repair Supabase.

## Qué no se probó

- Carga de baseline en una base vacía.
- Orden ejecutable baseline/fix de factura.
- Aplicación ordenada de incrementales.
- Inicialización o repair de `supabase_migrations`.
- Interpretación real de aliases por Supabase CLI.
- `migration list`, diff o plan de cero SQL contra un historial reparado.
- Descarte/restauración del destino.

No se creó el reporte privado `qa-reports/private/migration-repair/disposable-proof-latest.md`, porque no hubo una ejecución real que reportar.

## Requisitos exactos para ejecutar el proof

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

El sprint entrega manifiesto y plan, pero el proof queda honestamente bloqueado por infraestructura/credencial externa ausente. No se simula éxito.
