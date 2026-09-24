# POST-V3 N4 — Servicios recurrentes y planificación operativa

## Estado de esta iteración

- Rama: `codex/post-v3-n4-recurring-services`
- Base: `1da17e0a0edca8b874fee84e668f22d0263b5e01`
- Alcance: Phase 0/1, aplicación local y CostaClean QA únicamente.
- Producción: no consultada, no modificada y sin deployment.
- QA autorizado: `kpvvydthlxupjjqqdpxy` (CostaClean QA).
- Migraciones de producto aplicadas en QA: `n4_recurring_service_plans`.
- Migraciones correctivas de producto aplicadas solo en QA: `n4_correct_internal_staff_read_policies`, `n4_grant_internal_staff_read_access` y `n4_grant_authenticated_rls_helper_execute`.
- Migraciones QA-only aplicadas solo en QA: `n4_func_teardown_qa` y `n4_func_teardown_root_pattern_correction_qa`.

## Auditoría de Phase 0

El modelo previo tenía `public.jobs` y `public.job_lines` para servicios puntuales, y `recurring_invoice_plans` para facturación recurrente. No existía una persistencia de recurrencia de servicios ni un RPC de generación. La recurrencia de facturas permanece separada y no genera servicios.

El slice N4 introduce una regla de recurrencia, slots por día y ocurrencias generadas. Una ocurrencia se identifica por `(recurring_service_plan_id, occurrence_date)` y el job generado conserva `recurring_service_plan_id`, `recurring_occurrence_date` y `source_metadata`.

## Contrato implementado

- `recurring_service_plans`: cliente, inmueble, servicio, patrón, fechas, estado y plantilla de líneas.
- `recurring_service_plan_slots`: día ISO 1–7, hora opcional, duración en minutos y personal previsto.
- `recurring_service_occurrences`: estado `planned`, `skipped` o `generated`, datos operativos y job relacionado.
- `save_recurring_service_plan(jsonb)`: valida cliente, inmueble, fechas, frecuencia y plantilla.
- `save_recurring_service_plan_schedule(text, jsonb)`: valida y persiste los slots por día.
- `generate_recurring_service_occurrences(text, date, date)`: limita el horizonte a 90 días, usa fechas civiles y es idempotente.
- `set_recurring_service_plan_status(text, text)`: pausa, reactiva, finaliza (`ended`) o archiva un plan.
- `set_recurring_service_occurrence(text, date, text, jsonb)`: omite o edita una ocurrencia no iniciada; protege jobs en curso/completados.

La generación crea jobs y `job_lines`, nunca facturas ni pagos. No hay cron, colas, dependencias externas, asignación de trabajadores ni nómina en esta fase.

## UX

Servicios conserva su agenda existente y ahora ofrece “Crear recurrencia”. El StepFlow usa:

1. Cliente e inmueble
2. Frecuencia y fechas
3. Servicio, hora, duración y personal previsto por día
4. Revisar

La lista muestra planes, horizonte explícito de 30/60/90 días y próximos servicios con cliente, inmueble, duración, personal y estado. También permite editar la serie futura, editar una occurrence y omitir/reactivar una occurrence mediante los RPC canónicos.

## Seguridad y aislamiento

Las tablas tienen RLS de lectura para personal interno autenticado. Las escrituras pasan por funciones protegidas y los RPCs se revocan para `public`/`anon`. Las ACL correctivas mantienen `anon/public` sin acceso, no conceden escritura directa y no conceden uso del schema privado. Las funciones QA de planner/teardown son `SECURITY DEFINER`, tienen `search_path` vacío, exigen issuer QA + staff interno y validan un run-id exacto de 32 hex.

## Evidencia

- Tests locales: `574 passed`, `0 skipped`.
- Focused N4/N1 contract: `45/45 passed`.
- Agents: `294/294 PASS`.
- Lint: PASS.
- TypeScript: PASS.
- Build: PASS.
- `git diff --check`: PASS.
- Secret scan de cambios: PASS.
- QA migration read-back: funciones, tablas, índices, RLS y permisos presentes.
- QA migration history: entradas N4 de producto y soporte QA presentes; no se modificó manualmente el historial.
- Smoke visual autenticado oficial: PASS en la matriz ejecutada, incluida la navegación de Jobs y los anchors móviles/tablet/desktop.
- Regresión N3: PASS; `QA_N3_RESIDUE=0`, gap de numeración `0`, sin cambios de negocio real.
- Regresión N2: PASS; concurrencia de settlement con una sola fila de pago, sin overpayment y cleanup idempotente.

