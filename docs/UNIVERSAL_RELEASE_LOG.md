# Universal Release Log

Registro transversal para cambios que adopten el sistema universal. Los proyectos con changelog propio pueden enlazarlo aquí sin duplicar todo su historial.

## Unreleased

### Costa Clean

#### 2026-07-22 - Anonymous Read Policy And Public Exposure Audit

- fecha: 2026-07-22
- proyecto: Costa Clean CRM
- tipo: read-only security audit
- resumen: confirms ten anon-readable REST tables in both QA and production, including personal, operational, commercial, payment and fiscal data; inventories 12 production and 24 QA non-trigger RPC grants effective for anon
- clasificacion: P0 because personal and financial data are anonymously readable; P1 operational exposure is included in the higher-severity finding
- cambios externos: none; no policy, grant, function, migration or business row was modified
- validacion: exact project-ref guards, read-only catalog introspection, anonymous HTTP HEAD probes, source correlation, lint/build/201 tests
- siguiente gate: coordinated authenticated read path and QA-only anonymous policy/grant closure, followed by separate production authorization
- rollback: documentation-only `git revert`; no database rollback required

Evidence: [ANON_READ_POLICY_AUDIT_20260722.md](ANON_READ_POLICY_AUDIT_20260722.md).

#### 2026-07-22 - Production RLS/RPC Write Path Release

- fecha: 2026-07-22
- proyecto: Costa Clean CRM
- tipo: production backend security release
- resumen: applies the QA-verified authenticated RPC migration to production and completes a separately authorized, marked, non-financial production smoke for client, property and job writes with immediate cleanup
- commit: documentation commit of this production release; final identifier is reported at close
- validación: preflight lint/build/201 tests, migration hash guard, PostgreSQL 17 transactional apply, post-apply catalog verification, and deployed bundle contract verification
- smoke productivo: `create_client`, `create_property`, `update_property`, `save_job_with_lines`, and `update_job_status` returned `200/200/200/204/200`; persisted state was verified and marker/ID residue is zero
- riesgo: single-workspace authorization and anonymous reads remain; direct `psql` migration-history drift remains blocked from `db push`; the smoke consumed one non-fiscal operational sequence value in each of `CLI/PRO/JOB` and did not reset them
- rollback: separately reviewed production SQL documented in the release evidence; rollback restores the insecure legacy write surface and requires frontend coordination

Evidence: [PRODUCTION_RLS_RELEASE_GATE_20260722.md](PRODUCTION_RLS_RELEASE_GATE_20260722.md).

#### 2026-07-21 - RLS and RPC Write Path Fix

- fecha: 2026-07-21
- proyecto: Costa Clean CRM
- tipo: backend security / QA migration / frontend write path
- resumen: replaces direct client/property/job-status REST writes with authenticated allowlisted RPCs, closes obsolete anon write policies, and hardens RPC execution grants
- commit: commit of this delivery; final identifier is reported at close
- validación: real QA writes persisted, exact cleanup returned both QA markers to 0, seed remained intact and financial tables stayed `0/0/0`; final app gates are recorded in the evidence
- riesgo: current model is single-workspace and anon reads remain a separate privacy concern; production migration is a separate authorized gate
- rollback: revert repository commit; QA schema rollback requires separately reviewed SQL and would restore the legacy insecure surface

Evidence: [RLS_WRITE_PATH_FIX_20260721.md](RLS_WRITE_PATH_FIX_20260721.md).

#### 2026-07-21 - QA Authenticated RLS Write Verification

- fecha: 2026-07-21
- proyecto: Costa Clean CRM
- tipo: QA / authenticated write hardening
- resumen: verifica writes reales con `session.access_token` en el proyecto QA; confirma RPC de reasignación y alta de servicio, detecta RLS bloqueando writes REST directos y evita falsos éxitos HTTP 200 con cero filas
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validación: marker temporal limpiado a 0, seed demo intacto, tablas financieras `0/0/0`; gates finales registrados en la evidencia
- riesgo: los INSERT/PATCH directos requieren revisión de policies en un sprint autorizado separado
- rollback: `git revert <commit-de-esta-entrega>`; no requiere cleanup adicional

Evidencia: [QA_AUTH_RLS_WRITE_VERIFICATION_20260721.md](QA_AUTH_RLS_WRITE_VERIFICATION_20260721.md).

#### 2026-07-21 - P1 Authenticated Property and Service Writes

- fecha: 2026-07-21
- proyecto: Costa Clean CRM
- tipo: functional / backend security patch
- resumen: sustituye el bearer anonimo de los REST writes directos de propiedades y estado de servicios por `session.access_token`, bloqueando el guardado sin sesion y preservando errores 401/403
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validacion: lint/build, `183/183` tests, sandbox check y QA visual `360/360`; dry-run sin writes `587/588` con un check intermitente distinto en cada rerun
- riesgo: acotado a headers y errores de writes no financieros; payloads, rutas y contratos permanecen intactos
- rollback: `git revert <commit-de-esta-entrega>` y repetir gates completos

Evidencia: [P1_AUTH_WRITE_PATH_HARDENING_20260721.md](P1_AUTH_WRITE_PATH_HARDENING_20260721.md).

#### 2026-07-21 — Full App Production Audit and Correction Pass

- fecha: 2026-07-21
- proyecto: Costa Clean CRM
- tipo: audit / patch
- resumen: audita arquitectura, módulos, UX/UI, responsive, accesibilidad, clientes API/Supabase y QA; corrige identidad del target QA y primer paso del servicio contextual
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validación: lint/build y 177 tests, QA visual sandbox `360/360` y dry-run sandbox `588/588`, con 0 entidades creadas
- riesgo: bajo en cambios aplicados; writes autenticados directos y optimización de assets quedan como sprints separados
- rollback: `git revert <commit-de-esta-entrega>` y repetir gates completos

Evidencia: [FULL_APP_AUDIT_20260721.md](FULL_APP_AUDIT_20260721.md) y [FULL_APP_AUDIT_FIXES_20260721.md](FULL_APP_AUDIT_FIXES_20260721.md).

#### 2026-07-21 — Universal Product Correction and Release System

- fecha: 2026-07-21
- proyecto: Costa Clean CRM
- tipo: docs / patch
- resumen: incorpora metodología universal de corrección, UX/UI, releases, riesgos, protocolo Codex y plantillas reutilizables
- commit: commit de documentación de esta entrega; el identificador final se informa en el cierre
- validación: `npm run lint`, `npm run build` y `npm run test`
- riesgo: bajo; cambios limitados a documentación
- rollback: `git revert <commit-de-esta-entrega>` y volver a ejecutar los gates documentales

### Ridaos Print

Sin entradas.

### Webs / Landings

Sin entradas.

### Otros proyectos

Sin entradas.

## Formato de nuevas entradas

Cada entrada debe incluir:

- fecha
- proyecto
- tipo
- resumen
- commit
- validación
- riesgo
- rollback

No se registra como publicado un cambio que solo esté validado en fuente local. Los bloqueos o validaciones parciales se describen explícitamente.
