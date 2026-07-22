# Costa Clean App — Final Closeout Roadmap

## Production metadata repair gate completed - 2026-07-22

The separately authorized production metadata-only repair is PASS. Production now records exactly the three canonical incrementals; QA baseline and unknown versions are absent. Public schema fingerprint, 17 table counts, nine sequences and invoice identifiers remained unchanged. QA was not modified. `db push` remains locked because legacy history and the physical migration directory still lack a proven CLI zero-SQL transition. Evidence: [PRODUCTION_MIGRATION_METADATA_REPAIR_GATE_20260722.md](PRODUCTION_MIGRATION_METADATA_REPAIR_GATE_20260722.md).

Gate 3 is closed and published. Gate 4A, Public Quiz RPC Abuse Protection audit/design, is also closed source-only. Gate 4B QA implementation is the next active gate and is blocked pending explicit QA/provider/privacy/secrets authorization. Gate 4C production remains independently blocked. Evidence: [WORKSPACE_TENANCY_OWNERSHIP_SECURITY_MODEL_20260722.md](WORKSPACE_TENANCY_OWNERSHIP_SECURITY_MODEL_20260722.md) and [PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_AUTHORIZATION_PACKAGE_20260722.md](PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_AUTHORIZATION_PACKAGE_20260722.md).

## Historical production metadata authorization package - 2026-07-22

The production read-only package was completed before the later separately authorized production metadata repair. At package time production history was absent, all three incremental postconditions were materially present, and production/QA were not modified. The later repair passed; do not repeat the package, repair or rollback. [PRODUCTION_MIGRATION_METADATA_REPAIR_AUTHORIZATION_PACKAGE_20260722.md](PRODUCTION_MIGRATION_METADATA_REPAIR_AUTHORIZATION_PACKAGE_20260722.md) remains historical evidence. `db push` remains locked.

## Historical QA metadata gate update - 2026-07-22

El gate QA autorizado está PASS: metadata oficial reparada con tres incrementales, baseline ausente, fingerprint y conteos sin cambios, producción intacta. La acción siguiente en aquel momento era un gate independiente de metadata para producción; ese gate separado pasó posteriormente y no debe repetirse. `db push` continúa bloqueado. Evidencia: [QA_MIGRATION_METADATA_REPAIR_GATE_20260722.md](QA_MIGRATION_METADATA_REPAIR_GATE_20260722.md).

## Estado actual

Este roadmap es la columna vertebral final para cerrar Costa Clean App sin repetir auditorías ya resueltas ni ejecutar pruebas ambiguas.

Estado cerrado hasta ahora:

- Sistema universal de corrección y releases: cerrado.
- Auditoría total de la app: cerrada.
- P1 `anon key` como `Authorization Bearer`: corregido.
- RLS/RPC write-path: validado en QA y aplicado en producción.
- Smoke real productivo de RLS/RPC: ejecutado, limpiado y documentado.
- P0 anonymous read: auditado, cerrado en QA y aplicado en producción.
- `db push`: bloqueado por protección documental y scripts fail-closed.
- Migration history audit read-only: completado.

Último estado conocido antes de este roadmap:

- Producción Costa Clean: `wfxnwfcdjainpojhbdri`.
- QA Costa Clean: `kpvvydthlxupjjqqdpxy`.
- Último commit operativo reportado: `04ba49ea38238bb266d1417e3ff1e41eb95be04a` o posterior.
- Tests reportados: `206/206`.
- Facturas/cobros/cierres durante gates de seguridad: `0` operaciones.
- Full-submit: no ejecutado.
- Secretos versionados: `0`.

## Reglas permanentes

Estas reglas aplican a todos los gates restantes:

1. No ejecutar `db push`.
2. No ejecutar `migration repair` real sin autorización separada.
3. No tocar Supabase producción sin gate explícito.
4. No tocar Supabase QA oficial sin gate explícito.
5. No tocar facturas, cobros, cierres, `invoice_number`, `display_code` fiscal ni secuencias fiscales sin autorización explícita.
6. No ejecutar full-submit.
7. No usar `service_role` en frontend.
8. No imprimir ni versionar secretos, connection strings, cookies, dumps, storageState ni carpetas privadas.
9. No commitear `.env.local`, `.env.qa.local`, `.auth/`, `.auth/sandbox/`, `qa-reports/private/`, `qa-screenshots/private/` ni `.project-agent/private/`.
10. Cada gate versionable debe cerrar con validación proporcional, commit y push.
11. Si un gate necesita credenciales, proyecto desechable, producción, repair real o writes sensibles, debe detenerse y pedir autorización explícita.

