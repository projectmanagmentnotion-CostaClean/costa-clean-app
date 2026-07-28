# App Quality Gates

## Client Portal CP-3A UI/Auth Boundary Gate — DONE 2026-07-28

- `/portal` and all `/portal/*` paths resolve before CRM import to an independent
  bootstrap, stylesheet, navigation, page registry and access state machine.
- The production portal adapter is closed and read-only: unauthenticated access
  only, no Supabase/CRM import, no writes and no direct canonical-table path.
- The authenticated synthetic preview and its selector are development-only and
  absent from the production build.
- Explicit booting, unauthenticated, pending, authenticated, suspended, revoked,
  forbidden and generic-error outcomes fail closed without email-based tenancy.
- Visible local QA passed at `390x844`, adjacent iPad widths around the
  Windows-scaled 768 breakpoint, and `1366x900`, with no horizontal overflow.
- Focused tests pass 18/18; full suite passes `342` with `4` skips; agent package
  checks pass 160/160; lint and build pass.
- Secret/PII/direct-data scans found zero indicators. QA, production, Supabase,
  Auth, Edge, Storage, WordPress and SiteGround writes are zero.
- CP-3A is `DONE`; CP-3B.1 is next and has not started.
- Evidence:
  [client-portal/CP3A_PORTAL_UI_FOUNDATION_20260728.md](client-portal/CP3A_PORTAL_UI_FOUNDATION_20260728.md).

## Client Portal CP-2B V5 Cloud QA Boundary Gate — DONE 2026-07-27

- Exact Git, immutable hashes, private backup and triple QA identity passed
  before effects; production was rejected.
- The V5 runner executed exactly once and completed the migration, staff
  boundary, synthetic fixtures, SQL/HTTP matrices, Edge deployment, private
  Storage checks and exact cleanup.
- Independent reconciliation confirms 11/11 RLS plus `FORCE RLS` tables, one
  active internal staff membership, 4/4 portal Edge Functions and a private,
  empty `invoice-documents` bucket.
- Ten synthetic Auth users were created and deleted; synthetic users, fixtures
  and objects remaining are all zero.
- Financial tables stayed `0/0/0` and the public sequence catalog matches the
  private pre-run snapshot.
- The full suite passes `324` with `4` skips; lint and build pass. The frozen
  CP-2A.4 proof and three authenticated V5 cases remain pre-effect-only and
  reject the expected deployed poststate with `portal_prestate_rejected`.
- CP-2B is `DONE`; CP-3 is `NOT STARTED`.
- Evidence:
  [client-portal/CP2B_V5_QA_EXECUTION_20260727.md](client-portal/CP2B_V5_QA_EXECUTION_20260727.md).

## Client Portal CP-2A.4 PostgreSQL Secret Transport Gate — DONE 2026-07-27

- V4 was reproduced rejecting `CP2B_QA_DATABASE_URL` as a sensitive argument before its later `PG*` transformation; Windows and Linux spies proved zero spawned processes and effects.
- V5 reads the URL only from the private environment, rejects production/unknown targets, creates a minimal PostgreSQL child environment and removes the URL, Supabase keys/tokens and portal peppers before invoking the frozen V3 launcher.
- Live QA proof passes CLI identity, PostgreSQL `SELECT 1`, exact staff UUID, portal prestate and production rejection with zero remote writes.
- The mandatory order is `postgres_pre_effect_check -> ledger_create -> auth_create`; connectivity failure cannot create a ledger or reach the Auth Admin API.
- V5 authenticated tests pass 36/36. V1–V4 artifacts and the migration remain byte-for-byte intact.
- V5 is `PREPARED_NOT_AUTHORIZED`; CP-2B is `BLOCKED_PENDING_EXPLICIT_V5_AUTHORIZATION`; CP-3 is `NOT STARTED`.
- Evidence: [client-portal/CP2A4_POSTGRES_SECRET_TRANSPORT_FIX.md](client-portal/CP2A4_POSTGRES_SECRET_TRANSPORT_FIX.md), [client-portal/CP2B_EXACT_QA_AUTHORIZATION_V5.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION_V5.md).

## Client Portal CP-2A.3 Bootstrap Contract Gate — DONE 2026-07-27

- The V3 incident is reconciled to a frozen wrapper/migration contract mismatch: `staff_role` versus `role`, plus incorrect inclusion of synthetic suspended staff in an active-only bootstrap.
- Disposable PostgreSQL 17 reproduced SQLSTATE `42703` at the immutable migration and proved transactional zero-schema residue.
- V4 creates exactly `cp2a_bootstrap_staff(user_id uuid primary key, role text not null)`, validates the real active Auth identity, and bootstraps only that identity as `admin`.
- Frozen V2 fixtures remain responsible for inserting synthetic suspended staff as `operator / suspended`.
- Local baseline and restored private QA public-schema proofs pass migration, 11/11 RLS/FORCE RLS tables, staff separation, parameterized matrix, exact cleanup, recovery and zero residue.
- All original 16, V2 eight and V3 five artifacts remain byte-for-byte intact. V4 is `PREPARED_NOT_AUTHORIZED`; QA, production, Edge, Storage, remote Auth and SQL writes are zero.
- V4 tests, PostgreSQL proofs, full suite, lint and build pass. The frozen CP-2A.2 authenticated proof also passes through the authorized private-auth process, including QA link, production rejection, secret redaction and negative execution gates.
- CP-2B is `BLOCKED_PENDING_EXPLICIT_V4_AUTHORIZATION`; CP-3 is `NOT STARTED`.
- Evidence: [client-portal/CP2A3_BOOTSTRAP_CONTRACT_FIX.md](client-portal/CP2A3_BOOTSTRAP_CONTRACT_FIX.md), [client-portal/CP2B_EXACT_QA_AUTHORIZATION_V4.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION_V4.md).

## Client Portal CP-2A.2 Windows Runner Gate — DONE 2026-07-27

