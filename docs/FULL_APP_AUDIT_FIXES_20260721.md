# Full App Audit Fixes — 2026-07-21

## Resumen

Se aplicaron dos correcciones mínimas derivadas de evidencia reproducible:

1. el harness QA rechaza targets que no sean Costa Clean
2. el alta de servicio desde propiedad abre en el primer paso accionable

No se modificaron contratos, persistencia, Supabase, auth, facturación, cobros, numeración ni `financialWriteApi`.

## Hallazgos corregidos

### P1 — Identidad del target QA

**Antes:** `detectLocalAppUrl` aceptaba la primera respuesta HTTP válida en `4173/5173`. Un servidor Vite de otro proyecto podía iniciar una auditoría inválida o consumir el timeout del shell.

**Cambio:**

- la detección local exige que el `<title>` identifique Costa Clean
- los runners visual y end-user vuelven a comprobar el título tras abrir la sesión CDP
- el setup de auth aplica el mismo guard
- `QA_EXPECTED_APP_TITLE` permite una marca explícita sin rebajar la validación
- se añadió cobertura que acepta `CostaClean CRM` y rechaza otro producto

**Riesgo:** bajo; afecta únicamente al preflight QA y falla cerrado.

### P2 — Primer campo del servicio contextual

**Antes:** un servicio abierto desde propiedad comenzaba en `Contexto` aunque cliente y propiedad ya estaban fijados. El dry-run tablet fallaba `firstFieldVisible`.

**Cambio:**

- `getJobCreateInitialStep` mantiene paso 0 para alta general o prefill solo de cliente
- cuando cliente y propiedad vienen fijados, comienza en paso 1 (`Agenda`)
- un prefill nuevo sincroniza también el paso inicial
- se añadió test puro para ambas rutas

**Riesgo:** bajo; solo cambia el paso visible inicial. Validación, guardado, datos y write path permanecen intactos.

## Hallazgos documentados pero no corregidos

- P1: PATCH/RPC directos en detalle de propiedad y estado de servicio usan anon key como bearer; requiere hardening autenticado y write-and-clean sandbox separado.
- P2: esas superficies muestran errores REST técnicos; debe corregirse junto al write-path.
- P2: PNG de marca pesados; requiere comparación visual/documental antes de sustituir por SVG.
- P3/P4: drift `kpis/settings`, CSS global grande, starter assets sin uso y componentes legacy extensos.

## Archivos funcionales modificados

- `src/features/jobs/jobCreatePrefill.ts`
- `src/features/jobs/JobCreateFlow.tsx`
- `src/features/entityCreationPrefills.test.ts`
- `scripts/qa/auth/cdpHarness.mjs`
- `scripts/qa/auth/cdpHarnessPaths.test.mjs`
- `scripts/qa/run-authenticated-visual-qa.mjs`
- `scripts/qa/run-end-user-flow-agent.mjs`
- `scripts/qa/setup-auth-state.mjs`

## Documentación modificada

- `docs/FULL_APP_AUDIT_20260721.md`
- `docs/FULL_APP_AUDIT_FIXES_20260721.md`
- `docs/UNIVERSAL_RELEASE_LOG.md`
- `docs/UX_DEBT_REGISTER.md`
- `docs/RISK_MAP.md`
- `docs/APP_TRANSFORMATION_ROADMAP.md`

## Validación realizada

### Baseline

- `npm run lint`: pass
- `npm run build`: pass
- `npm run test`: 38 archivos, 175 tests
- QA visual sandbox: `360/360`
- dry-run sandbox: `587/588`, fallo único en `service-from-property` tablet, 0 entidades creadas

### Verificación específica

- tests focalizados: 2 archivos, 7 tests
- build QA: pass después de ajustar la inferencia de `currentStep`
- guard de identidad: cobertura unitaria acepta Costa Clean y rechaza un título ajeno

### Post-fix

- `npm run lint`: pass
- `npm run build`: pass
- `npm run test`: 38 archivos, 177 tests
- QA visual sandbox: `360/360`
- dry-run sandbox: `588/588`
- acciones peligrosas omitidas por política: 3
- entidades creadas: 0
- full-submit: no ejecutado
- write-and-clean: no ejecutado

## Rollback

- Commit anterior: `dbd63b2bff6cbeb2037c180172c549c5c903793c`
- Commit nuevo: commit de esta entrega; el identificador final se informa en el cierre.
- Comando: `git revert <commit-de-esta-entrega>`
- Cuándo revertir: si el alta general deja de abrir en Contexto, el alta desde propiedad pierde su prefill, o el harness rechaza un build cuyo título aprobado identifica correctamente Costa Clean.
- Validación tras revertir: `npm run lint`, `npm run build`, `npm run test`, `npm run qa:visual:sandbox` y `npm run qa:flow:sandbox:dry`.

## Pendientes recomendados

1. Hardening de writes autenticados para propiedad/servicio en sandbox, con cleanup exacto y sin dominios financieros.
2. Presupuesto de assets/bundle con comparación visual de SVG/PNG y medición de carga.
3. Higiene incremental de CSS, módulos declarativos y superficies legacy, sin refactor transversal.

## Seguimiento QA autenticado RLS — 2026-07-21

La sesión real de QA se validó con HTTP 200 y bearer de usuario distinto de la anon key. `reassign_property_client` y `save_job_with_lines` persistieron correctamente. Los INSERT REST de cliente/propiedad devolvieron RLS `42501`; los PATCH REST de propiedad/estado devolvieron 200 con cero filas. El frontend ahora exige una representación de exactamente una fila para no declarar éxito falso. No se tocaron policies. Cleanup final: marcador temporal 0, seed demo intacto y finanzas `0/0/0`.

Evidencia: [QA_AUTH_RLS_WRITE_VERIFICATION_20260721.md](QA_AUTH_RLS_WRITE_VERIFICATION_20260721.md).

## RLS/RPC closure — 2026-07-21

The QA-only follow-up selected authenticated RPCs because the schema has no tenant ownership columns. Direct anon writes on clients/properties/jobs were closed, the affected frontend writes moved to allowlisted RPCs, and real QA persistence plus exact cleanup passed. Production was not changed.

Evidence: [RLS_WRITE_PATH_FIX_20260721.md](RLS_WRITE_PATH_FIX_20260721.md).

## Production RLS/RPC release follow-up — 2026-07-22

The exact QA-verified migration was applied to production ref `wfxnwfcdjainpojhbdri` after a private schema-only backup and read-only compatibility preflight. Post-apply introspection confirmed RLS, authenticated RPC guards/grants, the blocked legacy reassignment entry point, removal of six anon write policies, and zero unsafe authenticated write policies. The public deployment contains all coordinated RPC paths. No production business row, invoice, payment, closing, fiscal number, Auth setting, or full-submit flow was touched.

Evidence: [PRODUCTION_RLS_RELEASE_GATE_20260722.md](PRODUCTION_RLS_RELEASE_GATE_20260722.md).
