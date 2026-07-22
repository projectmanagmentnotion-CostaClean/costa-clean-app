# Production Anonymous Read Closure Gate — 2026-07-22

## Resultado

El cierre P0 de lectura anónima fue aplicado y verificado en Supabase producción `wfxnwfcdjainpojhbdri`. QA `kpvvydthlxupjjqqdpxy`, datos de negocio, numeración fiscal y secuencias no fueron modificados.

## Artefacto autorizado

- Migración: `supabase/migrations/20260722_close_anon_read_policies_qa_verified.sql`
- Commit de origen: `02eaf67ae0ef56050f5472c1bb31a311267b3094`
- SHA-256 aplicado: `000E04348CD7E1DBA4CC1FE3F9C9F42526C3F1D3D35C0AE9D7B2D714A4FB0C02`
- Método: PostgreSQL 17 `psql`, `ON_ERROR_STOP`, `BEGIN/COMMIT`
- `db push`: no ejecutado
- Otras migraciones: 0

La revisión previa confirmó que el archivo no altera `invoice_number`, `display_code` fiscal, secuencias ni `financialWriteApi`, no contiene datos reales y no ejecuta DML de negocio. Los `INSERT` presentes están encapsulados en las definiciones de las RPC allowlisted de lead y quiz; la aplicación solo crea/reemplaza funciones y cambia policies/grants.

## Validación de destino y backup

- Ref pública validada: `wfxnwfcdjainpojhbdri`
- Usuario/ref privado validado: `wfxnwfcdjainpojhbdri`
- QA excluido: sí
- Local/otro proyecto excluido: sí
- Backup previo: `.project-agent/private/production-release/prod-schema-before-anon-closure-20260722.sql`
- Tamaño: 124995 bytes
- Schema-only: sí
- `COPY`: 0
- `INSERT INTO` de datos: 0
- Connection strings: 0

El backup, logs, target validation y reportes de probes son privados e ignorados por Git.

## Probes antes/después

| Control | Antes | Después |
| --- | ---: | ---: |
| REST anon — 10 tablas | HTTP 200 en 10/10 | HTTP 401 en 10/10 |
| REST authenticated — 10 tablas | HTTP 200 en 10/10 | HTTP 200 en 10/10 |
| Policies SELECT anon | 10 | 0 |
| Grants SELECT anon | 10 | 0 |
| Policies legacy anon de write | 15 | 0 |
| RPC sensibles con EXECUTE anon | 6 | 0 |
| RPC sensibles/operativas con EXECUTE authenticated | 17 | 19 |
| RPC pública validada de envío del quiz | ausente | preservada para anon/authenticated |

Tablas cerradas: `clients`, `properties`, `leads`, `invoices`, `invoice_lines`, `payments`, `quotes`, `quote_lines`, `jobs` y `public_gym_manual_quiz_attempts`.

Las 19 RPC authenticated incluyen las 17 ya presentes y `create_lead` / `update_lead`. Los guards internos `require_authenticated_write` y `require_authenticated_financial_write` no son ejecutables directamente.

## Smoke de aplicación sin writes

El build actual se sirvió localmente con configuración pública productiva y sesión de usuario real. `npm run qa:visual:auth` recorrió dashboard, clientes, propiedades, presupuestos, servicios, facturas, gastos, cobros y cierre fiscal en móvil, tablet y desktop.

- Resultado: `360/360`
- Errores de carga: 0
- Entidades creadas: 0
- Submits: 0
- Facturas/cobros/cierres: 0 operaciones
- Full-submit: no

## Rollback exacto

No se ejecutó rollback. Si fuera imprescindible por incidente:

1. Detener el frontend coordinadamente y validar de nuevo el ref productivo.
2. Usar el schema-only previo y los JSON `prod-rpc-grants-before-20260722.json` como fuente de verdad.
3. En una única transacción revisada: eliminar las diez policies `Authenticated read access`; recrear las diez policies SELECT anon y las quince policies legacy de write con sus nombres/predicados previos; restaurar SELECT a `anon` en las diez tablas; restaurar EXECUTE anon únicamente en las seis firmas registradas; eliminar `create_lead(jsonb)`, `update_lead(jsonb)` y `submit_public_gym_manual_quiz_attempt(jsonb)` si el frontend también se revierte.
4. Repetir probes anon/auth/RPC y reconciliar el frontend.

Este rollback reabre deliberadamente el P0 y los writes anónimos legacy. Es security-regressive, requiere autorización de incidente separada y no debe ejecutarse mediante `db push`, restauración total del schema, reset de secuencias ni cambio de numeración.

## Riesgos restantes

- Las policies authenticated son workspace-wide porque no existen ownership/tenant columns. El modelo sigue siendo válido solo para el workspace único actual.
- La aplicación directa por `psql` no registra esta migración en `supabase_migrations.schema_migrations`; `db push` continúa bloqueado hasta reconciliar historial.
- Scripts operativos históricos que dependían de bearer anon ya no pueden leer producción y deben migrarse a sesión/credencial operativa explícita antes de reutilizarse.
- El RPC público del quiz limita y valida el envío, pero sigue siendo una superficie pública que requiere monitorización de abuso/rate limiting a nivel plataforma.

## Evidencia privada

- `prod-anon-before-20260722.json` / `prod-anon-after-20260722.json`
- `prod-auth-before-20260722.json` / `prod-auth-after-20260722.json`
- `prod-rpc-grants-before-20260722.json` / `prod-rpc-grants-after-20260722.json`
- `prod-anon-closure-target-validation-20260722.md`
- logs privados de backup y apply
