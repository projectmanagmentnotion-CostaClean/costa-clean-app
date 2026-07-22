# Supabase DB Push Lock

## Estado

`db push` está bloqueado. QA y producción no contienen el schema `supabase_migrations` y, por tanto, no registran ninguna de las migraciones que ya están materialmente aplicadas.

Comandos prohibidos hasta un gate separado:

- `npx supabase db push`
- `supabase db push`
- `supabase migration repair`
- INSERT/UPDATE/DELETE manual sobre tablas de historial de migraciones
- cualquier wrapper que marque versiones como aplicadas

## Protección local

Los scripts siguientes fallan siempre de forma intencional:

```text
npm run db:push
npm run supabase:db:push
```

La protección npm no puede interceptar un `npx supabase db push` escrito directamente. Esa operación sigue prohibida por [CODEX_WORKFLOW.md](CODEX_WORKFLOW.md), [APP_QUALITY_GATES.md](APP_QUALITY_GATES.md) y este lock.

## Motivo

- Hay cuatro archivos en `supabase/migrations`, pero QA y producción registran cero versiones.
- Dos archivos usan el mismo prefijo/version `20260721`.
- `20260721_qa_baseline_schema.sql` es una baseline exclusiva de QA y no debe ejecutarse en producción.
- Las migraciones ya aplicadas por `psql` podrían reejecutarse; la baseline contiene creación no idempotente de objetos ya existentes.
- Marcar versiones como aplicadas cambia metadata de base de datos y requiere autorización explícita separada.

## Condición para desbloquear

No se elimina este lock hasta que un sprint autorizado:

1. defina versiones únicas y una separación segura entre baseline QA/bootstrap e incrementales productivas;
2. capture backups privados de metadata/schema;
3. pruebe la reconciliación en un entorno desechable;
4. repare el historial de QA y producción con autorización explícita;
5. demuestre que el plan de `db push` resultante contiene cero SQL pendiente inesperado;
6. pase revisión de seguridad y gates completos.

El informe vigente es [SUPABASE_MIGRATION_HISTORY_RECONCILIATION_20260722.md](SUPABASE_MIGRATION_HISTORY_RECONCILIATION_20260722.md).
