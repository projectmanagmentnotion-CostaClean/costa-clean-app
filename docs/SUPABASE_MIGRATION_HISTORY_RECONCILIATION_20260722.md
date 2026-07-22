# Supabase Migration History Reconciliation Gate — 2026-07-22

## Veredicto

- Auditoría read-only completada: sí.
- Historial modificado: no.
- Schema o datos modificados: no.
- `db push` seguro: **NO**.
- Reconciliación real completada: no; requiere autorización separada para escribir metadata.

QA `kpvvydthlxupjjqqdpxy` y producción `wfxnwfcdjainpojhbdri` no tienen el schema `supabase_migrations`, la tabla `schema_migrations` ni versiones registradas. Los objetos live demuestran que los cambios fueron aplicados, pero el mecanismo de historial no los conoce.

## Inventario del repositorio

Orden lexicográfico actual:

| Archivo | SHA-256 | Tamaño | Alcance y estado real |
| --- | --- | ---: | --- |
| `20260707_fix_same_number_invoice_update_gap.sql` | `39A435EECE213AE73553C7F33B346A1B957C2A090858EA8F29CAA1026C8EC33D` | 6335 B | Aplicada en producción manualmente y en QA por `psql`; no registrada |
| `20260721_qa_baseline_schema.sql` | `721F29026F4224DF3FEA68BCB086FB6C559599114CDE4FC9637CA0CDE5E44E57` | 110665 B | Aplicada solo en QA por `psql`; prohibida en producción; no registrada |
| `20260721_rls_clients_properties_jobs_write_fix.sql` | `8D330B87CDFF30DF88346E67C8C2B72801661686A0883432D1BAEBBB4E89EFA2` | 10856 B | Aplicada en QA y producción por `psql`; no registrada |
| `20260722_close_anon_read_policies_qa_verified.sql` | `000E04348CD7E1DBA4CC1FE3F9C9F42526C3F1D3D35C0AE9D7B2D714A4FB0C02` | 9665 B | Aplicada en QA y producción por `psql`; no registrada |

## Historial remoto leído

| Destino | Schema `supabase_migrations` | Tabla `schema_migrations` | Versiones registradas |
| --- | --- | --- | ---: |
| QA | no | no | 0 |
| Producción | no | no | 0 |

Las consultas se ejecutaron dentro de transacciones `READ ONLY`, usando identidad privada validada por ref. No se creó schema, tabla o fila de historial.

## Evidencia material live

Ambos destinos devuelven el mismo fingerprint relevante:

- 17 tablas públicas.
- fix `v_is_same_number_existing_update` presente en `save_invoice_with_lines`.
- 7 funciones/RPC del bloque RLS write-path presentes.
- 3 RPC del cierre anon/lead/quiz presentes.
- 10 policies `Authenticated read access` presentes.
- 0 policies legacy anon de write en el alcance auditado.

Esto prueba estado material, no historial formal. No permite inventar que una versión concreta esté registrada.

## Gaps y conflictos

1. **Historial ausente:** repo 4, QA registrado 0, producción registrado 0.
2. **Colisión de versión:** dos archivos empiezan por `20260721`; una tabla de historial versionada por prefijo no puede representarlos inequívocamente.
3. **Baseline mezclada:** la baseline QA-only está en el mismo directorio que migraciones incrementales de producción.
4. **Bootstrap incompleto/condicional:** `20260707` supone objetos base; la baseline excluye deliberadamente esa función y depende de ejecutarla antes.
5. **Reaplicación peligrosa:** la baseline contiene `CREATE` de objetos existentes y no es una migración incremental idempotente.
6. **Historia material previa:** producción existía antes de este directorio formal; marcar solo cuatro archivos no describe la creación original completa del schema.
7. **CLI sin link:** el repo no tiene `supabase/.temp/project-ref`; un comando futuro podría apuntar al destino incorrecto si se configura apresuradamente.

## Por qué `db push` no es seguro

Con historial remoto vacío, la CLI puede considerar pendientes los cuatro archivos. En producción intentaría incluir una baseline explícitamente QA-only y encontraría objetos existentes; en ambos destinos toparía además con la colisión `20260721`. Aunque algunas funciones usan `CREATE OR REPLACE`, eso no convierte el conjunto en seguro ni demuestra un plan vacío.

Resultado: `db push` permanece bloqueado y no debe probarse como mecanismo de diagnóstico.

## Protección añadida

- [DB_PUSH_LOCK.md](DB_PUSH_LOCK.md) formaliza el bloqueo.
- `npm run db:push` y `npm run supabase:db:push` ejecutan `scripts/ops/assert-db-push-locked.mjs` y fallan siempre.
- El workflow y los quality gates prohíben también invocar directamente `npx supabase db push` o reparar historial.

## Plan recomendado de reconciliación

Gate separado, con autorización explícita para metadata:

1. Capturar backups privados de schema y de cualquier metadata de migraciones inmediatamente antes del trabajo.
2. Diseñar un manifest canónico que relacione cada hash con su apply real y evidencia.
3. Mover la baseline QA/bootstrap fuera de la cadena incremental productiva o adoptar una estrategia formal de baseline; no renombrar archivos ya publicados sin manifest.
4. Resolver la colisión `20260721` con versiones únicas de 14 dígitos y documentar aliases históricos.
5. Probar todo en un proyecto desechable clonado desde schema, nunca primero en producción.
6. Elegir y revisar el mecanismo de repair (`supabase migration repair` o SQL metadata explícito). Cualquiera de los dos es un write y necesita autorización.
7. Reconciliar QA, verificar `migration list` y demostrar un plan de cero cambios de schema.
8. Repetir en producción bajo autorización separada y verificar de nuevo un plan vacío.
9. Solo entonces considerar retirar el lock de `db push` en otro commit revisado.

## No-goles confirmados

- Producción modificada: no.
- QA modificada: no.
- Schema modificado: no.
- Historial modificado: no.
- Migraciones aplicadas: 0.
- Facturas/cobros/cierres: 0 operaciones.
- Full-submit: no.
- Secretos o artefactos privados versionados: 0.

## Próximo gate

`Migration Manifest And Disposable Repair Proof`: crear el manifest de hashes/versiones, resolver el diseño de baseline/version collision en fuente y demostrar la reparación sobre un Supabase desechable. Debe detenerse antes de cualquier write en QA o producción hasta recibir autorización explícita adicional.