- The clean CP-2B V2 block was confirmed as `spawnSync` attempting to execute the npm `supabase.cmd` shim directly on Windows and returning `EINVAL` before ledger creation.
- V3 executes `supabase/dist/supabase.js` directly with Node and provides a restricted `ComSpec` compatibility path with quoted tokens, control/metacharacter rejection, timeout, hidden windows, bounded buffers, and redacted failures.
- Real Windows `.cmd`, Supabase version, authenticated project listing, QA-linked/production-not-linked identity, path/argument spaces, timeout, nonzero exit, injection rejection, sensitive-argument rejection, and non-Windows direct execution pass.
- The original 16 and V2 eight artifacts remain byte-for-byte intact. V3 is `PREPARED_NOT_AUTHORIZED`; no npm execute alias exists.
- QA, production, Auth users, Edge, Storage, SQL, WordPress, `/portal`, and CP-3 writes are zero. CP-2B is `BLOCKED_PENDING_EXPLICIT_V3_AUTHORIZATION`.
- Evidence: [client-portal/CP2A2_WINDOWS_RUNNER_FIX.md](client-portal/CP2A2_WINDOWS_RUNNER_FIX.md), [client-portal/CP2B_EXACT_QA_AUTHORIZATION_V3.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION_V3.md).

## Client Portal CP-2A.1 QA-compatible Package Gate — DONE 2026-07-27

- The prior CP-2B block was confirmed legitimate: frozen local-disposable fixtures, fixed Auth UUID assumptions, and a plan-only runner were not QA-executable.
- The 16 original artifacts remain byte-for-byte frozen; a separate eight-artifact V2 manifest supplies dynamic Admin API Auth UUIDs, exact IDs, private ledger, parameterized matrix, exact cleanup, and disable-first recovery.
- PostgreSQL 17 disposable proof passed with runtime-generated Auth UUIDs, migration, fixtures, cross-client matrix, cleanup, Auth deletion, rollback, zero residue, production/unknown/missing-input/hash/ledger rejection, and cluster discard.
- `--plan` remains `NOT_AUTHORIZED`; preflight performs zero writes and reports private inputs only as `PRESENT`/`MISSING`.
- QA, production, WordPress, remote Auth, Edge, Storage, schema, and data writes are zero. CP-2B is `BLOCKED_PENDING_EXPLICIT_V2_AUTHORIZATION`; CP-3 is `NOT STARTED`.
- Evidence: [client-portal/CP2A1_QA_EXECUTION_PACKAGE.md](client-portal/CP2A1_QA_EXECUTION_PACKAGE.md), [client-portal/CP2B_EXACT_QA_AUTHORIZATION_V2.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION_V2.md).

## Client Portal CP-2A Source Security Gate — DONE 2026-07-23

- Initial HEAD and source impact map were verified before edits.
- The migration introduces explicit active-staff authorization before portal membership and hardens canonical policies, grants and legacy RPC guards.
- Eleven portal/staff/security tables use RLS plus `FORCE RLS`; customer direct canonical access remains denied.
- Four QA-locked Edge boundaries enforce exact contracts, verified Auth, generic errors, server-only secrets and 60-second exact-path document signing.
- PostgreSQL 17.10 disposable apply/matrix/cleanup/rollback/reapply proof passed with zero residue and cluster discard.
- QA, production, Auth users, remote Storage/Edge and remote writes remain zero. CP-2B is not authorized.
- Evidence: [client-portal/CP2A_IMPLEMENTATION_PACKAGE.md](client-portal/CP2A_IMPLEMENTATION_PACKAGE.md), [client-portal/CP2A_LOCAL_PROOF.md](client-portal/CP2A_LOCAL_PROOF.md), [client-portal/CP2B_EXACT_QA_AUTHORIZATION.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION.md).

## Client Portal CP-0 / CP-1 Design Gate - DONE 2026-07-23

- The public website is verified as WordPress/Elementor on SiteGround with WPForms and Complianz. No public-website Git repository exists in the connected/local repository scope; a versioned export and deployment procedure are mandatory before CP-4.
- The portal route is fixed to `https://app.costacleanbcn.com/portal` and the trust flow is `website -> portal UI -> Supabase Auth -> portal-specific RPC/Edge/RLS -> canonical CRM`.
- Email matching never creates a membership or client. Existing clients use exact staff-selected invitations; open registration remains pending with zero CRM data until manual approval.
- The current any-authenticated canonical read/write guards are a P0 blocker for portal identities. CP-2 must atomically introduce explicit internal staff authorization before creating any customer Auth user.
- Canonical CRM tables are deny-by-default to customer sessions. Only narrow, membership-checked projections/RPC/Edge endpoints are allowed.
- Invoice documents require a dedicated private bucket, opaque keys, fresh ownership validation, 60-second signed access, no public/list access and privacy-safe audit.
- Service requests cannot create or mutate jobs, quotes, invoices, payments, closings or sequences.
- The complete anonymous/pending/revoked/member/admin/internal-staff cross-client matrix must pass in QA before portal UI work.
- Privacy information, contractual acceptance, optional marketing consent and cookie consent are separate decisions and evidence records.
- Legal pages, retention, processors, transfers, rights, closure, security, breach response and ROPA are specified but remain pending verified facts and professional legal approval.
- CP-2B remains unauthorized; production and QA changes through CP-2A are zero.
- Evidence: [client-portal/ARCHITECTURE.md](client-portal/ARCHITECTURE.md), [client-portal/RLS_SECURITY_SPEC.md](client-portal/RLS_SECURITY_SPEC.md), [client-portal/LEGAL_COMPLIANCE_MATRIX.md](client-portal/LEGAL_COMPLIANCE_MATRIX.md), [client-portal/QA_AUTHORIZATION_PACKAGE.md](client-portal/QA_AUTHORIZATION_PACKAGE.md).

## Gate 5 — production functional smoke and Auth logout — DONE 2026-07-23

- One centralized flow uses the existing Supabase client, prevents duplicate sign-out calls, disables while pending and clears authenticated state only after success.
- `SIGNED_OUT` updates the UI; failure preserves the session and exposes only a generic toast.
- Visible Chrome proved logout, protected-content removal, Back/reload denial, human login, post-login persistence and read-only navigation across ten authenticated modules.
- Desktop `1440x900`, tablet `768x1024` and mobile `390x844` each expose one logout control, stay inside the viewport and return focus on `Escape`.
- The public quiz exposes no account control or authenticated navigation.
- Lint/build and `239/239` tests pass; both database-push locks fail closed; business, financial/fiscal and real-data writes are `0`.
- Gate 5 `DONE`; roadmap `CLOSED`; production `READY FOR NORMAL OPERATION`; P0/P1 open `0`.
- Evidence: [GATE_5_PRODUCTION_FUNCTIONAL_SMOKE_FINAL_20260723.md](GATE_5_PRODUCTION_FUNCTIONAL_SMOKE_FINAL_20260723.md).

