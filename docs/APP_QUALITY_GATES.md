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
