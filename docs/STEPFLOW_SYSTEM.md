# StepFlow System

## Purpose

This document defines the official reusable StepFlow foundation for the app.

Current official base:

- `src/components/FullscreenStepFlow.tsx`

Reusable entry point for future work:

- `src/features/stepflow/index.ts`

This sprint does not migrate productive flows. It standardizes the current base and documents how future migrations must use it.

## Current API

Main component:

- `FullscreenStepFlow`

Current props:

- `eyebrow: string`
- `title: string`
- `description: string`
- `steps: FullscreenStepFlowStep[]`
- `currentStep: number`
- `stepStates?: StepFlowStatus[]`
- `onStepSelect?: (stepIndex: number) => void`
- `children: ReactNode`
- `sideContent?: ReactNode`
- `footerContent?: ReactNode`
- `contextItems?: FullscreenStepFlowContextItem[]`

Current types:

- `FullscreenStepFlowStep`
- `FullscreenStepFlowContextItem`
- `FullscreenStepFlowProps`
- `StepFlowStep`
- `StepFlowAction`
- `StepFlowStatus`
- `StepFlowValidationResult`
- `StepFlowSummaryItem`

## Current behavior

`FullscreenStepFlow` provides:

- full-width dedicated flow shell
- progress header for desktop
- condensed mobile header
- clickable progress steps when `onStepSelect` exists
- persistent context strip and side panel
- mobile collapsible context area
- sticky footer area for primary actions
- nested mode support through `NestedFlowSurfaceContext`
- reduced-motion-safe GSAP transition between steps

It does not own:

- form state
- validation logic
- next/back rules
- save lifecycle
- review summaries
- success screens
- domain errors

Those responsibilities still live in each flow.

## Pattern expected

The expected visual contract is:

1. hero header with flow title and progress
2. explicit step list
3. one dominant step body at a time
4. always-visible context or summary support
5. sticky footer with primary consequence

The step shell should keep this principle:

- one step = one decision

## Recommended step structure

Recommended order for future migrations:

1. context / route selection
2. required core data
3. optional support data
4. review / summary
5. success / next action

Not every flow needs all five, but review and success should be explicit in any important or risky flow.

## Required states per flow

Each future StepFlow should define these states outside the shell:

- loading
- error
- blocked validation
- saving
- saved
- success

Current component support:

- `stepStates` can represent `complete`, `current`, `blocked`, `pending`
- local step content is responsible for rendering concrete alerts, helper text, and recovery actions

## Validation per step

Recommended rule:

- validate at step boundary, not only at final submit

Current practical pattern in the repo:

- each flow computes `currentStepError`
- each flow derives `stepStates`
- each flow decides whether navigation is allowed

Recommended helper contract for future migrations:

- `StepFlowValidationResult`
  - `status: 'valid' | 'invalid' | 'warning'`
  - `message?: string`

## Review, summary, and success

Current engine support:

- `sideContent` for live summary
- `contextItems` for inherited context
- `footerContent` for primary actions

Current limitation:

- no first-class `review` slot
- no first-class `success` slot

For now, review and success stay inside `children` and are coordinated by each domain flow.

## How it should be used

For future migrations:

1. keep domain logic in the feature flow
2. keep persistence logic outside the shell
3. define a stable `steps` array near the top of the flow
4. derive `stepStates` from real validation
5. use `contextItems` only for inherited context that matters during the entire flow
6. use `sideContent` for summary, helper blocks, and low-frequency support
7. keep `footerContent` focused on back / continue / save consequences

## Existing uses detected

Current productive uses:

- `src/features/properties/PropertyCreateFlow.tsx`
- `src/features/quotes/QuoteCreateFlow.tsx`
- `src/features/quotes/QuoteEditFlow.tsx`
- `src/features/jobs/JobCreateFlow.tsx`
- `src/features/invoices/InvoiceCreateFlow.tsx`
- `src/features/invoices/InvoiceEditFlow.tsx`
- `src/features/payments/PaymentCreateFlow.tsx`
- `src/features/expenses/ExpenseCreateFlow.tsx`
- `src/features/expenses/ExpenseEditFlow.tsx`
- `src/features/recurringInvoices/RecurringInvoicePlanFlow.tsx`

Non-user-facing preview:

- `src/pages/DevStepFlowPreviewPage.tsx`

Public intake is not using this engine yet:

- `src/features/publicIntake/PublicQuoteRequestForm.tsx`

Related shared form primitives already aligned for future migrations:

- `src/design-system/components/DSSmartPostalCodeInput.tsx`
- `src/design-system/components/DSConceptAutocomplete.tsx`
- `src/design-system/components/DSProFormField.tsx`

## Criteria for future migrations

A flow should migrate onto this base when all are true:

- the flow is multi-step
- the flow benefits from persistent progress
- validation matters before final submit
- context inheritance matters during the flow
- the flow has a review or confirmation stage

A flow should not migrate blindly if:

- it is one short form with one decision
- it depends on critical write-path changes in the same sprint
- it would mix UX work with risky fiscal or auth refactors

## Technical decision in Sprint 3

Decision taken:

- keep `src/components/FullscreenStepFlow.tsx` as the single runtime engine
- add `src/features/stepflow/` as the official reusable facade
- centralize canonical shared types there
- preserve all existing imports

This means:

- no second StepFlow system
- no breaking import changes
- a stable place for future migrations to import StepFlow types

## Limitations detected

Current limitations of the engine:

- no first-class action model in the component API
- no built-in validation contract
- no built-in review slot
- no built-in success slot
- no built-in async state handling
- no built-in accessibility helpers for step announcements beyond native semantics
- no built-in analytics or step transition instrumentation
- no built-in summary schema beyond generic `sideContent` and `contextItems`

## Density rules added in Motion Phase 3

- el header debe abrir el flujo, no competir con el formulario
- el paso actual debe resumirse en una sola linea principal y una ayuda corta
- el resumen movil debe hablar de contexto, no repetir todo el hero
- los footers deben acercar la accion primaria al cierre del paso
- la motion del paso debe animar la superficie, no el contenido campo por campo

Current repo-level limitation:

- flows already share the shell, but each feature still reimplements much of the orchestration around step validation, footer logic, and summary blocks

## Migration direction after this sprint

- Sprint 6: public intake alignment
- Sprint 7: quotes standardization
- Sprint 8: invoice standardization without touching write safety
- Sprint 9+: client onboarding and other medium-complexity flows
