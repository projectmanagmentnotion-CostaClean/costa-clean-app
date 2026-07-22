# QA Migration Metadata Repair Gate - 2026-07-22

## Resultado

PASS. La QA oficial `kpvvydthlxupjjqqdpxy` fue modificada exclusivamente para crear metadata de historial compatible con Supabase CLI. Produccion `wfxnwfcdjainpojhbdri` no fue destino ni fue modificada.

- QA modificada: si, metadata only.
- Produccion modificada: no.
- Schema de negocio modificado: no.
- Datos de negocio modificados: no.
- Facturas, cobros y cierres escritos: no.
- `db push` real: no.
- Migration repair en produccion: no.
- Full-submit: no.

## Identidad y preflight

El runner exigio simultaneamente el ref publico QA, el usuario privado del pooler con el mismo ref y una sesion PostgreSQL aceptada solo como `postgres` o `postgres.kpvvydthlxupjjqqdpxy`. La presencia del ref de produccion, otro ref, un host inesperado o una identidad distinta abortan antes de escribir.

Antes de la transaccion se confirmo:

- ausencia de `supabase_migrations` y `supabase_migrations.schema_migrations`;
- 17 tablas en `public`, con inventario exacto;
- sentinel del fix de factura: 1;
- policies `Authenticated read access`: 10;
- policies anon legacy de write dentro del alcance protegido: 0;
- fingerprint SHA-256 del schema `public`: `A2E82C1CF0A1B8DF01AEAC14FC1E497EBEFECBBA25858E7BDBA81D8DE0509439`;
- conteos de filas capturados para las 17 tablas de negocio.

## Cambio aplicado

Una unica transaccion con timeouts, guardas fail-closed y verificacion anterior al commit creo `supabase_migrations.schema_migrations(version text primary key, statements text[], name text)`.

| Version | Nombre | SHA-256 |
| --- | --- | --- |
| `20260707120336` | `fix_same_number_invoice_update_gap` | `39A435EECE213AE73553C7F33B346A1B957C2A090858EA8F29CAA1026C8EC33D` |
| `20260721183811` | `rls_clients_properties_jobs_write_fix` | `8D330B87CDFF30DF88346E67C8C2B72801661686A0883432D1BAEBBB4E89EFA2` |
| `20260722114751` | `close_anon_read_policies_qa_verified` | `000E04348CD7E1DBA4CC1FE3F9C9F42526C3F1D3D35C0AE9D7B2D714A4FB0C02` |

Cada `statements` contiene el texto canonico completo como un unico elemento para conservar y verificar el hash, pero ese SQL no fue ejecutado. La baseline QA-only `20260721134926` no fue registrada y conserva `never-push`.

## Verificacion posterior

- tres versiones unicas, nombres y hashes iguales al manifiesto;
- baseline ausente;
- fingerprint `public` antes/despues identico;
- inventario y conteo de 17 tablas identico;
- conteos de filas de las 17 tablas identicos;
- sentinels de funcion/policies identicos;
- schema y datos de negocio sin cambios.

El primer helper posterior al commit produjo un falso FAIL por comparar el orden de claves de objetos JSONB. La lectura remota ya mostraba las tres filas y hashes correctos. Se corrigio el comparador para validar campos y se repitio toda la verificacion read-only con resultado PASS; no se hizo una segunda escritura ni se ejecuto rollback.

## Backup y rollback exacto

La evidencia previa, los dumps `public` antes/despues, el SQL aplicado y el reporte detallado estan en rutas privadas ignoradas. El rollback exacto esta en `.project-agent/private/migration-repair/qa-before-metadata-repair-20260722.sql`.

Como la metadata no existia antes del gate, el rollback restaura ese estado eliminando solo `supabase_migrations`, pero unicamente tras verificar identidad QA, las tres versiones exactas, baseline ausente y ningun objeto inesperado en el schema. Tiene `COPY: 0`, no contiene datos de negocio ni credenciales y no fue ejecutado porque el estado final es valido.

## Controles y riesgos restantes

El runner versionable es `scripts/ops/run-qa-migration-metadata-repair.mjs`; su comando npm usa el modo read-only `--verify`. `db push` permanece bloqueado. La historia legacy de produccion sigue sin reconciliarse y el proof Supabase Cloud desechable sigue diferido; el repair QA no convierte la cadena del repo en segura para push.

Este gate no permite pasar a produccion. El siguiente gate recomendado es un paquete separado de reconciliacion/repair de metadata de produccion, con autorizacion explicita, backup propio, identidad productiva, fingerprint pre/post y demostracion de cero SQL pendiente.
