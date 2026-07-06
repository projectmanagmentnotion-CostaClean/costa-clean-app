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

## Mobile Gate

- The first mobile viewport shows purpose and next action clearly.
- Primary actions are reachable and obvious.
- Layout remains usable on narrow screens.
- Dense tables or multi-column assumptions are avoided or safely adapted.
- Critical flows are completable on mobile without confusion.

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

## Smart Suggestions Gate

- Local suggestions must be optional and explicitly applied by the user.
- Suggestion layers cannot mutate persisted values silently.
- Postal code and city helpers must stay local-first unless a dedicated backend sprint changes the contract.
- Concept autocomplete cannot weaken required fields, price rules, tax rules, or structured validation.
- Any local memory must avoid clearly sensitive values and degrade safely if storage is unavailable.

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