## Gate 4C — public quiz abuse protection in production — DONE 2026-07-23

- The already-applied migration, production-only pepper, active Edge Function and frontend deployment were verified read-only and were not repeated.
- Production identity passed through public config, linked state, Management API metadata and live PostgreSQL 17; QA was explicitly rejected.
- The 12-case `PROD-GATE4C-*` matrix passed, including authoritative scoring and anonymous denial of the private RPC, legacy RPC, history and direct insert.
- Log privacy passed with three matching custom events and zero sensitive-value findings.
- Exact cleanup deleted one synthetic attempt and two captured guards; postflight proved `0` synthetic attempts, `0` guards and six real attempts unchanged.
- Financial/fiscal data, real-data digests, sequence state and migration history were unchanged. Both `db push` locks remain active and the secret scan found zero versioned secrets.
- At this historical Gate 4C closeout, Gate 5 had not started; Gate 5 subsequently passed on 2026-07-23.
- Evidence: [GATE_4C_PUBLIC_QUIZ_PRODUCTION_RELEASE_20260723.md](GATE_4C_PUBLIC_QUIZ_PRODUCTION_RELEASE_20260723.md).

## Gate 4B — providerless public quiz abuse protection in QA — DONE 2026-07-22

- Exact QA identity passed through public config, linked/authenticated CLI state and private/live PostgreSQL 17 state; production was rejected and not modified.
- One reviewed 14-digit migration created the private RPC and minimum HMAC guard storage; local disposable proof and QA transactional apply passed without `db push` or history writes.
- The public QA Edge Function is active with strict contract/body/timing/honeypot checks, server-authoritative scoring, generic errors and privacy-safe custom logging.
- Live legitimate, malformed, oversized, unknown-field, honeypot, too-fast, replay, cooldown, direct-RPC, history-read and direct-insert tests passed; exact cleanup left zero synthetic attempts and zero guard rows.
- Gate 4C later passed under its separate production authorization.
- Evidence: [GATE_4B_PROVIDERLESS_QA_EXECUTION_20260722.md](GATE_4B_PROVIDERLESS_QA_EXECUTION_20260722.md).

## Gate 4A — public quiz RPC abuse-protection design — DONE 2026-07-22

- Source-only: no QA/production/RPC/schema/provider mutation.
- Current contract, grants, table, frontend call and missing controls audited.
- Recommended architecture: Turnstile server validation + Edge ingress + private transactional RPC + short-lived peppered-HMAC throttling.
- Gate 4B cannot pass without exact target/hash/backup proof, strict payload boundaries, server-authoritative scoring, direct RPC denial, anonymous-history denial, replay/burst/provider-outage tests, privacy-safe logs and complete synthetic cleanup.
- Gate 4B QA and Gate 4C production each require separate authorization. `db push` remains locked.
- Evidence: [PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_AUTHORIZATION_PACKAGE_20260722.md](PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_AUTHORIZATION_PACKAGE_20260722.md).

## Production Migration Metadata Repair Gate - 2026-07-22

- Execution requires exact separate user authorization, triple production identity, fresh private rollback and canonical hash allowlist.
- The only permitted mutation is the CLI-compatible metadata schema/table plus exactly three canonical incremental rows; baseline and unknown entries are forbidden.
- Pre-commit and post-commit verification must preserve public fingerprint, table inventory/counts, sequences, invoice identifiers and material sentinels.
- Current result: PASS. Migration bodies, business schema/data, QA, full-submit and financial/fiscal writes were untouched.
- `db push` remains locked until a separate gate proves the physical repository migration chain produces safe zero pending SQL.
- Evidence: [PRODUCTION_MIGRATION_METADATA_REPAIR_GATE_20260722.md](PRODUCTION_MIGRATION_METADATA_REPAIR_GATE_20260722.md).

## Production Migration Metadata Repair Authorization Package Gate - 2026-07-22

- This gate is read-only and may validate only the exact production ref while explicitly rejecting QA and unknown refs.
- Package PASS requires empty current history, exact canonical hashes, material presence of all three incrementals, baseline exclusion, a current schema-only fingerprint, a guarded transaction proposal and exact rollback design.
- Material postconditions may establish that migration bodies are unnecessary, but cannot be presented as a general CLI zero-SQL plan while filenames and the QA baseline remain unresolved.
- The package never authorizes its own production write. A later sprint requires the exact separate production metadata-only authorization recorded in the package.
- Production and QA changes for the package sprint must be zero; both npm push locks remain mandatory.
- Evidence: [PRODUCTION_MIGRATION_METADATA_REPAIR_AUTHORIZATION_PACKAGE_20260722.md](PRODUCTION_MIGRATION_METADATA_REPAIR_AUTHORIZATION_PACKAGE_20260722.md).

## QA Official Migration Metadata Repair Gate - 2026-07-22

- Target identity requires exact agreement between public QA ref, private pooler user and live PostgreSQL session; production ref or any other ref aborts.
- Before mutation, metadata must be absent and private pre-state/rollback evidence must exist with no credentials or business data.
- The only permitted write is one transaction creating the CLI-compatible history schema/table and registering the three canonical incrementals with exact hashes.
- The QA-only baseline is forbidden from history; migration SQL, business schema/data, full-submit and `db push` are forbidden.
- Pass requires exact metadata, unchanged public-schema SHA-256, unchanged 17-table inventory and row counts, unchanged function/policy sentinels and production untouched.
- Current result: PASS. Production remains a separate unauthorized gate and both npm push locks remain mandatory.
- Evidence: [QA_MIGRATION_METADATA_REPAIR_GATE_20260722.md](QA_MIGRATION_METADATA_REPAIR_GATE_20260722.md).

## Purpose

These gates define the minimum quality bar for any future app work. A change should not be considered complete if it fails any mandatory gate.

## UX Gate

- The screen has one dominant decision.
- The primary action is visually obvious.
- Blocks are grouped by user intent.
- Non-essential text is removed or reduced.
- Metrics exist only if they change a decision.
- The user can understand what is happening, what it means, and what to do next.

## StepFlow Gate

