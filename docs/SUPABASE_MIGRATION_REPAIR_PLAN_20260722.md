# Supabase Migration Repair Plan — 2026-07-22

## Estado actual - QA repair ejecutado

El 2026-07-22 se ejecuto el gate autorizado exclusivamente contra `kpvvydthlxupjjqqdpxy`. Se creo metadata compatible con Supabase CLI y se registraron solo `20260707120336`, `20260721183811` y `20260722114751`; la baseline `20260721134926` quedo fuera. El fingerprint `public` `A2E82C1CF0A1B8DF01AEAC14FC1E497EBEFECBBA25858E7BDBA81D8DE0509439`, las 17 tablas y sus conteos permanecieron identicos. No se ejecuto SQL de migraciones ni se tocaron schema/datos de negocio. Produccion y `db push` siguen bloqueados. Evidencia: [QA_MIGRATION_METADATA_REPAIR_GATE_20260722.md](QA_MIGRATION_METADATA_REPAIR_GATE_20260722.md).

## Propósito

Definir cómo podría reconciliarse el historial sin aplicar schema nuevo. Este documento no autoriza ni ejecuta repair, `db push`, SQL remoto, creación de historial ni cambios en QA/producción.

## Proof local sustitutivo — 2026-07-22

Por la limitación del plan gratuito, el proof remoto en un tercer Supabase queda diferido. `npm run qa:migrations:local-proof` ejecutó en PostgreSQL 17.10 un clúster descartable loopback-only, validó los cuatro hashes, aplicó baseline y tres incrementales en el orden candidato, creó metadata simulada con los tres aliases únicos, excluyó la baseline `never-push` y eliminó el clúster.

Esto cierra la hipótesis local de sintaxis, orden, baseline, incrementales y metadata simulada. No valida semántica real de Supabase CLI/Cloud, no produce un plan remoto de cero SQL y no sustituye una autorización de metadata. `db push` y todo repair real continúan bloqueados. El primer repair remoto futuro debe ejecutarse en QA oficial bajo autorización separada; producción no forma parte de ese gate.

## Precondiciones obligatorias

1. Para repetir el proof remoto completo, un tercer proyecto Supabase desechable cuyo ref no sea `kpvvydthlxupjjqqdpxy` ni `wfxnwfcdjainpojhbdri`; temporalmente diferido por el plan gratuito.
2. Credencial privada de operador almacenada solo en una ruta ignorada; nunca service role en frontend.
3. Backup schema-only y backup de metadata inmediatamente anterior para cada destino que llegue a autorizarse.
4. Hashes exactos iguales al [manifiesto](SUPABASE_MIGRATION_MANIFEST_20260722.md).
5. Revisión de la semántica de versión usada por la CLI instalada y resolución probada de los aliases de 14 dígitos.
6. Proof desechable completo, incluido bootstrap, repair, introspección y demostración de plan de cero SQL.
7. Autorización explícita y separada para escribir metadata en QA. Producción exige otra autorización posterior.

Si cualquiera falla, el proceso se detiene sin escribir.

## Destino y validación

Antes de cualquier paso, un runner futuro debe:

- obtener el project ref desde la URL efectiva;
- comparar exactamente contra el ref autorizado;
- abortar si coincide con QA o producción durante el proof desechable;
- abortar si el ref está ausente, es desconocido o no coincide con la conexión privada;
- mostrar solo el ref y fingerprints no secretos, nunca URLs con credenciales, passwords o tokens.

## Artefactos y orden

Hashes y aliases: consultar `SUPABASE_MIGRATION_MANIFEST_20260722.md`.

- Baseline QA-only: bootstrap fuera del historial; no registrar.
- Incrementales: aliases `20260707120336`, `20260721183811`, `20260722114751`.
- Orden histórico para repair sobre QA/producción ya materializados: los tres aliases en ese orden.
- Orden de bootstrap candidato: baseline, validación de estado del fix de factura, RLS/RPC y cierre anon. El proof debe resolver si el fix se aplica o se reconoce ya presente antes de registrar nada.

## Pseudoprocedimiento desechable

Los bloques siguientes son pseudocomandos intencionalmente no ejecutables; los placeholders deben resolverse en un sprint autorizado.

