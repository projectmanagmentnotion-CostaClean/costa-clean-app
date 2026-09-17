# V3-10C4 — FINANCE FINDINGS LEDGER

Status: `C4.1–C4.5 CLOSED / C4.6 NOT STARTED`

Audited HEAD: `d783567f60ef87195fccb7dc34358a7bfd5c3f1f`

This is a planning ledger, not a defect declaration. Objective defects and
visual/UX refinement opportunities are intentionally separated. No product
file, business contract, Supabase object or QA business data changed while
collecting this evidence.

## C4.1 resolution status

| Finding | Status after C4.1 | Evidence / boundary |
| --- | --- | --- |
| F-C4-P1-001 | FIXED / VERIFIED IN C4.4 | Payment origin wording is business-meaning specific; C4.1 deliberately did not alter `transfer_auto` presentation or persistence. |
| F-C4-P1-002 | STILL OPEN — C4.2 | Invoice settlement copy and guard explanation remain untouched; C4.1 only establishes the shared action grouping around the existing callback. |
| F-C4-P2-001 | FIXED | All four finance lists now render their find controls before a shared supporting KPI summary. Authenticated QA confirms the geometric order at 390x844, 768x1024 and 1440x900. |
| F-C4-P2-003 | PARTIALLY FIXED | Invoice action controls now use the shared finance action group, with one mobile-primary lane. Settlement meaning and duplicated financial reading remain C4.2 work. |
| F-C4-P2-004 | STILL OPEN — C4.3 | Quote financial/conversion explanation requires quote-specific state treatment. |
| F-C4-P2-005 | FIXED / VERIFIED IN C4.4 | Payment header/list hierarchy uses shared controls and action grouping. Payment scan order and provenance wording are C4.4 scope. |
| F-C4-P2-006 | FIXED / VERIFIED IN C4.5 | Expense detail now uses one primary next action, a single financial reading order and one document/review group without a duplicate sticky CTA. |
| F-C4-P2-007 | FIXED / VERIFIED FOR EXPENSES IN C4.5 | The Expense create/edit presentation is grouped by identity, amount, support/review and notes without changing payloads or persistence order. |
| F-C4-P3-001 | PARTIALLY FIXED | Shared header action group, controls-before-summary order and supporting KPI treatment now cover all four lists. Module-specific list rows remain later batch work. |
| F-C4-P3-002 | FIXED / VERIFIED FOR EXPENSES IN C4.5 | Expense Workspace presents Base imponible → IVA → Total in a single labelled summary. |
| F-C4-P3-003 | FIXED / VERIFIED FOR EXPENSES IN C4.5 | Private-document actions explicitly say Abrir, Sustituir, Eliminar or Añadir documento without exposing storage paths. |
| F-C4-P3-004 | PARTIALLY FIXED | All four list pages use shared `V3EmptyState` and `V3ErrorState`. Finance-specific document, guard and permission copy remains later batch work. |

## C4.2 invoice resolution status

The C4.2 implementation is intentionally limited to the Invoice list and
Invoice Workspace. It does not alter invoice persistence, calculations, PDF
generation, selection exports, settlement RPCs or any Supabase object.

| Finding | Status after C4.2 implementation | Evidence / boundary |
| --- | --- | --- |
| F-C4-P1-002 | FIXED / VERIFIED | Eligible invoices now use the accurate action label `Registrar cobro`, expose total/cobrado/pendiente before confirmation, and require the existing confirmation surface. The sole callback remains the established guarded settlement callback. Final read-only QA passed at 390, 768 and 1440. |
| F-C4-P2-002 | FIXED / VERIFIED | Rows use the shared financial facts helper to render `Total`, `Cobrado` and `Pendiente` in semantic scan order. No financial calculation changed. |
| F-C4-P2-003 | FIXED / VERIFIED | The workspace puts invoice identity first, separates status, consolidates the three financial values, gives settlement one primary lane, and moves edit/document controls behind a secondary `Más acciones` sheet. PDF remains directly available. |
| F-C4-P2-007 | N/A FOR C4.2 | Invoice create/edit flows remain contract-preserving and unchanged; no C4.2 form defect was found. The finance-wide form grouping review remains scoped to C4.3–C4.5. |
| F-C4-P3-002 | FIXED / VERIFIED FOR INVOICES | Invoice list and workspace now use total → paid → outstanding as the concise monetary reading order. Quote, Payment and Expense surfaces remain open. |
| F-C4-P3-003 | PARTIALLY FIXED | Invoice uses explicit `Descargar PDF` and `Ver documento` labels. Other finance-module vocabulary remains open. |