- Important flows use StepFlow instead of ad hoc long forms.
- Each step has one purpose.
- Progress is visible.
- Back and continue behavior are predictable.
- Validation happens at the right moment.
- Review and success states exist where needed.
- The flow reduces cognitive load instead of redistributing it.

## Engineering Gate

- Scope is isolated to the requested area.
- No unrelated refactor is included.
- Existing contracts are preserved unless explicitly targeted.
- Shared primitives are preferred over one-off patterns.
- States are explicit and maintainable.
- The implementation is readable and reviewable.

## Verification Gate

- `npm run lint` passes.
- `npm run build` passes.
- Git diff is understandable.
- Risks, assumptions, and unverified areas are stated honestly.
- The final report matches what was actually tested.
- Si se declara QA visual autenticada iPhone, debe citar al menos el viewport principal realmente usado y los problemas reales encontrados.

## Mobile Gate

- The first mobile viewport shows purpose and next action clearly.
- Primary actions are reachable and obvious.
- Layout remains usable on narrow screens.
- Dense tables or multi-column assumptions are avoided or safely adapted.
- Critical flows are completable on mobile without confusion.

## Mobile iPhone Gate

- Ninguna pantalla iPhone debe abrir como informe largo.
- Home no puede abrir con listas o bloques extensos.
- Factura y cierre fiscal deben abrir con resumen y CTA, no con detalle completo.
- Filtros avanzados no deben empujar verticalmente el listado en mobile.
- El bottom nav no puede tapar contenido ni CTA sticky.
- StepFlow no puede introducir scroll horizontal para mostrar el progreso.
- El filtro visible por defecto debe ser sutil y compacto, no una card protagonista.
- Las tarjetas de listas deben priorizar lectura rapida y altura contenida.
- Los detalles deben aprovechar el ancho real de la pantalla y evitar encapsulacion redundante.
- Un panel debug no puede convivir con su equivalente operativo abierta en la misma zona.

## Fiscal Closing Real Amount Gate

- `Cierre fiscal` debe abrir con un importe real exacto y un periodo explicito.
- El primer viewport no puede repartir protagonismo entre total, base, IVA y contexto expandido.
- Si existe desglose fiscal, debe quedar plegado o fuera del flujo principal.
- Si no hay facturas emitidas en el periodo auditado, la UI debe decirlo de forma directa y mantener `0,00 €` como importe real.
- Si se muestra una cifra de facturacion, debe quedar claro si es base imponible o total emitido.

## Accessibility Gate

- Focus behavior is coherent.
- Keyboard access remains functional where applicable.
- Contrast supports readability.
- Touch targets are usable.
- Error states are understandable without relying only on color.
- Structure and labeling remain semantically meaningful.

## Motion Gate

- Motion has a functional purpose.
- `prefers-reduced-motion` is respected.
- Animations clean up correctly.
- Animations do not block interaction or obscure data.
- Motion does not create ambiguity in critical business states, amounts, numbering, or fiscal warnings.
- Large lists, dense modules, and critical domains avoid uncontrolled stagger or decorative transitions.
- SVG charts stay lightweight, data-honest, and tied to existing metrics.
- Scroll-based motion remains `once`, subtle, and non-blocking unless a dedicated sprint explicitly widens scope.

## Density Gate

- StepFlow, overlays y barras sticky deben priorizar compactacion antes que nuevos elementos.
- Ningun header compartido debe duplicar la misma idea en tres bloques de copy.
- La compactacion no puede bajar objetivos tactiles por debajo de `44px`.
- Reducir texto es obligatorio cuando el mismo mensaje ya aparece en titulo, estado y footer.
- Facturas y dominios criticos solo pueden compactarse a nivel visual, nunca alterando señales de warning.

## Operational Detail Gate

- El primer bloque del detalle debe resolver identidad, estado y siguiente accion.
- Documento, contexto, historico y admin deben vivir con menor contraste o bajo colapso.
- No repetir cliente, servicio, estado, notas o importes en varias cards abiertas a la vez.
- En mobile, cada caja adicional debe justificar una decision distinta; si no, debe integrarse en una superficie existente.

## Detail Density Gate

- Dos capas visuales que explican lo mismo en el mismo viewport cuentan como regresion.
- Si una vista depende de cajas dentro de cajas para ordenar el detalle, hay que simplificar antes de escalar.
- Las cards secundarias deben perder peso visual antes que la accion principal.
- El ancho util de mobile debe ir al contenido, no a marcos o wrappers redundantes.

## Cross-module De-nesting Gate

- En mobile/iPad, cada bloque operativo debe resolverse con una sola superficie principal.
- Si la jerarquia depende de card dentro de card para el mismo contenido, la implementacion falla.
- El shell superior y toolbars compartidas tambien entran en este gate; no solo los modulos de negocio.

## Action-to-Form Gate

- En create/edit mobile+iPad, el primer campo accionable debe quedar visible inmediatamente al abrir el flujo.
- Si el usuario ve contexto, resumen o decoracion antes del campo y necesita scroll para empezar, la pantalla falla.
- Overlay o StepFlow deben preferirse sobre formularios enterrados debajo del listado.

## Mobile/iPad Button Alignment Gate

- Una tarjeta compacta no debe mostrar varias acciones grandes compitiendo a la vez.
- La accion principal mantiene prioridad; las secundarias se agrupan o pasan a `Mas`.
- Botones deben alinear altura y anchura de forma estable en `390x844` y `768x1024`.

## Filter Compactness Gate

- Filtros visibles deben sentirse auxiliares frente a la lista.
- Si `Filtros` u `Orden` ocupan tanto peso como una card de contenido, la superficie falla densidad.
- El estado activo debe resumirse sin convertir la toolbar en un panel largo permanente.

## Mobile Loading Gate

- no skeletons enormes en mobile
- no `0` placeholders mientras la vista sigue cargando
- no empty states prematuros antes de conocer el estado real
- maximo `3` skeleton rows en mobile
- la carga compartida no puede ocupar mas espacio visual que la lectura real
- QA viva obligatoria en `390x844` y `768x1024` cuando el navegador autenticado este disponible

## GSAP Plugin Gate

- Plugins are loaded through the shared motion layer, never ad hoc in business modules.
- Plugin availability is checked or documented before usage.
- Restricted plugins stay restricted unless a dedicated sprint changes policy.
- `ScrollTrigger` is not applied globally by default.
- SVG draw effects have a fallback path when the plugin is unavailable.