```text
ASSERT TARGET_REF == <DISPOSABLE_REF>
ASSERT TARGET_REF != kpvvydthlxupjjqqdpxy
ASSERT TARGET_REF != wfxnwfcdjainpojhbdri
ASSERT SHA256(files) == manifest

CREATE EMPTY DISPOSABLE PROJECT/BRANCH
APPLY BASELINE_QA_ONLY OUTSIDE MIGRATION HISTORY
VERIFY 17 TABLES, FUNCTIONS, TRIGGERS, RLS, POLICIES, GRANTS

FOR EACH incremental IN candidate_bootstrap_order:
  INSPECT material sentinel
  APPLY incremental only when proof contract says absent
  VERIFY exact postcondition

INITIALIZE/REPAIR HISTORY IN DISPOSABLE ONLY USING REVIEWED PROVIDER MECHANISM
REGISTER ONLY 20260707120336, 20260721183811, 20260722114751
DO NOT REGISTER 20260721134926 BASELINE

LIST HISTORY
GENERATE READ-ONLY DIFF/PLAN
ASSERT PENDING SQL == 0
DISCARD DISPOSABLE TARGET
```

El proof no puede usar los scripts npm `db:push`; deben seguir fallando. Una herramienta de diff/plan solo será admisible dentro del runner desechable con target guard y sin apply implícito.

## Reparación futura de QA

Solo después del proof y de una autorización nueva:

1. Validar ref QA exacto y que no sea producción.
2. Capturar backups privados y fingerprints pre-repair.
3. Confirmar por introspección que los tres incrementales están materialmente presentes.
4. Crear/reparar únicamente metadata para los tres aliases; no ejecutar sus cuerpos SQL.
5. No registrar la baseline QA-only.
6. Verificar versiones, hashes/manifest y cero cambios de schema/datos.
7. Generar un plan read-only de cero SQL pendiente.
8. Mantener el lock incluso si QA pasa; producción aún no estará reconciliada.

## Reparación futura de producción

Requiere autorización distinta y posterior al cierre de QA:

1. Validar ref producción y excluir QA.
2. Repetir backups y fingerprints.
3. Confirmar materialidad de solo las tres incrementales.
4. Registrar únicamente sus aliases mediante metadata repair; no aplicar SQL.
5. Confirmar que la baseline jamás aparece en historial o plan productivo.
6. Probar cero cambios de schema/datos y cero SQL pendiente.
7. Mantener `db push` bloqueado hasta un gate final que revise también la historia legacy previa al repo.

## Verificación posterior

- Tabla/schema de historial contiene exactamente las identidades autorizadas.
- Hashes del repo permanecen iguales.
- Fingerprints funcionales pre/post son idénticos.
- Conteos y checksums de schema no muestran DDL inesperado.
- No hubo INSERT/UPDATE/DELETE de negocio.
- Facturas, cobros, cierres, `invoice_number` y `display_code` fiscal no fueron tocados.
- `npm run db:push` y `npm run supabase:db:push` continúan fallando.

## Rollback

En desechable: descartar por completo el proyecto/branch. No intentar “limpiar” metadata parcialmente.

En un futuro repair QA/producción: restaurar solo el backup de metadata si la autorización y el mecanismo probado lo permiten. Si hubo cualquier cambio de schema o datos, detenerse como incidente; no ejecutar una compensación improvisada. No se revierten secuencias ni numeración fiscal.

## Riesgos activos

- Semántica de aliases distinta a la esperada por la versión real de Supabase CLI.
- Baseline y fix de factura tienen una dependencia de bootstrap todavía no demostrada.
- La historia legacy productiva no queda representada por tres incrementales.
- Un repair equivocado puede hacer que una futura herramienta omita SQL necesario o intente aplicar la baseline.
- Un plan “vacío” no basta si se obtiene apuntando al destino incorrecto.

## Por qué `db push` sigue prohibido

El repositorio aún conserva nombres ambiguos, una baseline dentro del directorio incremental, cero metadata remota y ningún proof desechable. Repair y push son operaciones diferentes: registrar estado material no demuestra por sí solo una cadena de bootstrap segura. El lock solo podrá revisarse en un gate posterior a proof, repair autorizado y plan de cero SQL.