## Gates pendientes obligatorios

### Gate 1 — Migration Manifest And Disposable Repair Proof

**Estado actual:** Local disposable proof DONE; remote Supabase disposable proof deferred por limitación del plan gratuito.

Entrega documental existente: commit `bca5189209a4e7662164af803754a5b759ac1a9e`.

- Manifiesto canónico: completo; no repetir.
- Repair plan: completo; no repetir.
- Documento de estado del proof: actualizado con proof local `SÍ` y proof Supabase remoto `NO`.
- Proof local descartable: ejecutado en PostgreSQL 17.10, con clúster eliminado.
- Proof Supabase remoto: diferido; no hay tercer destino disponible.

Trabajo documental entregado:

- Se creó el manifiesto canónico de migraciones.
- Se separó conceptualmente la baseline QA-only de las migraciones incrementales productivas.
- Se resolvió la colisión de versiones `20260721` a nivel de estrategia/documentación.
- Se definieron orden canónico, hashes, alcance y estado material.
- La estrategia se probó en PostgreSQL local descartable: baseline, incrementales, hashes, orden y metadata simulada pasaron.
- La prueba en Supabase Cloud no se ejecutó y no se declara equivalente.
- QA oficial y producción no se tocaron.

Entregables existentes:

- `docs/SUPABASE_MIGRATION_MANIFEST_20260722.md`
- `docs/SUPABASE_MIGRATION_REPAIR_PLAN_20260722.md`
- `docs/SUPABASE_DISPOSABLE_REPAIR_PROOF_20260722.md`
- `docs/FINAL_CLOSEOUT_CHECKLIST.md`

Criterio de cierre:

- Límite documental: cerrado en `bca5189209a4e7662164af803754a5b759ac1a9e` con bloqueo externo documentado.
- Local disposable proof: DONE con ejecución real.
- Remote disposable proof: deferred; no declarar Supabase Cloud PASS.
- `db push` sigue bloqueado.
- Repair real sigue bloqueado.
- Producción modificada: NO.
- QA oficial modificada: NO.
- Entrega documental versionada en el commit citado; cualquier reconciliación posterior requiere autorización separada para commit/push.

Recurso y autorización exactos requeridos para reabrir únicamente el proof:

1. Un tercer ref de proyecto o branch Supabase desechable, distinto de `kpvvydthlxupjjqqdpxy` y `wfxnwfcdjainpojhbdri`.
2. Una credencial privada de operador/DB entregada por canal privado y conservada fuera del repositorio.
3. Un mecanismo probado de descarte o restauración para ese destino exacto antes de cualquier write.
4. Autorización explícita para writes de schema e historial de migraciones únicamente en ese destino desechable.

La limitación de cuenta mantiene diferido ese proof remoto. Históricamente, el siguiente gate fue un paquete de autorización separado para repair de metadata en QA oficial; los repairs metadata-only de QA y producción se completaron después bajo autorizaciones independientes. Esta evidencia no equivale a proof remoto Supabase ni desbloquea `db push`.

### Gate 2 — Migration History Repair Authorization Package

**Estado actual:** Closed by later separately authorized metadata-only gates in QA and production. The historical local-proof limitation below remains valid evidence and never authorized either remote action by itself. `db push` remains blocked because metadata repair did not prove a safe CLI zero-SQL transition.

Objetivo:

- Preparar paquete de autorización para repair real.
- Definir si se repara QA, producción o ambos.
- Definir exactamente qué versiones registrar y cuáles son `never-push`.
- Definir rollback y verificación de plan vacío posterior.
- No ejecutar repair todavía salvo autorización explícita.

Criterio de cierre:

- Paquete de autorización claro, aprobado o bloqueado.
- Sin writes remotos salvo autorización explícita.
- `db push` sigue bloqueado salvo gate específico de desbloqueo.
- Commit/push realizado.

### Gate 3 — Workspace / Tenancy / Ownership Security Model