## Data Safety Gate

- No accidental data model drift is introduced.
- Sensitive operations remain explicit.
- AI output is not treated as confirmed truth by default.
- Risky automation remains reviewable by the user.
- Protected areas such as routes, Supabase, auth, invoices, quotes, clients, services, and critical logic stay untouched unless explicitly in scope.

## One-Line Filters Gate

- Las listas operativas no pueden abrir con paneles verticales largos de filtros.
- Busqueda, filtros rapidos y orden deben caber en una sola superficie compacta.
- Los filtros avanzados deben vivir en popover o sheet y resumirse fuera como estado activo.
- Mostrar todos los grupos de chips a la vez se considera regresion visual.

## Invoice Correction Gate

- Una factura emitida no puede corregirse por atajo visual silencioso.
- Si no existe rectificativa real, la UI debe guiar a borrador o accion manual trazable.
- La comparativa actual/corregido/diferencia debe ser visible antes de preparar la correccion.
- Ninguna correccion guiada puede tocar numeracion ni write path automaticamente.

## Smart Suggestions Gate

- Local suggestions must be optional and explicitly applied by the user.
- Suggestion layers cannot mutate persisted values silently.
- Postal code and city helpers must stay local-first unless a dedicated backend sprint changes the contract.
- Concept autocomplete cannot weaken required fields, price rules, tax rules, or structured validation.
- Any local memory must avoid clearly sensitive values and degrade safely if storage is unavailable.

## Home Cockpit Gate

- Home is a cockpit, not a report.
- Home cannot include long operational queues, long alert lists, or explanatory report blocks.
- The first visual read must fit into KPIs, charts, quick actions, and minimal alert state.
- If a user needs detail, Home must hand off to the corresponding module instead of expanding itself.

## Release Decision

A work block should move forward only when:

- all relevant gates pass
- failures are resolved, or
- the failure is explicitly accepted and documented by scope decision

## Transformation Closeout Gate

For roadmap-closeout or phase-closeout work:

- governance documents are present and aligned with the real repo state
- the final report distinguishes verified surfaces from code-audited-only surfaces
- residual debt is prioritized instead of hidden behind generic "done" language
- protected technical risks remain explicit
- lint and build pass
- the repo is ready for the next targeted phase without requiring a blind redesign restart

## Test Debt Closed - Invoice Fiscal Debug Visibility

- If a test still expects a debug or fiscal surface in normal operational flow after product approval removed it, the test is wrong and must be aligned.
- Closing that debt requires preserving meaningful coverage: hidden in normal view, visible only under the supported explicit debug trigger.
- A green test is valid only if product behavior stays unchanged.

## Authenticated QA Recovery Attempt

- When authenticated live QA is requested, the report must distinguish:
  - code or test verification
  - live browser verification
  - blocked browser automation
- If the embedded browser stalls, the final report must cite the exact timeout or runtime failure and the last authenticated surface actually reached.
- Absence of fallback `storageState` or reusable authenticated session artifacts must be stated explicitly instead of implied away.

## Authenticated Visual QA Gate

- No confirmar QA visual autenticada solo por auditoria de codigo.
- Si el navegador embebido falla, usar un harness local reutilizable con sesion ignorada por git antes de declarar bloqueo final.
- La sesion local y screenshots privados deben vivir siempre en rutas ignoradas.
- La validacion minima para superficies mobile/iPad sigue siendo `390x844` y `768x1024`.
- Si un check visual depende de detectar un KPI o importe concreto, debe usar una marca estable del bloque real antes que una heuristica de texto fragil.

## Authenticated Visual QA Recovery Gate - 2026-07-16

- Si un baseline autenticado cae tras un sprint funcional no relacionado, el primer paso obligatorio es clasificar el fallo como `UI real`, `timing`, `selector` o `vista no aplicable`.
- Un rerun peor que el reporte inicial debe documentarse como senal de inestabilidad del harness, no como excusa para cerrar sin diagnostico.
- No se permite borrar checks para volver a verde; la recuperacion valida es endurecer readiness/selectores o corregir la UI real.
- El cierre debe dejar una nota dedicada con baseline previo, baseline roto, rerun local, causas por grupo, fixes aplicados y resultado final.
- Referencia de este caso: [QA_BASELINE_RECOVERY_20260716.md](C:/Users/USUARIO/costa-clean-app/docs/QA_BASELINE_RECOVERY_20260716.md)

## Module Completion Gate

- Ningun modulo principal se da por pulido sin QA autenticada en `390x844`, `768x1024` y desktop.
- Ningun modulo principal puede mantener nested cards, filtros largos, KPIs `0` visibles o formularios enterrados en el primer viewport.
- Todo create/edit StepFlow principal debe abrir con el primer campo visible inmediatamente.
- Si un dominio no tiene ruta standalone real, debe documentarse como `no aplicable`; no se inventa vista para pasar QA.

## Property Create Sync Gate

- Cuando se crea una propiedad desde un StepFlow embebido, debe aparecer inmediatamente en el selector del contexto.
- La propiedad creada debe quedar seleccionada sin recargar toda la app.
- Si el refresh posterior falla, el flujo debe mostrar feedback visible y ofrecer reintento en la misma superficie.

## Property Duplicate Guard Gate

- Ningun flujo de alta de propiedad puede crear duplicados silenciosos para el mismo cliente.
- El guard debe permitir usar una propiedad existente o crear de todos modos de forma explicita.
- La deteccion de duplicados de propiedades no puede mezclar clientes distintos.

## End-User Flow Agent Gate

- Todo flujo principal debe abrir formulario visible.
- El agente no ejecuta submit final en modo dry-run.
- `write-and-clean` solo puede ejecutarse en flujos con cleanup registrado, `qaRunId` trazable y artefactos privados de cleanup.
- Contra una URL no local, `write-and-clean` exige `QA_ALLOW_WRITE_CLEAN=1`.
- Ningun sprint UX se cierra si rompe `npm run qa:flow:agent`.
- Los reportes privados no se versionan.
- El agente debe cubrir `390x844`, `768x1024` y `1366x900`.
- Si un flujo no aplica en un viewport, debe documentarse como tal.
- La URL efectiva del reporte debe coincidir con `QA_APP_URL` cuando exista; auditar otra URL invalida la evidencia.
- Una pantalla de error de arranque nunca puede satisfacer el gate de shell autenticado.
- Si local carece de variables publicas Supabase y produccion sirve una build anterior, el gate queda bloqueado; no se sustituye por una declaracion de exito ni se habilita `write-and-clean`.

