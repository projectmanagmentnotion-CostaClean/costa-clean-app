# Local Disposable PostgreSQL Migration Repair Proof — 2026-07-22

## Resultado

- Proof local ejecutado: **SÍ**.
- Docker usado: **NO**; no estaba disponible.
- PostgreSQL local usado: **SÍ**, versión 17.10 mediante `initdb`, `pg_ctl` y `psql`.
- Producción modificada: **NO**.
- QA oficial modificada: **NO**.
- Schema remoto modificado: **NO**.
- Datos remotos modificados: **NO**.
- `db push` real: **NO**.
- Migration repair real: **NO**.
- Clúster local descartado: **SÍ**.
- Resultado: **PASS local**.

## Entorno descartable

`npm run qa:migrations:local-proof` creó un clúster PostgreSQL nuevo en el directorio temporal del sistema, configurado con trust solo para el clúster efímero y escucha exclusiva en `127.0.0.1` sobre un puerto aleatorio. No utilizó `.env.local`, `.env.qa.local`, connection strings ni credenciales remotas. Al terminar detuvo PostgreSQL y eliminó el directorio completo.

El runner aborta si las variables de proceso relevantes contienen los refs de producción `wfxnwfcdjainpojhbdri` o QA oficial `kpvvydthlxupjjqqdpxy`, o si `PGHOST` no es loopback.

## Qué se probó

1. Los SHA-256 de los cuatro archivos coinciden exactamente con el manifiesto canónico.
2. La baseline `20260721_qa_baseline_schema.sql` se aplica a una base vacía y deja 17 tablas públicas.
3. Las incrementales se aplican después en orden canónico:
   - `20260707120336` — fix de factura.
   - `20260721183811` — RLS/RPC write-path.
   - `20260722114751` — cierre de lectura anónima.
4. El estado final contiene el sentinel `v_is_same_number_existing_update` una vez y 10 policies `Authenticated read access`.
5. La metadata simulada `supabase_migrations.schema_migrations` contiene exactamente tres versiones únicas y ordenables.
6. La baseline `20260721134926` queda fuera de metadata y conserva `never-push`.
7. No aparece colisión lógica final entre aliases.
8. El rollback local por descarte completo del clúster funciona y no deja una base necesaria para conservar la evidencia.

El orden ejecutado fue baseline fuera de historial, fix de factura, RLS/RPC y cierre anon. Esto resuelve positivamente la dependencia de bootstrap que antes era solo una hipótesis.

## Qué no se probó

- Supabase Cloud, su plano de control o un tercer project ref.
- `supabase migration repair`, `migration list`, link de CLI ni metadata real del proveedor.
- Un diff o plan remoto de cero SQL.
- Extensiones, roles gestionados, PostgREST schema cache, Auth o Storage de Supabase.
- Repair de metadata en QA oficial o producción.
- Compatibilidad con la historia legacy completa de producción.

PostgreSQL puro recibió únicamente stubs locales mínimos para los roles `anon`, `authenticated`, `service_role` y la función `auth.uid()` necesarios para compilar las policies y funciones exportadas. Por ello el proof es suficiente para sintaxis, orden, baseline, incrementales, fingerprints y metadata simulada, pero no es equivalente total a Supabase Cloud.

## Evidencia

- Runner versionable: `scripts/ops/run-local-migration-repair-proof.mjs`.
- Reporte detallado privado: `qa-reports/private/migration-repair/local-proof-latest.md` (ignorado por Git).
- PostgreSQL: 17.10.
- Tablas públicas finales: 17.
- Aliases simulados: `20260707120336`, `20260721183811`, `20260722114751`.
- Baseline en metadata: 0.
- Policies autenticadas verificadas: 10.

## Decisión del gate

El proof local permite cerrar la incertidumbre de ejecución PostgreSQL y pasar a diseñar el siguiente gate de autorización. No desbloquea `db push`, no autoriza repair real y no sustituye un proof Supabase Cloud.

Siguiente gate recomendado: **QA Official Migration Metadata Repair Authorization Package**. Debe exigir autorización separada, target QA exacto, backup privado de schema/metadata, fingerprints pre/post, registro exclusivo de los tres aliases incrementales, baseline ausente, cero SQL de schema/datos y rollback probado. Producción queda fuera.
