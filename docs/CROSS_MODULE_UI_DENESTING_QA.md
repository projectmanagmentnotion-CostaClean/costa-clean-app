# Cross-module UI De-nesting QA

## Scope

Cross-module authenticated visual QA for mobile and iPad, focused on de-nesting, compact actions, filter density, and immediate form visibility.

Protected scope remained intact:

- no Supabase changes
- no SQL or migrations
- no auth changes
- no `?view=` contract changes
- no `appDataApi` or `financialWriteApi` changes
- no numbering, fiscal, or persistence logic changes

## Viewports used in live QA

- `390x844`
- `768x1024`
- desktop baseline `1280x720`

## Modules reviewed in the live app

- `dashboard`
- `clients`
- `properties`
- `payments`
- `fiscal_closing`
- create overlays for `Nuevo cliente` and `Registrar cobro`
- detail/workspace reads for `payments` and `properties`

## Real problems found

- `PaymentCreateFlow` still buried the first actionable field below the initial viewport in mobile.
- Detail screens still carried inherited box-heavy composition in mobile/iPad.
- Shared create-flow shells still used too much contextual framing before the form.
- Tablet shell navigation still caused horizontal overflow even after mobile fixes.

## Corrections applied

- `PaymentCreateFlow` now places `Factura *` first so the form becomes actionable immediately.
- `PaymentDetailCard` and `PropertyDetailCard` use overlay editing in mobile/tablet.
- Shared detail CSS flattens secondary summaries, rows, and relation sections into a single main surface.
- Shared visual header and KPI styles were compacted for mobile/iPad.
- Shared create-flow surfaces were reduced in padding, radius, and ornamental context weight.
- Tablet shell navigation now clips and scroll-contains its horizontal rail instead of expanding page width.

## Live verification results

### Mobile `390x844`

- No horizontal scroll found in `dashboard`, `clients`, `properties`, `payments`, or `fiscal_closing`.
- `Registrar cobro` now opens with first field visible at `top 562`.
- `Nuevo cliente` opens with first field visible at `top 224`.
- `payments` detail shows `1` main detail card, `0` nested detail cards, `0` summary-card nests in the verified surface.
- `properties` detail shows `1` main detail card, `0` nested detail cards, with summary reduced to a flatter read.

### iPad `768x1024`

- A real horizontal overflow was detected first: `scrollWidth 1366` with `innerWidth 768`.
- Root cause was the shell top navigation and rail expanding beyond viewport width.
- After the shell fix, audited modules returned `scrollWidth 753` with `innerWidth 768`, removing the horizontal overflow.
- `Registrar cobro` also remains visible immediately on iPad with first field visible.

### Desktop baseline `1280x720`

- Basic sanity check stayed within width (`scrollWidth 1265` for `width 1280`).

## Residual debt

- `clients` workspace still needs a dedicated live pass focused only on the client detail block after entering a stable client workspace state.
- `dashboard` and `fiscal_closing` are denser than before but can still lose another layer of support copy in later passes.
- Remaining modules not live-verified in depth this turn:
  - `quotes`
  - `expenses`
  - `jobs`
  - recurrent modules if present

## Permanent guardrails reinforced

- one block = one visual surface
- first field visible immediately after opening create/edit in mobile/iPad
- secondary actions under `Mas` before growing button rows
- debug must not coexist with equivalent operational cards
- shell and module top bars must be checked against real `390x844` and `768x1024`

## Harness Follow-up

- Future authenticated re-runs of this QA can use the local harness in `docs/AUTHENTICATED_VISUAL_QA_HARNESS.md` when the embedded browser is not stable enough.
- The harness already completed one authenticated run across `390x844`, `768x1024`, and `1366x900`, providing a reusable base for future de-nesting audits.
