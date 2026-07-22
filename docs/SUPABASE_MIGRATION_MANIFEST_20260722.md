# Supabase Migration Manifest — 2026-07-22

## Estado y alcance

Este manifiesto relaciona los cuatro artefactos SQL publicados con su identidad lógica y su estado material conocido. No modifica sus nombres, no crea historial remoto y no habilita `db push`.

- QA oficial: `kpvvydthlxupjjqqdpxy` — solo referencia auditada; no modificada en este sprint.
- Producción: `wfxnwfcdjainpojhbdri` — solo referencia auditada; no modificada en este sprint.
- Historial registrado en ambos destinos: ausente, `0` versiones.
- Proof desechable: no ejecutado; no existe un tercer destino configurado.

Las versiones lógicas de 14 dígitos se derivan de la fecha/hora del commit que introdujo cada archivo. Son aliases documentales únicos. No son nombres de archivo activos ni autorización para escribir `supabase_migrations`.

## Manifiesto canónico

| Orden histórico | Alias lógico propuesto | Archivo actual | SHA-256 | Clase | QA material | Producción material | Historial QA futuro | Historial producción futuro | Flags | Rollback y riesgo |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `20260707120336` | `20260707_fix_same_number_invoice_update_gap.sql` | `39A435EECE213AE73553C7F33B346A1B957C2A090858EA8F29CAA1026C8EC33D` | Incremental productiva | Sí; sentinel `v_is_same_number_existing_update` en `save_invoice_with_lines` | Sí; mismo sentinel | Sí, solo mediante repair autorizado después del proof | Sí, solo mediante repair autorizado después del proof | `repair-only` hasta transición; no `db push` | Restaurar definición anterior de la función en transacción. Riesgo fiscal alto: cualquier rollback exige gate propio y no puede emitir ni renumerar facturas. |
| bootstrap, fuera del historial incremental | `20260721134926` | `20260721_qa_baseline_schema.sql` | `721F29026F4224DF3FEA68BCB086FB6C559599114CDE4FC9637CA0CDE5E44E57` | Baseline QA-only | Sí; fingerprint de 17 tablas y objetos base | No; prohibida | **No**: es un artefacto de bootstrap, no una migración incremental | **No** | `never-push`; no apta para producción; no idempotente | Descartar el entorno desechable o restaurar snapshot completo. Nunca ejecutar una inversa objeto por objeto sobre QA/producción. Riesgo crítico si entra en una cadena productiva. |
| 2 | `20260721183811` | `20260721_rls_clients_properties_jobs_write_fix.sql` | `8D330B87CDFF30DF88346E67C8C2B72801661686A0883432D1BAEBBB4E89EFA2` | Incremental productiva | Sí; 7 funciones/RPC y ausencia de 6 policies anon legacy | Sí; mismo fingerprint y smoke real previo | Sí, solo mediante repair autorizado después del proof | Sí, solo mediante repair autorizado después del proof | `repair-only` hasta transición; no `db push` | Rollback SQL security-regressive ya documentado en su gate. Requiere coordinación frontend y autorización separada. |
| 3 | `20260722114751` | `20260722_close_anon_read_policies_qa_verified.sql` | `000E04348CD7E1DBA4CC1FE3F9C9F42526C3F1D3D35C0AE9D7B2D714A4FB0C02` | Incremental productiva | Sí; 10 policies authenticated, 0 exposición anon del alcance y RPC allowlist | Sí; mismo fingerprint y smoke read-only previo | Sí, solo mediante repair autorizado después del proof | Sí, solo mediante repair autorizado después del proof | `repair-only` hasta transición; no `db push` | Inversa transaccional reabre exposición P0 y solo procede como decisión de incidente autorizada. |

## Clasificación solicitada

### A. Baseline QA-only

- `20260721_qa_baseline_schema.sql`.
- Es schema-only y sin filas, pero contiene creación no incremental de objetos.
- Es `never-push`, no debe registrarse como una migración aplicada en QA o producción y nunca debe llegar a producción.

### B. Incrementales productivas

- `20260707_fix_same_number_invoice_update_gap.sql`.
- `20260721_rls_clients_properties_jobs_write_fix.sql`.
- `20260722_close_anon_read_policies_qa_verified.sql`.

Las tres están materialmente presentes en QA y producción. La evidencia proviene de fingerprints live read-only documentados en el informe de reconciliación, no de metadata de migraciones.

### C. No aptas para `db push` hoy

- La baseline QA-only, de forma permanente.
- Las tres incrementales mientras sus aliases únicos no tengan una transición de archivos probada y los remotos continúen con historial ausente.
- El directorio completo actual, porque dos nombres colisionan en `20260721` y mezcla bootstrap con incrementales.

### D. Aplicación material en QA

Las cuatro están representadas materialmente. La baseline dejó 17 tablas/objetos base; el fix de factura dejó su sentinel; RLS dejó sus RPC y eliminaciones de policies; el cierre anon dejó policies authenticated y grants restringidos. Ninguna consta como versión registrada.

### E. Aplicación material en producción

Solo las tres incrementales. La baseline QA-only no se aplicó ni debe aplicarse. Producción contiene además un schema legacy anterior al historial del repo, por lo que estas tres entradas no forman una historia de bootstrap completa.

## Órdenes diferentes que no deben confundirse

Orden histórico lógico de cambios sobre un schema existente:

1. `20260707120336` — fix de factura.
2. `20260721183811` — RLS/RPC write-path.
3. `20260722114751` — cierre de lectura anon.

Orden candidato de bootstrap desechable:

1. Cargar la baseline QA-only fuera del historial.
2. Aplicar o reconciliar el fix de factura según el estado exacto que deje la baseline.
3. Aplicar RLS/RPC.
4. Aplicar cierre anon.

Este segundo orden es una hipótesis operativa, no un proof. La baseline dice que omite `save_invoice_with_lines` porque lo aporta `20260707`, mientras el SQL `20260707` referencia objetos base. Solo un proyecto vacío desechable puede demostrar la secuencia exacta y si cada incremental produce SQL o debe marcarse materialmente presente.

## Estrategia elegida

Se adopta **Opción B temporal**: mantener los archivos donde están, conservar el lock global y usar este manifiesto como clasificación fail-closed.

No se elige un move/rename inmediato porque alteraría la identidad publicada antes de tener proof y metadata reconciliada. La estructura objetivo posterior es una transición controlada hacia Opción A:

```text
supabase/baselines/qa/20260721_qa_baseline_schema.sql
supabase/migrations/<aliases-únicos>-<incrementales>.sql
```

Esa transición requiere un sprint separado que pruebe hashes, aliases, bootstrap y plan de cero SQL en un entorno desechable. Hasta entonces, ningún archivo se mueve ni renombra.

## Veredicto

- Manifiesto documental: completo.
- Identidades lógicas únicas: propuestas, no activadas.
- Reconciliación material remota: no ejecutada.
- `db push`: bloqueado.
- Listo para repair real: **NO**; falta proof desechable y autorización posterior de metadata.
