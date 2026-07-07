# UX App Manual

## Purpose

This manual defines the mandatory UX/UI direction for the app: modern, minimalist, mobile-first, intuitive, and built around StepFlow for important flows.

It is a working manual for product, design, engineering, and AI agents. It is not optional guidance.

## Core Principle

One screen equals one decision.

One block equals one intent.

One primary button equals one clear consequence.

If a screen asks the user to process multiple priorities at the same time, the screen is wrong and must be simplified.

## Product Experience Goals

- fast comprehension
- low cognitive load
- clear next action
- safe data handling
- predictable movement through flows
- calm visual rhythm
- high mobile usability

## Mobile-First Real

Mobile-first means the primary composition, hierarchy, spacing, and interaction model are defined for small screens first.

Rules:

- The first screen on mobile must expose purpose, current state, and next action without requiring interpretation.
- Primary actions must remain easy to reach with one hand.
- Dense multi-column layouts are not the default.
- Important forms and operational flows must be designed for mobile completion first, then expanded for desktop.
- Desktop may add support context, but it must not dilute the main decision.

## Functional Minimalism

Minimalism means fewer decisions per view, fewer competing actions, less decorative noise, and clearer consequences.

Rules:

- Remove non-essential text before styling it.
- Remove decorative metrics that do not change a decision.
- Show advanced detail under demand, not by default.
- Avoid stacked warnings, cards, and banners that repeat the same message.
- Prefer one strong direction over many equal-weight options.
- If the same meaning is already visible in a status, title, or next-step block, do not repeat it in another card.
- Debug information must replace the equivalent operational block, not sit beside it by default.

## Layered Visual Hierarchy

Every screen must have three layers at most:

1. decision layer
2. support layer
3. optional detail layer

Decision layer:

- current status
- primary action
- essential meaning

Support layer:

- relevant metrics
- contextual warnings
- short helper text

Optional detail layer:

- logs
- extended explanations
- secondary breakdowns

No view should open with detail before decision.

## Visual System

### Typography

- Use a calm, modern typographic hierarchy.
- Headings should be short, decisive, and scannable.
- Body text must stay compact and operational.
- Supporting text should explain implication, not narrate the whole system.
- Avoid long paragraphs inside operational screens.

### Spacing

- Use consistent spacing tokens.
- Tight spacing is acceptable only for related operational data.
- Increase spacing between unrelated intents.
- The rhythm should make groups obvious without relying on borders everywhere.
- On mobile, preserve width for content first and avoid wrapper-on-wrapper composition that only adds padding.

### Radius

- Use a modern but restrained radius system.
- Cards, inputs, and overlays should feel consistent.
- Avoid mixing sharp and overly rounded surfaces without a system reason.

### Color

- Color communicates status, priority, and trust.
- Neutral should dominate the base surface.
- Accent color should be reserved for primary interaction.
- Error, warning, success, and info states must be semantically consistent.
- Never use color alone to communicate state.

### Motion

- Motion must clarify change, focus, or success.
- Use motion for entry, progression, confirmation, and reduction of spatial confusion.
- Motion must be subtle and fast.
- Avoid decorative animation that delays task completion.

## Expected Base Components

The app should converge toward a reusable base set of primitives:

- app shell with calm navigation
- page header with one dominant action
- section cards with one intent each
- KPI cards only when they change a decision
- status badges
- inline validation
- persistent primary action area when needed
- stepper or progress indicator for StepFlow
- bottom-sheet or full-screen mobile overlays when the task needs focus
- confirmation and success states
- empty states with directed next actions

## Detail Composition Rules

- Detail screens should be flat by default: identity, status, next action, and compact facts.
- Secondary context must be quieter than the primary action area.
- Avoid nested cards when a lighter subsection or collapsible block is enough.
- If a detail surface becomes box-heavy, simplify the structure before adding more content.

## Cross-module De-nesting Rules

- Mobile and iPad blocks should resolve with one visual surface per intent.
- Shared shell, filters, lists, detail views, and StepFlows follow the same rule; this is not invoice-only guidance.
- If a support block expands width cost more than meaning, flatten it into rows, separators, or collapse.
- Tablet layouts must be audited as their own constraint, not assumed safe because mobile is safe.

## List Density Rules

- Search is the dominant control in operational lists.
- Filters must stay subtle until the user asks for more.
- Cards must optimize scanning, not decoration.
- Buttons, chips, and metadata should shrink visually before titles or amounts lose clarity.

## Button Rules

