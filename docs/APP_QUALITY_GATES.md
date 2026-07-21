# App Quality Gates

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