### C4.2 authenticated replay evidence

The final read-only authenticated replay passed list, filter, workspace,
confirmation without submission, `Más acciones`, PDF/document affordances,
deep-link reload and Back at `390x844`, `768x1024` and `1440x900`. The target
shell was authenticated throughout; no credentials, cookies, tokens or storage
contents were read, copied or changed. No financial action was confirmed.

Production requests/mutations and QA mutations were `0`. Console/page errors,
horizontal overflow, undersized actions, clipped financial values, UUIDs,
Unicode-as-icon, legacy markers and broken images were `0`. Two blank CDP
`Document` abort events during target replacement were not critical requests:
they had no URL and each was followed by successful app navigation.

## C4.3 quote resolution status

The C4.3 implementation is intentionally limited to Quote list/workspace presentation. It does not alter quote persistence, acceptance/conversion, duplicate review, PDF/share, exports or Supabase.

| Finding | Status after C4.3 | Evidence / boundary |
| --- | --- | --- |
| F-C4-P2-004 | FIXED / VERIFIED | Quote identity, status and Base/IVA/Total are separated. The sole primary conversion action now explains the existing accept-and-linked-invoice outcome in a shared confirmation sheet and reports an existing linked invoice instead of offering duplicate conversion. `canConvertQuoteToInvoice`, acceptance and duplicate review remain unchanged. |
| F-C4-P2-007 | N/A FOR C4.3 | Quote create/edit flows were inspected but no source-level field grouping defect justified altering their established persistence order. Finance form review remains C4.4–C4.5 work. |
| F-C4-P3-002 | FIXED / VERIFIED FOR QUOTES | Quote rows and workspace label Base, IVA and Total in a single semantic reading order. No financial calculation changed. |
| F-C4-P3-003 | FIXED / VERIFIED FOR QUOTES | `Descargar PDF`, `Editar presupuesto` and `Compartir presupuesto` are explicit action labels; PDF remains a direct action and secondary actions are grouped. |

### C4.3 authenticated replay evidence

The authenticated, read-only Quote List replay passed at `390x844`, `768x1024` and `1440x900`: no overflow, undersized relevant control, UUID, Unicode-as-icon, legacy marker, broken image, console/page error or critical failed request. Production requests/mutations and QA mutations were `0`.

The QA baseline contained zero visible quote rows, so Quote Workspace, conversion confirmation, PDF invocation, selection and related navigation were recorded `N/A — no existing QA quote`; no certification fixture or conversion was created. Empty-URL CDP Document aborts during target replacement were not critical requests and were followed by successful local app navigation.

### C4.3 independent review

`pr-quality-gate` independently reviewed the actual C4.3 dirty diff and
returned `PASS`; the structured private artifact is
`qa-reports/private/v3-10c4-3-independent-review.json`. It found no P0/P1
findings and confirmed the protected conversion, duplicate, financial,
document, route and Supabase contracts remain unchanged. The unavailable
workspace replay and potential extreme-value/hydration presentation refinements
remain non-blocking follow-up scope.

## C4.5 expense resolution status

The C4.5 implementation is limited to the V3 Expenses Workspace, the existing
V3 create/edit sheet and expense-specific presentation CSS. It does not change
expense APIs, persistence payloads, duplicate detection, fiscal calculations,
private storage, signed URL creation, size validation, permissions or Supabase.

