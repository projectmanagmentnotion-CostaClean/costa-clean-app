# Universal Release Log

## 2026-07-27 — Client portal CP-2A.2 Windows-compatible runner

- fecha: 2026-07-27
- proyecto: Costa Clean Client Portal
- tipo: corrective local launcher / source and read-only proof
- resumen: replaces direct Windows `.cmd` spawning with a direct Supabase JavaScript target, restricted batch compatibility, V3 authorization gate, immutable manifest, tests, and proof
- validación: real Windows `.cmd`; Supabase version and authenticated project list through V3; QA linked; production not linked; injection/timeout/redaction/negative authorization gates; full suite/lint/build recorded at closeout
- remoto: QA writes `0`; production writes `0`; Auth users, Edge deploys, Storage and SQL mutations `0`; WordPress and `/portal` untouched
- datos: real PII added `0`; secrets/private artifacts versioned `0`
- estado: CP-0 `DONE`; CP-1 `DONE`; CP-2A `DONE`; CP-2A.1 `DONE`; CP-2A.2 `DONE`; CP-2B `BLOCKED_PENDING_EXPLICIT_V3_AUTHORIZATION`; CP-3 `NOT STARTED`
- autorización: V3 is `PREPARED / NOT EXECUTED / AWAITING EXPLICIT AUTHORIZATION`; neither V1 nor V2 authorization carries forward
- evidencia: [client-portal/CP2A2_WINDOWS_RUNNER_FIX.md](client-portal/CP2A2_WINDOWS_RUNNER_FIX.md), [client-portal/CP2B_EXACT_QA_AUTHORIZATION_V3.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION_V3.md)

## 2026-07-27 — Client portal CP-2A.1 QA-compatible execution package

- fecha: 2026-07-27
- proyecto: Costa Clean Client Portal
- tipo: corrective security execution package / source and local disposable proof
- resumen: replaces fixed Auth fixture assumptions with Admin-API-generated UUIDs, exact private ledger, parameterized V2 SQL, exact cleanup, backup/hash gates, Edge denial matrix, and disable-first recovery
- validación: PostgreSQL 17 dynamic Auth/migration/fixtures/matrix/cleanup/recovery/rollback/zero-residue proof; 9/9 specific tests; plan/preflight; lint/build/full suite recorded at closeout
- remoto: QA writes `0`; production writes `0`; remote Auth/Edge/Storage/schema/data changes `0`; WordPress untouched
- datos: only runtime-generated local UUIDs and `example.invalid`; real PII `0`; secrets/private artifacts versioned `0`
- estado: CP-0 `DONE`; CP-1 `DONE`; CP-2A `DONE`; CP-2A.1 `DONE`; CP-2B `BLOCKED_PENDING_EXPLICIT_V2_AUTHORIZATION`; CP-3 `NOT STARTED`
- autorización: V2 is `PREPARED / NOT EXECUTED / AWAITING EXPLICIT AUTHORIZATION`; this commit does not authorize remote execution
- evidencia: [client-portal/CP2A1_QA_EXECUTION_PACKAGE.md](client-portal/CP2A1_QA_EXECUTION_PACKAGE.md), [client-portal/CP2B_EXACT_QA_AUTHORIZATION_V2.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION_V2.md)

## 2026-07-23 — Client portal CP-2A immutable QA-preparation package

- fecha: 2026-07-23
- proyecto: Costa Clean Client Portal
- tipo: security source package / local disposable proof
- resumen: explicit staff boundary, portal tenancy, narrow RPC/Edge APIs, private invoice documents, synthetic authorization matrix and disable-first rollback
- validación: PostgreSQL 17.10 apply/matrix/cleanup/rollback/reapply; strict Edge contract tests; lint/build/full test and db-push locks recorded at closeout
- producción/QA/Auth/Storage/Edge: unchanged; remote writes `0`; users created `0`
- datos: synthetic `QA-CP2-` and `@example.invalid` only; real PII `0`; fiscal/financial/sequence changes `0`
- estado: CP-2A `DONE`; CP-2B `NOT AUTHORIZED`; `/portal` UI not implemented
- rollback: exact local script, disable-first and fail-closed; no remote rollback executed
- evidencia: [client-portal/CP2A_IMPLEMENTATION_PACKAGE.md](client-portal/CP2A_IMPLEMENTATION_PACKAGE.md), [client-portal/CP2B_EXACT_QA_AUTHORIZATION.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION.md)

