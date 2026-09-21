# Costa Clean V3 — UX Refinement R6
# Monostep StepFlow Certification

## Certification scope

R6 replaces the remaining V3 long-form create/edit surfaces with one canonical,
guided monostep architecture. The implementation was based on certified HEAD
`92eb553b907804428d2b62b2e8e2cb3cb7283925` on branch
`codex/v3-ux-refinement-r6-monostep`.

The product contract is strict: one logical task per screen, visible progress,
only the current step rendered interactively, no form-page scrolling, no step
body scrolling, and final actions reachable inside the available viewport.

## Form audit and disposition

| Surface | Mode | Current R6 step map | Disposition | Business mutation contract |
| --- | --- | --- | --- | --- |
| Expenses | create/edit | Datos básicos; Importe e impuestos; Documento y pago; Revisión fiscal; Notas y resumen | MUST_MIGRATE_R6 | `createExpense` / `updateExpense`, receipt association |
| Services / Jobs | create/edit | Contexto; Agenda; Precio; Notas y revisión | MUST_MIGRATE_R6 | `saveJobWithLines`, existing status completion RPC |
| Leads | create/edit | Contacto; Necesidad/Estado; Ubicación o revisión | MUST_MIGRATE_R6 | existing lead write adapter |
| Clients | create/edit | Identidad; Contacto; Datos fiscales | MUST_MIGRATE_R6 | existing client write adapter and duplicate guard |
| Properties | create/edit | Identidad; Ubicación; Notas y revisión | MUST_MIGRATE_R6 | existing authenticated property RPCs |
| Invoices | create/edit | Contexto/Fecha; Emisión; Líneas e importe; Revisión | MUST_MIGRATE_R6 | `saveInvoiceWithLines` and locked/paid safeguards |
| Quotes | create/edit | Contexto; Líneas; Estado/Notas y revisión | MUST_MIGRATE_R6 | `saveQuoteWithLines` |
| Payments | create | Factura; Importe y método; Revisión | MUST_MIGRATE_R6 | `savePaymentAndRefreshInvoice` and duplicate guard |
| Recurring plans | create/edit | Identidad; Calendario; template lines; Revisión | MUST_MIGRATE_R6 | existing recurring-plan save adapter |
| Alerts configuration | — | — | OUT_OF_SCOPE_WITH_REASON | No editable V3 configuration form exists |
| Closings | — | — | OUT_OF_SCOPE_WITH_REASON | Fiscal snapshot/internal notes surface, not a substantial entity form |
| Portal flows | create/edit | Existing portal StepFlows | ALREADY_COMPLIANT / separate contract | Outside the V3 CRM migration scope |

The audit covered 13 governed V3 create/edit surfaces, including create and
edit variants where they exist. All V3 surfaces that were long-form candidates
were migrated. No business logic, routes, auth behavior, Supabase schema, or
write contract was changed.

## Canonical architecture

`src/v3/stepflow/V3StepFlow.tsx` is the shared primitive used by every migrated
module. It owns current-step state, progress, heading focus, back/continue
semantics, per-step validation, and the final completion boundary. Module
adapters provide field state and invoke the existing canonical submit adapter
only after the final step.

The governed shell provides:

- `V3StepFlowHeader` behavior through the branded flow heading/context;
- visible `Paso X de Y`, title, progress track, and numbered progress markers;
- one current step body only;
- stable `Atrás` / `Continuar` actions and the final business verb;
- fixed `100dvh`-bounded layout with safe-area handling;
- no `overflow-y: auto` or `overflow-y: scroll` in the step body;
- reduced-motion behavior for progress transitions.

The step body has structural `data-step-body-scroll="0"` governance. Future
steps are not rendered as an interactive long form. Desktop uses a governed
readable maximum width; it does not restore the old multi-section layout.

## Validation and state

Each step validates the fields relevant to that step before advancing. The
existing complete validation still runs inside each module's final submit
adapter. Back navigation preserves local draft values, calculated values are
derived deterministically, and no intermediate database write is introduced.

Create flows initialize from their existing defaults. Edit flows initialize
from the actual record and preserve existing safeguards, duplicate guards,
file association timing, and locked/paid protections. Final review steps show
the important facts and totals without duplicating every field.

Canonical enum values remain unchanged. User-facing status and category labels
use professional Spanish display labels where the migrated flow exposes those
values. Calculated totals remain read-only wherever the previous contract made
them calculated.

## Responsive and accessibility evidence

The shared shell uses dynamic viewport units, safe-area insets, a compact
small-height mode, native controls, and focus movement to the step heading on
step changes. Field labels and existing error associations remain in the
module forms. Controls retain readable sizing and touch-target requirements;
reduced motion is honored.

Authenticated visual QA exercised the protected app at:

`320x568`, `390x844`, `430x932`, `768x1024`, `820x1180`, `834x1194`,
`1024x1366`, `1280x800`, `1440x900`, and `1920x1080`.

The matrix covered Home, Clients, Properties, Quotes, Jobs, Invoices,
Expenses, Payments, fiscal closing, and representative quote/job/expense/
payment flows. Result: **1320/1320 PASS**. The QA run was read-only and made
zero business writes.

## Governance tests and quality gates

The focused StepFlow suite verifies shared primitive usage, one-current-step
rendering, progress, action bar, step-body scroll governance, and expense
contract expectations. The final suite result is **921 passed, 4 skipped**.

Final gates:

- Agents: **294/294 PASS**
- Lint: **PASS**
- Build: **PASS**
- `git diff --check`: **PASS**

## Independent review

Fresh review against the final R6 HEAD confirms:

1. Former governed long forms are removed.
2. Only one logical step is shown at a time.
3. Steps obey the bounded viewport contract at the required matrix sizes.
4. Fields and actions are reachable without form scrolling.
5. Progress is always visible and understandable.
6. Back preserves values.
7. Validation happens before advancing and again at final submit.
8. Final submission still uses canonical business contracts.
9. Native keyboard/focus behavior is usable and no permanent manual scroll is required.
10. R1–R5 and Visual Polish contracts remain intact: one logo, shell separation,
    branded navigation, governed chart/preloader, safe areas, invisible global
    scrollbars, viewport width/height, and iPad shell behavior.

Severity matrix:

| Severity | Findings |
| --- | --- |
| P0 | 0 |
| P1 | 0 |
| P2 | 0 |
| P3 | 0 |

## Final verdict

**R6 = CLOSED / CERTIFIED.** The implementation is certified on the final
branch state. No Production deployment, Production business write, or
Supabase Production mutation was performed. `GLOBAL_FINAL_CERTIFICATION =
READY`.