## Real Submit And Cleanup Gate - 2026-07-19

- Un submit permitido solo pasa si el id creado queda registrado antes de ejecutar cleanup.
- Una respuesta de cleanup con cero filas afectadas falla el gate.
- Un feedback de exito que desaparece al cerrar el overlay no es suficiente; debe ser visible y trazable por `data-entity-id`.
- Los footers anidados no pueden ocultar el CTA operativo del StepFlow en `390x844` ni `768x1024`.
- Invoice, payment, job y fiscal deben producir skips de politica, no intentos de escritura.
- No hay cierre, commit ni push mientras la build autenticada auditada no contenga los fixes funcionales requeridos.
- El write-and-clean local exige `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env.local` ignorado; nunca se usa service-role ni se versionan valores.
- Si falta la configuracion publica local, los submits deben quedar bloqueados y el resultado se documenta como no ejecutado, no como write-and-clean verde.
- Antes de cualquier submit local deben pasar build, shell autenticado y dry-run contra exactamente `http://127.0.0.1:4173/`.

## QA Sandbox Environment Gate - 2026-07-20

- Dry-run is allowed in production, local-production-config, sandbox, and unknown read-only targets.
- Every write-and-clean run requires `QA_ALLOW_WRITE_CLEAN=1`; unknown targets are blocked.
- Sandbox commands require `VITE_APP_ENV=qa` and a `QA_SANDBOX_PROJECT_REF` matching the public Supabase URL.
- Service-role and Supabase secret keys are forbidden in frontend and browser-runner configuration.
- Full-flow submit remains unavailable until a disposable/restorable sandbox exists.
- Future full-submit requires `QA_ENV=sandbox`, matching project fingerprint, `QA_ALLOW_FULL_SUBMIT=1`, `QA_ALLOW_WRITE_CLEAN=1`, a `QA-AUTO` run ID, `registry-and-reset` cleanup, and `snapshot-restore` or `branch-discard`.
- Invoice, payment, fiscal cancellation, and numbering reset are always blocked outside sandbox.

## Recurring Service Contract Gate - 2026-07-20

- La automatizacion de facturas no puede presentarse como recurrencia de servicios.
- Si no existe contrato de recurrencia de visitas, la UI debe explicarlo y el agente debe registrar un skip con razon estable.
- No se inventan rutas, writes, SQL, RPC ni fechas recurrentes para cerrar una auditoria UX.
- El alta contextual de servicio debe conservar cliente o inmueble al abrir y al cancelar.

## Sandbox Provisioning Readiness Gate - 2026-07-21

- La existencia de `.env.qa.local` no demuestra por si sola un sandbox: el fingerprint debe coincidir con `QA_SANDBOX_PROJECT_REF` y diferir del proyecto local de referencia.
- `.env.qa.local` no puede contener nombres ni valores de service-role, secret keys, passwords, access tokens o connection strings.
- Antes de auth o dry-run debe existir un schema QA completo y revisado; una branch vacia o parcialmente migrada falla el gate.
- Antes de cualquier write debe existir seed sintetico, baseline privado y side effects externos deshabilitados o sandboxed.
- Full-submit sigue bloqueado hasta demostrar restore/discard y comparacion post-reset; un flag no sustituye esa evidencia.

## Sandbox Schema Delivery Gate - 2026-07-21

- Un directorio de SQL incremental no equivale a una historia reproducible de migraciones.
- Antes de `db push`, deben existir definiciones revisadas para todas las tablas base, relaciones, tipos, defaults, constraints, indexes, RPCs, triggers, RLS, policies y grants usados por la app.
- Si una migracion depende de una tabla que el repo no crea, el bootstrap falla cerrado.
- SQL de regularizacion productiva, renumeracion o correccion de datos no puede formar parte del bootstrap QA.
- Un export schema-only debe excluir filas, auth users, secretos y datos de storage, y requiere revision antes de convertirse en migracion.
- La mutacion externa del schema QA requiere autorizacion separada incluso cuando el fingerprint ya haya pasado.
- El preflight de export debe comprobar CLI, link, DB password/connection y ruta ignorada sin imprimir valores; un access token aislado no autoriza recuperar o cambiar el password DB.
- Un dump inexistente no permite declarar safety review ni generar baseline. Las instrucciones manuales deben ser el resultado honesto del gate.
- El export `public` revisado con `pg_dump 17.10` pasa solo si no contiene filas, `COPY`, `setval`, secretos, owners, ACLs ni DDL de schemas administrados; DML dentro de cuerpos de funciones debe clasificarse manualmente y no confundirse con datos exportados.
- La baseline preparada no autoriza `db push`: aplicar a QA requiere una aprobacion separada, rerun inmediato del fingerprint y verificacion posterior de tablas, funciones, policies, grants y REST schema cache.
- Un contrato ausente en el schema autoritativo, como `recurring_invoice_plans`, permanece bloqueado; el gate prohibe inventarlo para conseguir un full-flow verde.
- Estado actual: export obtenido, safety review pasado y baseline aplicada solo a QA mediante transaccion atomica; datos reales incluidos `NO`, produccion modificada `NO`, QA visual `360/360`, dry-run `588/588`, entidades creadas `0`.
- El seed sintetico determinista `QA_DEMO_20260721` ya paso dry-run, apply e idempotencia: 15 filas en ocho tablas, QA visual `360/360`, dry-run `588/588` y cero entidades creadas por el runner.
- El siguiente gate es snapshot/restore proof con autorizacion separada. Write-and-clean, reset destructivo, full-submit, facturas y cobros siguen bloqueados.
- Un apply directo con `psql` no demuestra historial de migraciones Supabase reconciliado; antes de cualquier `db push` se debe auditar y resolver ese metadata drift sin reejecutar la baseline.

## Deterministic Sandbox Seed Gate - 2026-07-21

