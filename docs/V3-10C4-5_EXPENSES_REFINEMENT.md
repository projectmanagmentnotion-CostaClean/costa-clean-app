# V3-10C4.5 — Expenses refinement

Status: `CLOSED / CERTIFIED`

Starting HEAD: `1705750781303cd13b92dae30c0bb412a052b8bf`

## Completed scope

C4.5 refines only the V3 Expenses presentation. The operational model remains
List → Expense → full-screen Workspace → action → Back.

- Workspace identity, amount and date remain first; Base imponible, IVA and
  Total now form one labelled financial summary.
- Context is condensed to category, payment and reference; duplicate supplier,
  payment, fiscal and data blocks were removed.
- Document state and fiscal review now share one section with explicit action
  names. There is one primary next action per existing state and no duplicate
  sticky action.
- The create/edit sheet groups the existing fields as Identificación, Importe
  e impuestos, Soporte y revisión and Notas. It states the accepted document
  types and existing 10 MB limit without adding a new upload mechanism.

## Protected contracts

No write or security contract changed:

- `createExpense`, `updateExpense`, `updateExpenseAttachment` and duplicate
  detection keep their existing inputs and persist-then-optional-upload order.
- `uploadExpenseReceipt`, `createExpenseReceiptSignedUrl`,
  `replaceExpenseReceipt` and `deleteExpenseReceipt` remain unchanged.
- The private `expense-receipts` bucket, signed URL access, accepted MIME
  types, 10 MB validation and no-data-loss cleanup behavior remain unchanged.
- No Supabase schema, policy, bucket, production setting or business data was
  changed.

## Regression coverage

- `V3ExpenseWorkspace.test.ts` checks the Base/IVA/Total reading order, one
  primary next action and explicit document controls.
- `V3ExpenseFormFlow.test.ts` checks semantic form grouping and private/10 MB
  document guidance.
- Existing attachment and receipt-workflow tests retain type/size validation,
  signed URL use and pointer-before-old-object cleanup semantics.

## Authenticated read-only QA

The canonical persistent QA profile was reused at
`http://127.0.0.1:4178/?v3=1` without reading, copying or printing session
data. At `320x568`, `390x844`, `768x1024` and `1440x900`, the available
Expenses list and workspace passed search match/miss/clear, non-submitting
create-sheet Escape/focus restoration, deep-link reload and Back.

The Workspace displayed a single primary action and no sticky duplicate. The
Base/IVA/Total summary, document/review grouping and explicit document action
were visible. Overflow, undersized relevant controls, clipped money, UUIDs,
Unicode-as-icon, legacy markers, broken assets, console/page errors and
critical failed requests were `0`. Production requests/mutations and QA
business mutations were also `0`.

The available QA expense had no attachment. Attached-document, signed URL open
and signed-URL failure states are therefore `N/A` rather than fabricated; the
private contract remains covered by focused local tests. Screenshots and the
runtime script remain ignored under the private QA evidence directories.

## Remaining scope

V3-10C4 remains open. C4.6 cross-module certification has not started.

## Independent quality gate

The detached independent reviewer reviewed the final uncommitted C4.5 diff and
returned `PASS` with no P0–P3 findings. It verified the single labelled
Base/IVA/Total reading order, focused regression coverage and all protected
persistence, attachment and storage boundaries before publication.