## 2026-07-23 — Client portal CP-0 / CP-1 security and legal design

- fecha: 2026-07-23
- proyecto: Costa Clean Client Portal
- tipo: architecture / security / legal design, documentation only
- resumen: maps the WordPress public website and canonical CRM, defines explicit customer tenancy, invitations/manual approval, deny-by-default portal APIs, private invoice delivery, service-request review, legal/consent content and the exact future QA authorization gate
- commit: commit of this delivery with subject `docs: design secure Costa Clean client portal`; final identifier reported at closeout
- validación: starting commit `b0c1768b2c8d797aab61771c9db63472f31e962e`; source/live read-only audit; 13 required portal documents; cross-document review; lint/build; secret and Git diff review
- producción/QA/schema/Auth/usuarios/storage/datos: unchanged; remote writes `0`; invoice/payment/closing/sequence changes `0`
- riesgo: current any-authenticated canonical policies are P0 for future portal users; no WordPress Git repository was found; legal content remains pending verified facts and professional legal approval
- rollback: revert this documentation commit only; no database, Auth, Storage, WordPress or deployment rollback exists because none was changed
- estado: CP-0 `DONE`; CP-1 `DONE`; CP-2 `NOT AUTHORIZED`
- evidencia: [client-portal/ARCHITECTURE.md](client-portal/ARCHITECTURE.md), [client-portal/QA_AUTHORIZATION_PACKAGE.md](client-portal/QA_AUTHORIZATION_PACKAGE.md), [client-portal/IMPLEMENTATION_ROADMAP.md](client-portal/IMPLEMENTATION_ROADMAP.md)

## 2026-07-23 — Gate 5 production functional smoke and final roadmap close

- fecha: 2026-07-23
- proyecto: Costa Clean CRM
- tipo: P1 Auth correction / production frontend release / roadmap close
- resumen: adds one secure responsive account/logout flow through the existing Supabase client, proves visible logout and human re-login in production, and closes the mandatory roadmap
- commits runtime: `f2ba980e1b10c17a3c4f8441a54890e3839f01d9`, `2d63f6bc1798ff5a2c79347730881b894f790253`
- deployment: Git-triggered Vercel production deployment `dpl_4DDzs7QFgBXEjY1SrANtPUwKVqYb`, `READY`; canonical domain HTTP `200`
- validación: account/menu/Escape/focus; logout; protected-content removal; Back/reload; human login; persistence; ten modules; public quiz isolation; `1440x900`, `768x1024`, `390x844`; lint/build; `239/239` tests; both db-push locks
- producción/QA/datos: Auth session lifecycle only; QA unchanged; business writes `0`; financial/fiscal writes `0`; real-data changes `0`
- estado: Gate 5 `DONE`; roadmap `CLOSED`; production `READY FOR NORMAL OPERATION`; P0/P1 open `0`
- riesgo: single-workspace trust boundary, providerless distributed abuse and migration CLI lock remain documented; optional A/B/C and Turnstile remain deferred
- rollback: revert the runtime commits and redeploy only under a separately reviewed incident action; no database rollback exists because this sprint made no database change
- evidencia: [GATE_5_PRODUCTION_FUNCTIONAL_SMOKE_FINAL_20260723.md](GATE_5_PRODUCTION_FUNCTIONAL_SMOKE_FINAL_20260723.md), [READY_FOR_NORMAL_OPERATION_20260723.md](READY_FOR_NORMAL_OPERATION_20260723.md)

## 2026-07-22 — Gate 4B providerless public quiz protection in QA

- tipo: QA backend/frontend security implementation
- resumen: replaces direct public quiz RPC submission in QA with a public Edge Function, strict shared/server contract, HMAC pseudonymous throttling and a private transactional RPC
- validacion: exact triple QA identity, PostgreSQL 17 disposable proof and transactional apply, active Edge deployment, 12/12 live synthetic matrix, custom-log privacy scan and zero-residue cleanup
- produccion: unchanged; invoices, payments, closings, fiscal numbering/sequences and full-submit untouched
- secretos versionados: 0
- riesgo residual: providerless controls do not prove a human; Gate 4C must independently decide whether production requires Turnstile or another provider
- estado histórico: Gate 4B QA DONE; Gate 4C later passed under separate authorization
- evidencia: [GATE_4B_PROVIDERLESS_QA_EXECUTION_20260722.md](GATE_4B_PROVIDERLESS_QA_EXECUTION_20260722.md)