| Finding | Status after C4.5 | Evidence / boundary |
| --- | --- | --- |
| F-C4-P2-006 | FIXED / VERIFIED | The workspace has one primary action per existing state, no duplicate sticky CTA, a labelled Base/IVA/Total summary, a concise context group and one document/review group. |
| F-C4-P2-007 | FIXED / VERIFIED FOR EXPENSES | The existing form fields and submit sequence are grouped as Identificación, Importe e impuestos, Soporte y revisión and Notas. The same payload, duplicate guard and persist-then-optional-upload sequence remain intact. |
| F-C4-P3-002 | FIXED / VERIFIED FOR EXPENSES | Base imponible → IVA → Total uses labelled, tabular-numeric values in Workspace; the calculated form total uses the same hierarchy. |
| F-C4-P3-003 | FIXED / VERIFIED FOR EXPENSES | The document controls use explicit intent labels and keep the existing signed-URL callback private. |

### C4.5 authenticated read-only replay evidence

The canonical `costaclean-v3` QA profile at `http://127.0.0.1:4178/?v3=1`
passed Expense list, search match/miss/clear, non-submitting create-sheet
open/Escape/focus return, Workspace, deep-link reload and Back at `320x568`,
`390x844`, `768x1024` and `1440x900`. The available workspace showed one
primary action, no sticky duplicate and a visible Base/IVA/Total summary.

At every replayed size, overflow, undersized relevant controls, clipped
financial values, visible/accessible UUIDs, Unicode-as-icon, legacy markers,
broken images, console errors, page errors, critical failed requests,
production requests/mutations and QA business mutations were `0`. The QA row
had no attachment, so signed-URL open, attached-document and expired/failure
runtime states are `N/A` without creating or modifying a business record.
Focused local attachment/receipt workflow tests retain the private signed URL,
type/10 MB and no-data-loss contracts. Private screenshots and the local QA
replay script are ignored and excluded from source control.

## P0 — objective blockers

None found in the bounded read-only inspection. This is not a release or C4
certification result; future implementation and runtime gates remain required.

## P1 — safety or business-meaning clarity

| ID | Type | Surface / state | Reproduction and root cause | Likely files | Expected correction | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |
| F-C4-P1-001 | Objective meaning ambiguity | Payments list/workspace; `origin_type=transfer_auto` | Existing labels said `Automatico por transferencia` / `Origen automático`; protected behavior explicitly defines this as provenance, not reconciliation. | `src/v3/payments/V3PaymentsPage.tsx`, `V3PaymentRow.tsx`, `V3PaymentWorkspace.tsx`, `paymentPresentation.ts` | FIXED / VERIFIED — source and focused tests use explicit provenance wording. The QA baseline has no visible payment, so workspace wording on a persisted `transfer_auto` row is honestly `N/A` without a fixture. The final V6 independent gate passed without a QA write. | No text claims automatic reconciliation; generated records remain read-only; `savePaymentAndRefreshInvoice` contract is unchanged. |
| F-C4-P1-002 | Objective action-safety ambiguity | Invoice list/workspace, issued invoice with outstanding balance | The guarded action is rendered as `Marcar pagada` while the true operation is a transfer settlement with eligibility, outstanding amount and partial-payment semantics. | `src/v3/invoices/V3InvoicesPage.tsx`, invoice workspace/row, existing settlement tests | Explain eligibility, outstanding amount and outcome; preserve the current guarded callback. | `canSettleInvoiceByTransfer`, `settleInvoiceByTransfer` and `settle_invoice_by_transfer` are unchanged; no direct paid-state mutation; disabled/partial/terminal states are explicit. |

## P2 — meaningful operational or composition refinements