- El script debe exigir `QA_ENV=sandbox`, ref exacto, fingerprint publico coincidente y login pooler privado del mismo proyecto.
- Dry-run siempre precede al apply y no puede escribir.
- IDs y marcadores deben ser deterministas; cualquier colision con una fila sin marcador aborta la transaccion.
- Solo se reemplazan filas propias del marker `QA_DEMO_20260721`.
- Emails, telefonos, direcciones, tax IDs, referencias e importes deben ser inequivocamente ficticios.
- Invoice, payment, closing, auth, storage y recurring plans quedan fuera del seed base.
- Idempotencia requiere un segundo dry-run y apply con conteos identicos.
- El gate pasa solo con reportes privados, conteos relacionales exactos, cero datos reales, cero writes productivos y dry-run de producto con cero entidades creadas.

## Sandbox Restore Proof Gate - 2026-07-21

- El Dashboard del proyecto QA confirma plan Free sin backups programados ni PITR y ausencia de preview branches existentes.
- El dump privado se limita al schema `public` de QA y solo se captura cuando sus 15 filas coinciden exactamente con el seed sintetico; no incluye `auth`, storage ni datos productivos.
- La captura de un dump no equivale a haber probado su restauracion. Un restore completo o reemplazo de schema sigue requiriendo autorizacion destructiva separada.
- La prueba C exige ref/fingerprint/login pooler QA exactos, una sola fila no financiera con marker `QA_RESTORE_PROOF_20260721`, cleanup de exactamente una fila y comparacion integral de conteos.
- Resultado: leads `2 -> 3 -> 2`, filas publicas `15 -> 16 -> 15`, marker temporal `0 -> 1 -> 0`, seed demo intacto, invoices/payments/closings `0/0/0`.
- QA post-cleanup: visual `360/360`, dry-run `588/588`, entidades creadas `0`.
- Este resultado habilita solo proponer write-and-clean no financiero y registrado como siguiente gate separado. Full-submit, reset destructivo, facturas, cobros, reparacion de historial y `db push` siguen bloqueados.

## Authenticated RLS Write Gate - 2026-07-21

- Solo se ejecuta contra `QA_ENV=sandbox`, ref y URL exactas del proyecto autorizado.
- La sesión debe validarse en Auth; `Authorization` usa `session.access_token` y debe diferir de la anon key.
- HTTP 2xx no basta: INSERT/PATCH debe devolver exactamente la fila afectada y el runner debe reconciliar el estado persistido.
- Fixtures de operador no cuentan como evidencia RLS y solo pueden usar IDs deterministas y marcador exacto.
- El cierre exige marcador temporal 0, seed `QA_DEMO_20260721` intacto y `invoices/payments/quarterly_closings` en `0/0/0`.
- Un fallo RLS no autoriza fallback anon, `service_role` ni cambios de policy. Se documenta y se escala a un sprint con autorización separada.

## Authenticated Operational RPC Gate - 2026-07-21

- When target tables lack ownership columns, do not add global authenticated write policies; use allowlisted RPCs or stop for a tenancy design.
- SECURITY DEFINER RPCs require fixed `search_path`, an internal `auth.uid()` guard and EXECUTE revoked from public/anon.
- Removing a legacy anon policy and switching the frontend must be delivered as one coordinated change.
- HTTP success must be reconciled against exactly one persisted row or the expected RPC effect.
- QA closure requires both temporary markers at 0, demo seed intact, financial tables `0/0/0`, and a catalog check of policies and function grants.
- Production application requires a separate gate and must account for direct-`psql` migration-history drift.

## Universal Correction And Release Gate

- Toda correccion debe clasificarse y validarse segun [UNIVERSAL_CORRECTION_SYSTEM.md](UNIVERSAL_CORRECTION_SYSTEM.md), sin rebajar los gates especificos de Costa Clean.
- Las correcciones visuales deben seguir [UX_UI_CORRECTION_SYSTEM.md](UX_UI_CORRECTION_SYSTEM.md) y conservar la evidencia visual exigida por este documento.
- Toda publicacion debe seguir [UNIVERSAL_RELEASE_SYSTEM.md](UNIVERSAL_RELEASE_SYSTEM.md), actualizar [UNIVERSAL_RELEASE_LOG.md](UNIVERSAL_RELEASE_LOG.md) y declarar rollback.
- Antes de ampliar alcance se deben revisar [UNIVERSAL_RISK_ZONES.md](UNIVERSAL_RISK_ZONES.md) y [RISK_MAP.md](RISK_MAP.md).
- Los prompts de [CODEX_UNIVERSAL_CORRECTOR_PROTOCOL.md](CODEX_UNIVERSAL_CORRECTOR_PROTOCOL.md) no sustituyen autorizaciones ni evidencia real.
- Si un gate local es mas estricto que el universal, prevalece el gate local.

## Production Authenticated RPC Release Gate - 2026-07-22

- A production RPC migration requires an exact file/hash allowlist, an unambiguous public/private project-ref match, and a private pre-apply schema backup.
- The deployed frontend must contain the coordinated RPC paths before legacy anon policies or grants are removed.
- Apply uses `psql`, `ON_ERROR_STOP`, and one reviewed transaction; `db push` and unrelated migrations remain prohibited until history is reconciled.
- Post-apply introspection must verify RLS, `SECURITY DEFINER`, fixed `search_path`, internal auth guards, denied `public/anon`, allowed `authenticated`, and zero global authenticated write policies.
- Catalog verification does not count as a real write smoke. Production row creation requires separate authorization, deterministic IDs, a unique marker, immediate foreign-key-ordered cleanup, and a zero-residue reconciliation.
- Rollback must be derived from the private pre-apply schema and documented as security-regressive when it restores anonymous writes.
- Evidence: [PRODUCTION_RLS_RELEASE_GATE_20260722.md](PRODUCTION_RLS_RELEASE_GATE_20260722.md).

## Production Non-Financial RLS Smoke Gate - 2026-07-22

- The authorized target and the excluded QA ref must both be validated from public and private connection identities before any write.
- Authenticated writes must use `session.access_token`; equality between bearer and anon key blocks the run.
- The endpoint allowlist is limited to operational client/property/job RPCs and must reject invoice, payment, closing, or full-submit paths.
- Persisted rows and affected state must be reconciled before cleanup; HTTP success alone is insufficient.
- Cleanup is limited to deterministic IDs carrying the exact marker and runs `job_lines -> jobs -> properties -> clients`, including after an intermediate failure.
- The completed smoke used `PROD_RLS_SMOKE_20260722`, returned `200/200/200/204/200`, and left zero marker or ID residue.
- Automatic `CLI/PRO/JOB` sequence gaps are accepted operational effects, are not fiscal numbering, and must not be reset. Invoice `display_code` and `invoice_number` remain prohibited.
- Evidence: [PRODUCTION_RLS_RELEASE_GATE_20260722.md](PRODUCTION_RLS_RELEASE_GATE_20260722.md).