## 2026-07-22 — Gate 4A public quiz abuse-protection design

- tipo: security design / documentation only
- resumen: audits the anonymous quiz RPC and selects Turnstile Managed + Supabase Edge Function + private transactional RPC with privacy-preserving throttling
- producción/QA/schema/data/code/provider: unchanged
- coste estimado: EUR 0/month inside current free quotas; no paid overage authorized
- estado histórico: Gate 4A DONE; Gate 4B and Gate 4C later passed under separate authorizations
- evidencia: [PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_AUTHORIZATION_PACKAGE_20260722.md](PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_AUTHORIZATION_PACKAGE_20260722.md)

## 2026-07-22 - Costa Clean App - production migration metadata repair gate

- tipo: production operational metadata repair
- resumen: registers exactly three canonical migration-history entries in production without executing migration bodies or changing business schema/data
- commit: commit of this delivery; final identifier reported at closeout
- validacion: triple target identity, fresh private rollback, canonical hashes, public fingerprint, 17 table counts, nine sequences, invoice identifiers, authenticated no-submit smoke, lint/build/tests and push locks
- riesgo: legacy history and physical migration filenames remain unresolved; authenticated visual audit is `358/360`; `db push` remains blocked
- rollback: private guarded transaction removes only the gate-created metadata schema after exact-content verification; not executed because the gate passed

Evidence: [PRODUCTION_MIGRATION_METADATA_REPAIR_GATE_20260722.md](PRODUCTION_MIGRATION_METADATA_REPAIR_GATE_20260722.md).

## 2026-07-22 - Costa Clean App - production migration metadata authorization package

- tipo: docs / production read-only authorization package
- resumen: validates empty production history and material incremental postconditions, then defines a future metadata-only transaction, exact rollback and explicit authorization boundary
- commit: commit of this delivery; final identifier reported at closeout
- validacion: exact production identity, 17-table inventory, migration sentinels, canonical hashes, schema-only fingerprint, lint/build/tests and intentional npm push locks
- riesgo: legacy history and physical migration filenames remain unresolved; package does not authorize repair and `db push` stays blocked
- rollback: documentation revert only; production and QA received no writes

Evidence: [PRODUCTION_MIGRATION_METADATA_REPAIR_AUTHORIZATION_PACKAGE_20260722.md](PRODUCTION_MIGRATION_METADATA_REPAIR_AUTHORIZATION_PACKAGE_20260722.md).

## 2026-07-22 - Costa Clean App - QA migration metadata repair gate

- tipo: docs / QA operational metadata repair
- resumen: crea en QA oficial el historial compatible con Supabase CLI y registra solo tres incrementales canonicas; baseline excluida, produccion intacta
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validacion: identidad triple QA, hashes remotos, fingerprint `public`, 17 tablas y conteos pre/post; lint/build/tests y locks npm
- riesgo: historia legacy de produccion y baseline dentro del directorio incremental siguen sin resolver; `db push` permanece bloqueado
- rollback: artefacto privado exacto que elimina solo el schema de metadata creado tras guardas estrictas; no ejecutado porque el gate es PASS

Evidencia: [QA_MIGRATION_METADATA_REPAIR_GATE_20260722.md](QA_MIGRATION_METADATA_REPAIR_GATE_20260722.md).

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

#### 2026-07-22 — QA P0 Authenticated Read And Anonymous Closure

- fecha: 2026-07-22
- proyecto: Costa Clean CRM
- tipo: security / QA schema and frontend patch
- resumen: exige sesión real en lecturas internas, bloquea historial público del quiz y cierra SELECT/write policies y RPC grants anónimos sensibles solo en QA
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validación: anon REST `200 -> 401` en 10/10, authenticated REST `200` en 10/10, QA visual `360/360`, dry-run `587/588` sin writes
- riesgo: producción conserva el P0 hasta autorización separada; lectura autenticada sigue el modelo single-workspace
- rollback: revert de código; rollback SQL QA separado y explícitamente security-regressive

