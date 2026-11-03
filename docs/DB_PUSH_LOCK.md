# Supabase DB Push Lock

**Estado: BLOQUEADO.** Este lock es preventivo y sigue vigente para QA y Production. No ejecutar `supabase db push`, `supabase migration repair`, `apply_migration`, ni SQL de escritura sobre `supabase_migrations` hasta que exista autorización exacta y un preflight de cero SQL inesperado.

## Estado observado (2026-11-03, solo lectura)

| Entorno | Proyecto | Entradas | Primera versión | Última versión |
|---|---|---:|---|---|
| Production | `wfxnwfcdjainpojhbdri` | 28 | `20260707120336` | `20260924100831` (`20260924100000_n4_lock_recurring_table_acl`) |
| QA | `kpvvydthlxupjjqqdpxy` | 99 | `20260707120336` | `20261002135207` (`n56_preproduction_security_hardening`) |

La relación `supabase_migrations.schema_migrations` existe en ambos proyectos. La consulta de ledger devuelve 28/99 entradas, respectivamente. Esto prevalece sobre las afirmaciones históricas de este documento que indicaban cero tablas o tres versiones. La observación es una fotografía de esa fecha, no un permiso para cambiar el ledger.

## Baseline QA: fuera del historial incremental

`supabase/qa/bootstrap/20260721_qa_baseline_schema.sql` es un artefacto de bootstrap QA-only, aplicado históricamente por `psql`, sin entrada correspondiente en ninguno de los dos ledgers observados. Se retiró de `supabase/migrations` para que Supabase CLI no lo trate como migración incremental. El SHA-256 conservado es `57B4DD8AE3A772394D77A44D6D0CBA81CD0BCE933120B152B97465F080799386`.

La baseline **no** se usa para Production ni para reconstruir la plataforma Supabase completa: es un dump público de esquema, omite datos, estado de secuencias, auth/storage gestionados, grants y owners. El nombre de archivo con versión corta de 8 dígitos también colisionaba con `20260721_rls_clients_properties_jobs_write.sql`; el artefacto QA ya no participa en ese espacio de versiones.

Los harnesses de PostgreSQL local que necesitan el baseline ahora lo resuelven desde `supabase/qa/bootstrap`. El cambio de ruta no cambia los bytes SQL ni crea una entrada de ledger.

## Conciliación actual de PR #28 / P0

- PR #28 contiene 18 migraciones. Cinco coinciden por hash MD5 de sentencias con entradas de Production bajo versiones/nombres diferentes. QA tiene los objetos materiales correspondientes, pero sus hashes de sentencias difieren para esos cinco; no se les declara equivalentes en QA.
- Las otras 13 migraciones de PR #28 no están en el ledger Production. QA contiene implementaciones relacionadas de 12 contratos bajo versiones o contenido distinto; una migración final de hardening no consta en QA.
- El orden de compatibilidad local, una vez aprobada la conciliación, es: V3 pendiente en orden cronológico hasta N55, después N56, luego `expense_product_grant_hardening` y por último P0. P0 no se debe ejecutar antes de N56/grant hardening porque N56 redefine las políticas de `expenses`.
- Manifiesto detallado y verificador estático: `docs/SUPABASE_V3_P0_MIGRATION_RECONCILIATION.md`, `supabase/qa/bootstrap/v3-p0-release-manifest.json` y `scripts/ops/validate-v3-production-migration-preflight.mjs`.

## Condiciones antes de desbloquear cualquier operación

1. Resolver, con SQL fuente/ledger y catálogo efectivo, cada diferencia de contenido o versión; no reparar versiones basándose solo en nombres.
2. Reconstruir el preestado real en un PostgreSQL/Supabase descartable con equivalencia suficiente, sin copiar datos de clientes.
3. Obtener evidencia de backup con datos y probar una restauración en destino aislado; verificar Storage por separado.
4. Ejecutar validación SQL de migraciones en orden, políticas/RLS/ACL/RPC y compatibilidad de P0 contra el estado reconstruido.
5. Revisar el plan del CLI y confirmar cero SQL pendiente no revisado. Mantener bloqueados los wrappers y los comandos directos hasta un gate aprobado.
6. Obtener autorización explícita independiente antes de cualquier escritura remota, reparación del ledger, migración, merge o despliegue de Production.

Este lock no se relaja por éxito de build, por igualdad de un hash aislado ni por estado `READY` de Preview.
