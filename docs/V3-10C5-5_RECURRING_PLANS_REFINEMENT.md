# V3-10C5.5 — Recurring Plans Refinement

Status: `CLOSED / CERTIFIED`

Repository: `C:\Users\USUARIO\costa-clean-app-v3`

Starting HEAD: `4e4e4279a6ab751fabc39f480bb647bb855cfb49`

Scope: V3 recurring-plan presentation and interaction clarity only. C5.6,
Supabase schema, production, scheduler semantics and business-data writes are
outside this batch.

## Protected contract boundary

The implementation keeps these existing contracts unchanged:

- `saveRecurringInvoicePlan` and `save_client_recurring_invoice_plan`;
- `generateInvoiceFromRecurringPlan` and
  `generate_invoice_from_recurring_plan`;
- `buildRecurringPlanPersistenceInput`;
- `calculateNextRecurringIssueDate`, `isRecurringPlanDue` and frequency
  labels;
- `findRecurringPlanDuplicateGroups` and `V3DuplicateReviewSheet`;
- active, paused and archived statuses;
- weekly, biweekly, monthly and quarterly frequencies;
- draft/issued invoice-mode values and existing client/property/quote
  relations.

No RPC, query, schema, route, permission, scheduler or financial calculation
was changed.

## Findings and implementation

| Finding | Disposition | Evidence |
| --- | --- | --- |
| Plan row did not distinguish paused/archived emission eligibility from a scheduled or pending emission. | `FIXED` | `getPlanDueLabel` and `getPlanEmissionStatus` now derive emission copy from the existing plan status before due-date presentation. |
| Recurring detail opened as a bottom-sheet-sized surface rather than a dedicated entity workspace. | `FIXED` | The existing focus-managed `V3BottomSheet` primitive now has a scoped `workspace` presentation variant; the plan detail uses a full-viewport, scrollable workspace with an explicit “Volver a planes” affordance. |
| Plan identity, client context, cadence, next date and invoice mode were not grouped into one semantic workspace hierarchy. | `FIXED` | Detail uses `V3PageTitle`, a summary for cadence/schedule/history/invoice mode, a schedule explanation and separate relationship/template sections. |
| Generation action could invoke the protected generation flow without an explicit review step. | `FIXED` | A confirmation sheet explains that the protected flow must confirm generation before the invoice is opened. The RPC wrapper and duplicate protections are unchanged. |
| Paused/archived generation availability was not explained. | `FIXED` | The primary action remains disabled unless active and the workspace explains that generation is available after resuming. |

The presentation does not claim that an active plan is paid, settled or
reconciled. “Estado al emitir” describes the existing draft/issued default
only; it is not an invoice settlement state.

## Changed product and certification files

- `src/v3/recurring/V3RecurringPlans.tsx`
- `src/v3/components/V3Primitives.tsx` (additive workspace variant/close label
  only)
- `src/v3/design/v3.css` (scoped workspace presentation rules)
- `src/v3/recurring/V3RecurringPlans.test.tsx` (workspace structure and
  heading-order regression coverage)
- `src/v3/recurring/V3RecurringPlansPresentation.test.ts`

Certification and roadmap paths changed in the same checkpoint:

- `docs/V3-10C5-5_RECURRING_PLANS_REFINEMENT.md`
- `docs/V3-10C5-5_RUNTIME_EVIDENCE.md`
- `docs/V3-10C5_OPERATIONS_DISCOVERY.md`
- `docs/V3-10C5_OPERATIONS_IMPLEMENTATION_PLAN.md`
- `docs/V3_ROADMAP.md`

No finance API, Supabase, authentication, route or production file changed.

## Focused coverage

- Native recurring list presentation remains covered.
- Active plan presentation keeps “Plan / Activo” and “Emisión / Programada”.
- Paused plans render “Emisión pausada”.
- Archived plans render “Emisión no programada”.
- Workspace heading order keeps the entity `<h1>` before section `<h2>`
  headings while the dialog title remains accessible.
- Workspace width is constrained by the certified content-width token and the
  schedule accent uses the certified border-width token.
- Existing persistence, cadence, due-date and duplicate-engine tests remain
  protected by the full suite.

## Validation gates on the working checkout

The working checkout (outside the detached read-only reviewer sandbox)
completed:

- `npm test`: `859 passed`, `4 skipped`;
- `npm run qa:agents`: `294/294 PASS`;
- `npm run lint`: `PASS`;
- `npm run build`: `PASS`;
- `git diff --check`: `PASS`.

The independent reviewer used a byte-identical isolated checkout with a
writable review sandbox. Its compatibility setup stayed inside the ignored
`.project-agent/private` directory and did not alter tracked product files.

## Independent review

The fresh detached review returned `complete` / `PASS` with quality score
`96/100` and findings `P0=0`, `P1=0`, `P2=0`, `P3=1`. The review artifact is
stored privately at `.project-agent/private/c55-independent-review.json` and
is intentionally not committed.

Independent checks confirmed the protected recurring contracts are unchanged,
the workspace geometry and heading-order corrections are present, the
deterministic populated workspace evidence passes, and the isolated validation
matrix passes. The sole P3 is test-discovery debt: the default Vitest glob does
not include `.test.tsx`; the workspace tests were executed independently and
passed `2/2`.

## Authenticated read-only runtime evidence

QA was replayed against `http://127.0.0.1:4178/?v3=1` using the existing
`costaclean-v3` profile. The QA dataset contains no recurring-plan row for the
verified client, so the populated recurring workspace is `N/A` by contract;
no plan was created merely to manufacture coverage.

The recurring section rendered the truthful empty state “Sin planes
recurrentes” at `320x568`, `390x844`, `768x1024` and `1440x900`. The direct
authenticated visual harness also completed `1584/1584` checks across its
configured matrix with no failures. The targeted empty-state replay recorded:

- authenticated shell: `PASS` at all four viewports;
- recurring empty state: `PASS` at all four viewports;
- horizontal overflow: `0`;
- broken images: `0`;
- visible UUIDs: `0`;
- Unicode-as-icon: `0`;
- legacy markers: `0`;
- console errors: `0`;
- page errors: `0`;
- failed requests: `0`;
- production requests: `0`;
- QA mutations: `0`.

The populated workspace action matrix (status transition, edit, duplicate
review and invoice generation) is not claimed as runtime evidence because no
recurring record exists and the authorized QA run forbids creating one.

## Accessibility and responsive decisions

- The workspace reuses the certified focus-managed dialog primitive, including
  Escape handling and focus restoration.
- The workspace close affordance is named “Volver a planes”.
- Existing shared action controls retain the certified 44px minimum target.
- The full-viewport workspace scrolls internally, preserves safe-area padding
  and does not depend on hover.
- Status context is exposed through the existing `V3EntityStatus` semantic
  label mechanism.

## Remaining boundary

C5.5 is closed and certified. C5.6 cross-module operations certification
remains not started. A later gate must replay the populated recurring states
only if QA data already provides them, without creating or mutating business
data.