Evidencia: [P0_AUTHENTICATED_READ_PATH_CLOSURE_20260722.md](P0_AUTHENTICATED_READ_PATH_CLOSURE_20260722.md).

#### 2026-07-22 — Production P0 Anonymous Read Closure

- fecha: 2026-07-22
- proyecto: Costa Clean CRM
- tipo: security / production database release
- resumen: aplica en producción la migración exacta validada en QA, cierra lecturas y writes legacy anon, restringe RPC sensibles y preserva auth y el envío público validado del quiz
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validación: backup schema-only previo; anon REST `200 -> 401` en 10/10; authenticated REST `200` en 10/10; RPC anon `6 -> 0`; smoke visual `360/360`; cero writes de negocio
- riesgo: modelo single-workspace, historial de migraciones pendiente de reconciliar y rate limiting del quiz público
- rollback: inversa transaccional basada en el schema/reportes previos; reabre P0 y requiere autorización separada de incidente

Evidencia: [PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md](PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md).

#### 2026-07-22 — Supabase Migration History Reconciliation Audit

- fecha: 2026-07-22
- proyecto: Costa Clean CRM
- tipo: audit / operational guardrail
- resumen: inventaría cuatro migraciones y confirma mediante lectura remota que QA y producción tienen cero historial registrado; añade bloqueo npm/documental de `db push`
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validación: introspección `READ ONLY`, hashes SHA-256, fingerprints live y gates de repositorio; cero writes remotos
- riesgo: colisión de versión `20260721`, baseline QA-only mezclada con incrementales y ausencia total de metadata remota
- rollback: revertir docs/script/package; no existe rollback DB porque no se modificó ninguna base

Evidencia: [SUPABASE_MIGRATION_HISTORY_RECONCILIATION_20260722.md](SUPABASE_MIGRATION_HISTORY_RECONCILIATION_20260722.md).

#### 2026-07-22 — Migration Manifest And Disposable Repair Proof Gate

- fecha: 2026-07-22
- proyecto: Costa Clean CRM
- tipo: docs / operational safety gate
- resumen: define aliases lógicos únicos, clasifica la baseline QA como `never-push`, conserva los archivos sin rename y documenta un repair futuro sin ejecutarlo
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validación: hashes SHA-256, lint/build/tests y locks npm; proof desechable `NO` porque solo existen refs de QA oficial y producción
- riesgo: bootstrap ejecutable y metadata repair siguen sin probar; `db push` continúa bloqueado
- rollback: revertir este commit documental; no existe rollback DB porque QA, producción, schema, datos e historial no se modificaron

Evidencia: [SUPABASE_MIGRATION_MANIFEST_20260722.md](SUPABASE_MIGRATION_MANIFEST_20260722.md), [SUPABASE_MIGRATION_REPAIR_PLAN_20260722.md](SUPABASE_MIGRATION_REPAIR_PLAN_20260722.md) y [SUPABASE_DISPOSABLE_REPAIR_PROOF_20260722.md](SUPABASE_DISPOSABLE_REPAIR_PROOF_20260722.md).

#### 2026-07-23 — Gate 4C Public Quiz Production Protection

- fecha: 2026-07-23
- proyecto: Costa Clean CRM
- tipo: security / production release completion
- resumen: cierra Gate 4C verificando read-only la migración, pepper, Edge y frontend ya publicados; ejecuta la matriz productiva de 12 casos y limpia exactamente el intento y los guards sintéticos
- commit: commit de esta entrega con asunto `security: release public quiz protection to production`; el identificador final se informa en el cierre
- validación: Edge `ACTIVE` versión 1, dominio `200`, preflight `204`, matriz `12/12`, scoring autoritativo reconciliado, logs `0` violaciones, cleanup `1/2`, seis intentos reales intactos, tests específicos `28/28`, suite `236/236`, lint/build y ambos locks
- riesgo: el endpoint público conserva una protección providerless dependiente de límites HMAC por fingerprint; cualquier rollback de base reabre el RPC legacy y es security-regressive
- rollback: artefactos privados preparados para DB/Edge/secret/Vercel; requieren autorización de incidente, y el rollback de repositorio usa `git revert` seguido del release controlado

Evidencia: [GATE_4C_PUBLIC_QUIZ_PRODUCTION_RELEASE_20260723.md](GATE_4C_PUBLIC_QUIZ_PRODUCTION_RELEASE_20260723.md).

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