**Estado actual:** Closed — conditional temporary acceptance documented on 2026-07-22.

Objetivo:

- Decidir si el modelo `authenticated single-workspace` es aceptable para Costa Clean.
- Auditar tablas y RLS desde perspectiva multiusuario.
- Definir roles posibles: owner/admin, supervisor, empleado, contabilidad y solo lectura.
- Decidir si se requiere `workspace_id`, `user_id`, `role`, `team_id` u otro modelo.
- No aplicar cambios destructivos en este gate salvo autorización.

Criterio de cierre:

- The current authenticated single-workspace model is accepted only while Costa Clean remains one mutually trusted workspace.
- Adding another company or differently trusted users requires a separately authorized ownership model first.
- Current guarantees/non-guarantees, table evidence, role matrix, invalidation conditions and a QA-first phased technical plan are documented.
- No schema, policy, grant, RPC, Auth, data, application-code, QA or production change was made.
- The continuation produced a reviewable documentation-only diff; the separately authorized closeout sprint validated and published exactly the five Gate 3 documents.

Evidence: [WORKSPACE_TENANCY_OWNERSHIP_SECURITY_MODEL_20260722.md](WORKSPACE_TENANCY_OWNERSHIP_SECURITY_MODEL_20260722.md).

### Gate 4 — Public Quiz RPC Abuse Protection

**Estado actual:** Gate 4A audit/design DONE. Gate 4B QA implementation BLOCKED pending authorization. Gate 4C production BLOCKED pending QA PASS and separate authorization.

Objetivo:

- Proteger el RPC público del quiz conservando el envío legítimo.
- Añadir validaciones anti-abuso.
- Evaluar rate limiting, honeypot, captcha, cooldown, validación de payload, origen y logs.
- No reabrir lectura anónima sensible.

Criterio de cierre:

- QA PASS.
- Producción gate separado si hay cambios de schema/RPC.
- No exposición de datos.
- Commit/push realizado.

### Gate 5 — Production Functional Smoke Final

**Estado inicial:** Blocked by Gates 1–4 or manual decision.

Objetivo:

- Ejecutar smoke final de producción sin writes financieros.
- Verificar login/logout, dashboard, clientes, propiedades, leads, presupuestos, servicios, facturas, cobros, gastos y cierre fiscal en modo lectura o interacción no destructiva.
- Verificar mobile/tablet/desktop básico.
- No ejecutar full-submit, facturas, cobros ni cierres.

Criterio de cierre:

- Checklist PASS.
- P0/P1 abiertos: `0`.
- Producción operativa.
- Release log actualizado.
- Roadmap marcado como cerrado.

## Gates opcionales post-cierre

### Optional A — Asset / Bundle Optimization

- Optimizar PNG/SVG e imágenes pesadas.
- Revisar bundle budget.
- Aplicar lazy loading si procede.

### Optional B — CSS / Layout Consolidation

- Consolidar CSS duplicado.
- Reducir vistas legacy.
- Modularizar componentes grandes de forma incremental.

### Optional C — UX Polish Pass

- P3/P4 visual.
- Microcopy.
- Estados vacíos.
- Botones, jerarquía y responsive menor.

## Definition of Done final

El roadmap final queda cerrado cuando:

1. Gate 1 tiene su límite documental cerrado y su proof desechable ejecutado, o el bloqueo externo sigue aceptado explícitamente sin avanzar Gate 2.
2. Gate 2 está cerrado o diferido explícitamente con protección activa.
3. Gate 3 está cerrado.
4. Gate 4 está cerrado.
5. Gate 5 está cerrado.
6. Riesgos P0/P1 abiertos: `0`.
7. `db push` está bloqueado o reconciliado con autorización y prueba.
8. Producción está operativa.
9. Tests pasan.
10. Release log y checklist final están actualizados.

## Próxima acción

Gate 3 and Gate 4A are closed. The next active gate is Gate 4B, QA-only implementation of the reviewed Turnstile + Edge + private RPC design. It must not start without the exact authorization and external prerequisites in the Gate 4A package. Gate 4C production remains separate and blocked.

Gate 1 historical proof limits and the completed QA/production metadata evidence remain preserved. The database-push lock remains active. The unrelated `358/360` visual/harness residual from the production metadata gate also remains open and separate; Gate 3 does not resolve it.