## Certificación funcional QA_N4_FUNC

La sesión Edge aislada fue recuperada por el harness oficial, sin bypass ni extracción de credenciales. La prueba de teardown sacrificial y el run funcional se ejecutaron con tokens exactos y cleanup en `finally`.

- Planner: run-id exacto, issuer QA, staff interno y protección de raíces externas.
- Run sacrificial: `2` occurrences/jobs y segunda limpieza con `0` acciones.
- Run funcional: creación, slots laborables/fines de semana, idempotencia, horizonte de 90 días, pausa/reactivación, edición y skip, edición de serie, límites start/end, cruce de año, `Europe/Madrid`, DST y cero efectos invoice/payment: PASS.
- Teardown funcional: `12` jobs, `12` líneas, `12` occurrences, `3` slots y `1` plan; segunda limpieza `0`.
- Residuo `QA_N4_FUNC`: `0`; cambios de filas reales: `0`.

## Cierre diferencial N1 y cierre desatendido

La revisión diferencial se ejecutó contra el delta completo N4, incluyendo el
working tree y los harnesses QA. Los propietarios N1 verificados son:

- `src/app/useAppData.ts`: focus, `visibilitychange`, `online/offline`, polling
  visible a 60 segundos, Realtime e higiene de suscripciones.
- `src/app/refreshInvalidation.ts`: tabla Realtime a dominio y refetch canónico.
- `src/app/AppShell.tsx`: reset de detalle al volver a un módulo.

Ninguno de esos archivos cambió entre la base pre-N4 y `42fdba5`, ni en el
working tree N4; tampoco se añadió una arquitectura paralela ni un bypass del
refetch. Por tanto, foco, visibilidad y reconexión se clasifican
honestamente como `UNCHANGED_FROM_CERTIFIED_N1`, no como eventos físicos
reproducidos en esta ejecución desatendida.

La cobertura automatizada de contrato N1 pasó para handlers de focus,
visibility, reconnect, polling y cleanup de Realtime (`TEST_LEVEL_EVENT_SIMULATION`
no se presenta como evidencia de navegador físico). La evidencia live nueva de
N4 sí fue observada en dos contextos autenticados QA: Realtime
`postgres_changes` sobre `recurring_service_occurrences/jobs`, refetch canónico
en 173 ms, polling visible a 60.000 ms y cero suscripciones duplicadas o
stale. El job exacto `JOB-a7502983-69c7-49d2-8e71-7b0f347a7dd5`, plan
`PLAN-QA_N4_FUNC_0d6faf5dcc94c1284e102ae5be2a8e44-ROOT`, fecha `2026-09-28`,
apareció en el filtro `Próximos` sin recarga manual; la vista inicial `Hoy` lo
excluía legítimamente por fecha futura.

El harness visual autenticado mantuvo los anchors `390x844`, `820-class` y
`1440` sin regresión de producto; los fallos intermitentes observados en
targets aislados fueron pérdidas de shell/CDP del harness, no cambios de
producto, y no se usan para afirmar evidencia N1 física. El build, la matriz
visual certificada previa sobre el mismo árbol de producto y los checks
deterministas permanecen verdes.

### Veredicto

- `N1_DIFFERENTIAL_REGRESSION = PASS`
- `FOCUS_REFRESH_EVIDENCE = UNCHANGED_FROM_CERTIFIED_N1`
- `VISIBILITY_REFRESH_EVIDENCE = UNCHANGED_FROM_CERTIFIED_N1`
- `RECONNECT_REFRESH_EVIDENCE = UNCHANGED_FROM_CERTIFIED_N1`
- `N4_GENERATED_JOB_LIVE_REFRESH = PASS`
- `QA_N4_FUNC_RESIDUE = 0`
- `SECOND_CLEANUP_ACTIONS = 0`
- `P0/P1/P2/P3 = 0/0/0/0`
- `NO_FALSE_LIVE_CLAIMS = YES`
- `PRODUCTION_QUERIED = NO`, `PRODUCTION_MUTATIONS = 0`,
  `PRODUCTION_N4_MIGRATION = NO`, `PRODUCTION_DEPLOYMENT = NO`

La documentación refleja que no se simuló ni se afirmó replay físico de
focus, visibility u online.