## Anonymous Read Exposure Gate - 2026-07-22

- An authenticated UI shell does not protect a REST table whose anon policy permits `SELECT USING (true)`.
- Internal list/detail reads must require `session.access_token`; the anon key may remain in `apikey` but cannot be the bearer for internal data.
- RLS enabled is not sufficient evidence. The gate must inspect effective grants, policy roles and predicates, column privileges, RPC EXECUTE, and live anon REST behavior.
- HTTP 200 with zero rows is not a durable confidentiality control when anon retains SELECT grants. Internal tables must deny anon access explicitly.
- Public submission flows may retain narrowly reviewed INSERT capability, but must not expose submission history, employee results, PII, or internal status through SELECT.
- Function EXECUTE must be revoked from `PUBLIC`/`anon` by default and restored only through a documented allowlist. Internal auth guards are defense in depth, not justification for a public grant.
- Policy closure must be coordinated with frontend token propagation and proven in QA before any production authorization.
- The gate fails P0 when personal or financial rows are anonymously readable, and P1 when internal clients/properties/jobs are anonymously readable without a higher-severity field classification.
- Evidence: [ANON_READ_POLICY_AUDIT_20260722.md](ANON_READ_POLICY_AUDIT_20260722.md).

## QA P0 Anonymous Closure Gate - 2026-07-22

- Exact QA ref, public URL fingerprint and private pooler identity must all equal `kpvvydthlxupjjqqdpxy`; production ref must be rejected.
- Pass requires zero anon SELECT policies/grants on the ten target tables, zero legacy anon write policies in the scoped commercial/financial tables and zero sensitive anon RPC grants.
- Live evidence requires anon HTTP 401/403 and authenticated HTTP 200 for every target table.
- Protected frontend REST reads must require `session.access_token`; anon may remain only as `apikey` or as bearer for an explicitly public, allowlisted RPC.
- Final app evidence is authenticated visual QA plus a no-write sandbox dry-run. Any visible load error fails the gate even if layout checks pass.
- Production release remains a separate authorization with pre/post evidence and rollback.

## Production P0 Anonymous Closure Gate - 2026-07-22

- The exact QA-verified migration hash, public project ref and private pooler ref must match before apply; QA and local identities must be rejected.
- A non-empty schema-only backup with zero COPY/data INSERT/connection strings is mandatory before mutation.
- Apply is limited to one reviewed migration through PostgreSQL 17 `psql`, `ON_ERROR_STOP` and explicit transaction boundaries; `db push` is forbidden.
- Pass requires anon HTTP 401/403 in 10/10, authenticated HTTP 200 in 10/10, zero sensitive anon RPC grants and preservation of the allowlisted public quiz submission.
- App smoke is read-only and must show no load errors, submits or created entities.
- Completed evidence: backup valid, apply transaction complete, anon `401` 10/10, auth `200` 10/10, visual smoke `360/360`, business writes 0.
- Evidence: [PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md](PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md).

## Supabase Migration History Reconciliation Gate - 2026-07-22

- QA and production history inspection must run read-only and validate each private project ref before querying.
- Absence of `supabase_migrations.schema_migrations` is not permission to initialize or repair it.
- `db push`, `migration repair`, history INSERT/UPDATE/DELETE and new migrations remain blocked.
- The repository currently has four files but zero registered versions in both remotes, two files collide on version `20260721`, and a QA-only baseline shares the production migration directory.
- Material schema fingerprints may prove an apply occurred, but cannot substitute for formal version metadata.
- Unlocking requires a canonical manifest, unique versions/baseline strategy, disposable repair proof, authorized remote metadata repair and a demonstrated zero-SQL plan.
- Local lock commands must fail closed: `npm run db:push` and `npm run supabase:db:push`.
- Evidence: [SUPABASE_MIGRATION_HISTORY_RECONCILIATION_20260722.md](SUPABASE_MIGRATION_HISTORY_RECONCILIATION_20260722.md).

## Migration Manifest And Disposable Repair Proof Gate - 2026-07-22

- Every published SQL file must map to one immutable SHA-256, one unique logical alias, material evidence by target and an explicit history decision.
- A QA-only baseline is bootstrap infrastructure, `never-push`, and must not be registered as an incremental migration in QA or production.
- Historical order and executable empty-database bootstrap order are separate claims; neither may be declared proven from filenames alone.
- Disposable proof requires a third exact ref distinct from `kpvvydthlxupjjqqdpxy` and `wfxnwfcdjainpojhbdri`, private credentials, and a proven discard/restore path.
- If no remote disposable destination exists, the valid Supabase Cloud result is `proof: NO`; QA/production must not be substituted. A local disposable PostgreSQL substitute must be labeled non-equivalent and cannot authorize remote writes.
- Repair in disposable does not authorize repair in QA. QA and production metadata writes each require later, separate authorization.
- The npm locks remain mandatory before and after the proof; no gate may claim `db push` safe until a reviewed zero-SQL plan and legacy-history decision exist.
- Current result: manifest and plan created; local disposable PostgreSQL proof passed; remote Supabase disposable proof deferred by free-plan capacity; QA/production unchanged; lock active.
- The local proof may validate SQL syntax, bootstrap order, fingerprints and simulated unique metadata only. It is not Supabase Cloud equivalence and cannot authorize remote repair or unlock `db push`.
- After a passing local proof, the first real remote repair must be official QA under a separate explicit metadata-only authorization; production remains a later independent gate.
- Evidence: [SUPABASE_MIGRATION_MANIFEST_20260722.md](SUPABASE_MIGRATION_MANIFEST_20260722.md), [SUPABASE_MIGRATION_REPAIR_PLAN_20260722.md](SUPABASE_MIGRATION_REPAIR_PLAN_20260722.md), and [SUPABASE_DISPOSABLE_REPAIR_PROOF_20260722.md](SUPABASE_DISPOSABLE_REPAIR_PROOF_20260722.md).
