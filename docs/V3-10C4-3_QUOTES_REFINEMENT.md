# V3-10C4.3 — Quotes and Quote Workspace

Status: `CLOSED / CERTIFIED`

This bounded refinement improves the V3 Presupuestos list and workspace without changing quote persistence, acceptance, conversion, duplicate review, PDF generation, selection exports, relationships, auth or Supabase.

## Scope and protected contracts

The following remain unchanged:

- `acceptQuoteWorkflow` and `accept_quote_workflow`;
- `canConvertQuoteToInvoice` and its duplicate-invoice protection;
- quote totals, IVA, numbering and persistence;
- the existing PDF/share callbacks and ZIP/CSV selection callbacks;
- client, lead, property, job and invoice relationship navigation.

The implementation adds `quotePresentation.ts`, a pure presentation layer that reads the existing conversion guard. It never supplies a second conversion path or changes a status directly.

## Presentation decisions

- Quote identity now leads the workspace header; the commercial status is a separate semantic status element.
- Base, IVA and Total are a single labelled financial summary. The total is visually distinguished without recalculating any value.
- A conversion-capable quote offers one primary action: `Aceptar y crear factura`, or `Crear factura vinculada` when it is already accepted.
- The action opens the existing shared confirmation sheet. The sheet explains that confirmation accepts the quote when necessary and creates one real, linked invoice using the existing lines and amounts. No conversion is performed until its primary button is pressed.
- A quote with an existing active invoice explains that it is already linked instead of presenting a duplicate conversion action.
- PDF stays a direct secondary action. Edit and share are grouped under `Más acciones`, reducing competing workspace actions.
- Quote rows retain their compact identity/context/status scan and now label Base and IVA next to the primary total.

## Forms and duplicate review

Quote create/edit flows and `V3DuplicateReviewSheet` were inspected but were not changed: no source-level defect justified changing their established field, review or persistence ordering in this slice. Existing duplicate review, ignore and reopen wiring remains intact.

## Tests and static verification

Focused component and presentation tests verify:

- Base, IVA and Total are labelled separately;
- an eligible quote explains the accept-and-linked-invoice outcome before the callback can run;
- a linked invoice removes the duplicate conversion affordance and supplies a human-readable explanation;
- the workspace retains direct PDF and secondary More actions;
- the existing `canConvertQuoteToInvoice` guard suite continues to cover an existing invoice, missing lines and rejected status.

`npm test`, `npm run qa:agents`, `npm run lint`, `npm run build` and `git diff --check` pass for this slice.

## Authenticated read-only QA

The canonical QA profile at `http://127.0.0.1:4178/?v3=1` was authenticated and replayed at `390x844`, `768x1024` and `1440x900`.

The current QA baseline contains zero visible quote rows. Accordingly, Quote Workspace, conversion confirmation, More actions, PDF invocation, selection and relationship navigation are `N/A — no existing QA quote`, not fabricated PASS results. No quote was created, accepted or converted for certification.

At all three viewports the real Quote List passed: authenticated shell, no horizontal overflow, relevant controls at least `44x44` CSS px, no visible or accessible UUID, no Unicode-as-icon, no legacy marker, no broken image, no console/page error and no critical failed request. The only CDP failure event was an empty-URL `Document` abort caused by target replacement before the successful local navigation; it was not a critical application request.

Production requests/mutations and QA mutations were `0`.

## Independent quality gate

The independent `pr-quality-gate` completed a read-only inspection of the
actual C4.3 diff and returned `PASS`; its ignored private artifact is
`qa-reports/private/v3-10c4-3-independent-review.json`. It found no P0 or P1
issues and confirmed that conversion guards, duplicate protection, totals,
persistence, document callbacks, routes and Supabase contracts were unchanged.

The reviewer recorded the missing visible QA quote workspace and two future
presentation follow-ups (large localized currency values and quote-line
hydration state) as non-blocking P2 scope. They do not alter this bounded
certification, and no new quote fixture or business mutation was created.

C4 remains open. C4.4 Payments, C4.5 Expenses and C4.6 cross-module
certification are not started by this document.