- One primary button per screen or flow step.
- Secondary buttons must not visually compete with the primary action.
- Destructive actions must require stronger intent and clearer framing.
- Button labels must describe the consequence, not the control type.

Preferred examples:

- `Guardar cliente`
- `Continuar`
- `Emitir factura`
- `Confirmar cobro`

Avoid:

- `Aceptar`
- `Enviar` when the consequence is ambiguous
- `Siguiente` if the user cannot infer what advances

## Modern Navigation

- Navigation must reduce branching, not create it.
- Important flows should leave the broad browsing context and enter a focused flow.
- Public flows should remain isolated from the internal shell when appropriate.
- Navigation labels must describe user intent, not internal architecture.
- Back behavior must be predictable and low-risk.

## StepFlow Complete

StepFlow is mandatory for important, complex, or high-friction flows.

Important flows typically include:

- public intake
- quote creation
- invoice emission
- client onboarding
- service logging with meaningful decisions
- any flow with validation, review, or irreversible consequences

### StepFlow Principles

- Each step has one purpose.
- Each step asks for one kind of decision.
- The user always knows where they are, what is complete, and what comes next.
- The system preserves context and progress.
- The flow reduces fear by sequencing complexity.

### StepFlow Structure

Each StepFlow should include:

1. entry context
2. step objective
3. progress indicator
4. primary action
5. back action
6. validation feedback
7. review step when needed
8. success or completion state

### StepFlow Rules

- Do not place unrelated fields in the same step.
- Do not hide validation until the end if it can be shown earlier.
- Do not ask for secondary details before the primary decision is secure.
- Do not allow progress ambiguity.
- Do not overload review steps with editing complexity that belongs inside earlier steps.

## Required States

Every meaningful screen or flow must have defined behavior for:

- loading
- empty
- error
- saving
- saved
- success

Rules:

- Loading should reassure progress without visual chaos.
- Empty should explain what is missing and what to do next.
- Error should explain impact and recovery.
- Saving should reduce uncertainty during persistence.
- Saved should confirm persistence without forcing interruption.
- Success should confirm outcome and expose the next relevant action.

## Modern Forms

- Forms must be chunked by intent.
- Labels must be explicit and compact.
- Validation should be timely and actionable.
- Defaults should reduce friction but never create hidden risk.
- Required fields should be obvious before submission.
- Review states should summarize what matters, not duplicate the full form blindly.
- Autofill, suggestion, and formatting behaviors must remain predictable.
- In mobile/iPad, opening a form should expose the first real field immediately, not a long preamble of support surfaces.

## Accessibility

- Keyboard navigation must remain functional.
- Focus order must match visual order.
- Contrast must support readability in all states.
- Touch targets must be large enough for mobile.
- Motion should respect reduced-motion preferences where implemented.
- Error messages must be tied to their fields and understandable without color.
- Screen-reader semantics should be preserved as the UI evolves.

## Privacy From The UI

- Show only the data needed for the current decision.
- Avoid exposing sensitive data in crowded list views when a detail view is safer.
- Make irreversible or sensitive actions explicit.
- Do not normalize unsafe confirmation patterns.
- Internal operational confidence must not be presented as external truth.

## Rules For AI And Autosuggestions

- AI assists; it does not silently decide critical business outcomes.
- Suggestions must be clearly distinguishable from confirmed values.
- Confidence, uncertainty, or limits must be communicated when relevant.
- AI must not impersonate accounting, legal, or fiscal certainty.
- Autosuggestions must be easy to review, edit, or reject.
- Critical final decisions remain user-owned.

## Visual QA Checklist

- Does the first viewport show the current decision clearly?
- Is there one obvious primary action?
- Are blocks grouped by intent rather than by implementation source?
- Are states visually distinct and understandable?
- Is the page calm on mobile?
- Is any KPI decorative rather than useful?
- Are warnings proportional to real severity?
- Does text explain implication and next action, not internal mechanics?

## Technical Checklist

- Does the UI preserve the current route and data contracts unless explicitly targeted?
- Are states represented explicitly instead of implied by missing UI?
- Is StepFlow structure reusable rather than ad hoc?
- Are accessibility semantics preserved?
- Are visual tokens consistent?
- Is the implementation scope isolated and reversible?

## Definition Of Done

A UI task is not done unless:

- the screen has one dominant decision
- the primary action is unambiguous
- mobile-first behavior is credible
- required states are handled
- StepFlow is used where the flow complexity requires it
- visual hierarchy is calm and obvious
- accessibility basics are respected
- the implementation passes the repository quality gates
