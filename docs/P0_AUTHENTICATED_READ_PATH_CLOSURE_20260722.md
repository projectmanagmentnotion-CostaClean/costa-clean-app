# P0 Authenticated Read Path Closure — QA — 2026-07-22

## Resultado

El P0 de lectura anónima quedó cerrado y verificado primero en Supabase QA `kpvvydthlxupjjqqdpxy`. El gate productivo separado del 2026-07-22 aplicó posteriormente el mismo archivo auditado en `wfxnwfcdjainpojhbdri`; véase [PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md](PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md).

## Diagnóstico y read paths corregidos

- `src/lib/supabaseRest.ts` usaba la anon key como bearer cuando no recibía token. Ahora obtiene la sesión Supabase, exige `session.access_token`, rechaza token ausente o igual a la anon key y conserva la anon key solo en `apikey`.
- `src/app/dataHealth.ts` ahora usa el mismo contexto autenticado.
- El primer pase visual detectó `Illegal invocation` por el binding de `window.fetch`; se corrigió mediante un wrapper estable y la repetición terminó `360/360`, sin mensajes de carga fallida.
- Las lecturas con supabase-js conservan la sesión persistida del singleton autenticado.
- El historial de `public_gym_manual_quiz_attempts` dejó de mostrarse públicamente. El envío público se limita a `submit_public_gym_manual_quiz_attempt(jsonb)`, que valida campos/resultados, genera la fecha en servidor y no expone historial.
- Las altas/ediciones de leads dejaron los writes directos legacy y pasan por `create_lead` / `update_lead`, RPCs allowlisted, `SECURITY DEFINER`, `search_path` fijo y guard de usuario autenticado.

## Cierre aplicado en QA

La migración versionada `20260722_close_anon_read_policies_qa_verified.sql` se aplicó con PostgreSQL 17 `psql`, `ON_ERROR_STOP` y una transacción explícita. No se usó `db push`.

SELECT anon/public fue retirado de `clients`, `properties`, `leads`, `invoices`, `invoice_lines`, `payments`, `quotes`, `quote_lines`, `jobs` y `public_gym_manual_quiz_attempts`.

También se revocó SELECT anon/public de las 17 tablas internas auditadas como defensa en profundidad, se eliminaron las policies legacy anon de INSERT/UPDATE/DELETE en leads y tablas financieras/comerciales, y se revocó EXECUTE anon/public de las RPC sensibles auditadas. Las 19 RPC operativas/financieras que lo requieren conservan EXECUTE para `authenticated`; los guards internos no son ejecutables directamente.

La única superficie anónima nueva/conservada dentro de este bloque es el RPC estrecho de envío del quiz. El endpoint público de intake existente permanece justificado y fuera del historial protegido.

## Evidencia antes/después

| Verificación | Antes | Después |
| --- | ---: | ---: |
| Policies SELECT anon en las 10 tablas | 10 | 0 |
| Grants SELECT anon en las 10 tablas | 10 | 0 |
| RPC sensibles con EXECUTE anon | 18 | 0 |
| Policies legacy de write anon objetivo | detectadas | 0 |
| REST anon en las 10 tablas | HTTP 200 | HTTP 401 en 10/10 |
| REST autenticado en las 10 tablas | no requerido en auditoría | HTTP 200 en 10/10 |

Los reportes JSON están en `qa-reports/private/anon-closure/` y no se versionan.

## Tests y validación

- Tests añadidos: ausencia/anon token bloqueados; sesión real usada como bearer; petición abortada antes de fetch sin sesión; contratos RPC de lead protegidos.
- QA visual autenticada final: `360/360`, sin errores de carga.
- Dry-run sandbox: `587/588`, cero entidades creadas. El único fallo fue `firstFieldVisible` en `mobile/job-create`, un check visual intermitente ya observado; las otras 587 comprobaciones y el mismo flujo en tablet/desktop pasaron.
- Facturas, cobros y cierres: 0 operaciones.
- Full-submit: no ejecutado.
- `financialWriteApi`: sin cambios.

## Riesgos restantes

- Producción ya cerró la exposición mediante el gate separado y conserva evidencia anon/auth posterior.
- El modelo actual no tiene ownership/tenant columns. La policy de lectura autenticada sirve al workspace único actual, pero no es autorización multi-tenant.
- La aplicación directa por `psql` no reconcilia `supabase_migrations.schema_migrations`; `db push` sigue bloqueado.
- Los scripts operativos históricos que dependan de bearer anon ya no funcionarán contra QA y deben migrarse a sesión/credencial operativa explícita antes de reutilizarse.
- El check visual `mobile/job-create/firstFieldVisible` sigue siendo intermitente y no está relacionado con auth/RLS.

## Rollback QA

El rollback de frontend es `git revert <commit-de-esta-entrega>`. El rollback de base de datos requiere SQL separado, revisado y aplicado solo a QA. Restaurar policies/grants anónimos reabre el P0 y no debe hacerse salvo una decisión de incidente explícita. No se deben resetear secuencias ni usar `db push` como rollback.

## Próximo gate

El gate productivo fue completado con hash exacto, backup previo y pruebas anon/auth. El siguiente trabajo es reconciliar el historial de migraciones y revisar rate limiting del RPC público del quiz, siempre en sprints separados.
