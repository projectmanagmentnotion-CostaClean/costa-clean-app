# Costa Clean App — Final Closeout Roadmap

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

**Estado actual:** Blocked — cerrado en el límite documental por recurso externo ausente.

Entrega documental existente: commit `bca5189209a4e7662164af803754a5b759ac1a9e`.

- Manifiesto canónico: completo; no repetir.
- Repair plan: completo; no repetir.
- Documento de estado del proof: completo con `Proof ejecutado: NO`.
- Proof desechable: no ejecutado.
- Bloqueo: falta un tercer destino Supabase desechable y autorización limitada para probarlo.

Trabajo documental entregado:

- Se creó el manifiesto canónico de migraciones.
- Se separó conceptualmente la baseline QA-only de las migraciones incrementales productivas.
- Se resolvió la colisión de versiones `20260721` a nivel de estrategia/documentación.
- Se definieron orden canónico, hashes, alcance y estado material.
- La prueba de reparación en un Supabase desechable no se ejecutó por falta del recurso externo requerido.
- QA oficial y producción no se tocaron.

Entregables existentes:

- `docs/SUPABASE_MIGRATION_MANIFEST_20260722.md`
- `docs/SUPABASE_MIGRATION_REPAIR_PLAN_20260722.md`
- `docs/SUPABASE_DISPOSABLE_REPAIR_PROOF_20260722.md`
- `docs/FINAL_CLOSEOUT_CHECKLIST.md`

Criterio de cierre:

- Límite documental: cerrado en `bca5189209a4e7662164af803754a5b759ac1a9e` con bloqueo externo documentado.
- Proof desechable: pendiente; no declarar PASS sin ejecución real.
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

Hasta recibir los cuatro elementos, el agente debe detenerse sin conexión ni writes. Gate 2 permanece bloqueado y `db push` no se desbloquea.

### Gate 2 — Migration History Repair Authorization Package

**Estado actual:** Blocked — Gate 1 no tiene proof desechable ejecutado; no avanzar.

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

**Estado inicial:** Ready.

Objetivo:

- Decidir si el modelo `authenticated single-workspace` es aceptable para Costa Clean.
- Auditar tablas y RLS desde perspectiva multiusuario.
- Definir roles posibles: owner/admin, supervisor, empleado, contabilidad y solo lectura.
- Decidir si se requiere `workspace_id`, `user_id`, `role`, `team_id` u otro modelo.
- No aplicar cambios destructivos en este gate salvo autorización.

Criterio de cierre:

- Modelo actual aceptado temporalmente o plan técnico definido.
- Riesgos documentados.
- Si se requieren cambios, primero deben ir a QA en gate separado.
- Commit/push realizado.

### Gate 4 — Public Quiz RPC Abuse Protection

**Estado inicial:** Ready.

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

## Próxima acción bloqueada

Gate 1 ya entregó el manifiesto y el repair plan en `bca5189209a4e7662164af803754a5b759ac1a9e`; no deben repetirse. Gate 2 permanece bloqueado y no es el siguiente gate ejecutable.

La única continuación permitida es pedir los cuatro elementos exactos descritos en Gate 1: tercer ref desechable, credencial privada de operador/DB, descarte o restauración probado y autorización explícita de writes de schema/historial solo para ese destino. Hasta entonces, detenerse. No simular proof, no tocar QA oficial/producción y no ejecutar `db push`.