| ID | Type | Surface / viewport | Reproduction and root cause | Likely files | Expected correction | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |
| F-C4-P2-001 | Visual/UX refinement | Invoice and Quote lists, 390x844 and wider | KPI group appears before the primary find/open controls, placing analytics before the routine lookup task. | `V3InvoicesPage.tsx`, `V3QuotesPage.tsx` | Reorder or visually demote secondary KPIs without losing the data. | Search/open path is visible before secondary analytics at mobile; desktop retains useful summary without card-wall regression. |
| F-C4-P2-002 | Visual/UX refinement | Invoice list row | Total and status scan quickly, but outstanding balance is not equally available despite settlement being a core task. | `V3InvoicesPage.tsx` | Give outstanding/paid context a semantic secondary line. | Invoice number/client/primary total/status/outstanding follow one readable order; no calculation changes. |
| F-C4-P2-003 | Visual/UX refinement | Invoice workspace, 768x1024 read-only observation | Settlement, edit, download and document actions compete at the same hierarchy, while financial reading repeats across summary areas. | `V3InvoicesPage.tsx`, shared workspace/action primitives if necessary | Establish one primary next action and group document/secondary controls. | Issued/partial/paid/cancelled states communicate safe next action; all callbacks and PDF engine remain unchanged. |
| F-C4-P2-004 | Visual/UX refinement | Quote workspace and conversion states | Base/IVA/total repeat and conversion availability is not sufficiently explanatory in static source. | `V3QuotesPage.tsx`, `V3DuplicateReviewSheet.tsx` | Consolidate financial reading and explain accepted/already-converted/unavailable states. | `canConvertQuoteToInvoice`, duplicate review and acceptance/conversion behavior are unchanged. |
| F-C4-P2-005 | Visual/UX refinement | Payment list/workspace | Relation was available, but amount/date/method/origin competed and there was no V3 type filter. | `V3PaymentsPage.tsx`, `V3PaymentRow.tsx`, `V3PaymentWorkspace.tsx` | FIXED / VERIFIED FOR AVAILABLE QA DATA — local filtering exposes only existing origin values and passed at three viewports; workspace grouping is honestly `N/A` because QA has no visible payment. The final V6 independent gate passed. | No speculative backend filter or reconciliation state is added; relation and manual/generated protections remain intact. |
| F-C4-P2-006 | Visual/UX refinement | Expense workspace and form | Summary, attachment, fiscal, payment, data and notes sections coexist with both top and sticky actions. | `V3ExpenseWorkspace.tsx`, `V3ExpenseFormFlow.tsx` | Group document/review work and establish a single primary next action per state. | Private signed URL, 10 MB/type validation, dirty guard, duplicate guard and no-data-loss ordering remain unchanged. |
| F-C4-P2-007 | Visual/UX refinement | Finance create/edit flows, mobile | Line editors, reviews, fiscal fields and document controls are dense before a controlled mobile replay. | V3 invoice/quote/payment/expense create/edit flows | Improve grouping and review order in bounded module batches. | First actionable input, labels, error order, dirty guard and touch targets meet runtime acceptance without changing persistence payloads. |

## P3 — polish, consistency or evidence follow-up

| ID | Type | Surface / state | Reproduction and root cause | Likely files | Expected correction | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |
| F-C4-P3-001 | Visual consistency | All finance lists | Search/filter/control compositions are related but not identical. | Four V3 page components and existing shared primitives | Adopt the C2-finance hierarchy convention in C4.1. | Shared control order is consistent where the capability exists; no unrelated global redesign. |
| F-C4-P3-002 | Visual consistency | Lists and workspaces | Amounts use differing orders for total, paid, outstanding, base and IVA. | Four V3 finance modules, formatting helpers | Define one module-level monetary reading order. | Meaningful label accompanies every amount; no totals/IVA calculation change. |
| F-C4-P3-003 | Visual consistency | Invoice/Quote/Expense document actions | Functional labels vary between download/open/replace/add. | Finance V3 workspaces and document adapters | Normalize vocabulary by intent while keeping callbacks. | Accessible names state the action and target; PDF/export/private-media behavior remains unchanged. |
| F-C4-P3-004 | Evidence / composition opportunity | Empty Quote/Payment pages and desktop 1440x900 | Current QA data exposes empty states; desktop whitespace is calm but can be composed more intentionally during C4. | Quote/Payment pages and empty-state primitive | Refine only if it improves task guidance using existing actions. | No fabricated metrics, no marketing illustration, no loss of clear create path. |

## Read-only runtime evidence boundary

The authenticated QA review at `390x844`, `768x1024` and `1440x900` found
zero horizontal overflow, visible UUIDs, legacy/V2 markers, broken images and
visible undersized interactive controls across the four list surfaces. It did
not activate documents, forms, settlement, conversion, duplicate review or
payment/expense writes. Quote and Payment workspaces were unavailable from
the current read-only QA dataset. These are C4 implementation/replay items,
not failures of the preparation audit.
