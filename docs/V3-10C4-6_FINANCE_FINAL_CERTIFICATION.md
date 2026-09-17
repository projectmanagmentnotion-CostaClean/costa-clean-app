# V3-10C4.6 — Final finance certification

Status: `CLOSED / CERTIFIED`

Starting HEAD: `dadcfd1a146d3dd4735ba454aec09b6ade28f597`

## Scope reconciliation

C4.1 established shared finance hierarchy, C4.2 certified Invoices, C4.3
certified Quotes, C4.4 certified Payments and C4.5 certified Expenses. C4.6
audits those slices as one V3 Finance area and makes only one cross-module
presentation correction: related-record selectors no longer render a raw UUID
when a display code is missing. Their internal option values remain unchanged.

No invoice, quote, payment or expense business operation was invoked. No
production request, production mutation, QA business mutation, Supabase schema
or policy change, migration, storage change or C5 implementation occurred.

## Final findings reconciliation

The original C4 ledger contains 13 P1–P3 items. Final disposition is:

| State | Count | Result |
| --- | ---: | --- |
| Fixed | 13 | All C4 ledger items are resolved by C4.1–C4.6 implementation or verified presentation evidence. |
| N/A | 0 | No ledger item was closed by calling it N/A. |
| Still open | 0 | No finance issue blocks C4 closure. |

Runtime N/A states are distinct from findings: the QA dataset has no visible
Quote or Payment records, so those workspaces, conversion, payment provenance
on a persisted row and their document actions were not fabricated. The QA
Expense has no attachment, so attached-document and signed-URL failure states
remain N/A; private signed URL, MIME, 10 MB and no-data-loss behavior remain
covered by focused local contracts.

## Protected contracts

- Invoice settlement remains guarded by `canSettleInvoiceByTransfer`,
  `settleInvoiceByTransfer` and `settle_invoice_by_transfer`; the UI has no
  direct paid-status path and keeps partial settlement semantics.
- Quote acceptance/conversion remains governed by `acceptQuoteWorkflow`,
  `accept_quote_workflow` and existing duplicate protection.
- `PaymentCreateFlow`, payment persistence and invoice refresh remain intact;
  `transfer_auto` is described only as provenance, never reconciliation or
  settlement proof.
- Expense create/edit persistence, duplicate/dirty guards, private signed URLs,
  the 10 MB constraint and receipt replacement cleanup order remain intact.

The C4 diff contains no changed protected Finance API, receipt-workflow,
storage, Supabase or financial-write file.

## Authenticated read-only replay

The canonical `costaclean-v3` QA profile was reused at
`http://127.0.0.1:4178/?v3=1` without inspecting or copying session data.
The final authorized matrix covered `320x568`, `390x844`, `768x1024` and
`1440x900`.

| Surface | Result |
| --- | --- |
| Invoices | List, search match/miss/clear, filter Escape/focus, workspace, deep-link reload and Back passed. The generic four-viewport report observed the populated workspace at 320/390/768; its 1440 list sample completed before rows hydrated, so the 1440 workspace evidence is the focused C4.2 read-only replay. Settlement confirmation and PDF/More affordances were inspected without confirmation or download side effects. |
| Quotes | List, empty state and filter Escape/focus passed. Workspace/conversion/PDF are N/A: zero visible Quote rows. |
| Payments | List and empty state passed. Workspace, persisted origin wording and payment actions are N/A: zero visible Payment rows. |
| Expenses | List, search match/miss/clear, workspace, deep-link reload and Back passed. Attached-document and signed-URL failure states are N/A: the visible expense has no attachment. |

Across each replayed visible surface: overflow, visible and accessible UUIDs,
Unicode-as-icon, legacy markers, broken assets, clipped financial values,
undersized relevant controls, console errors, page errors and failed critical
requests were `0`. One empty-URL CDP `Document` abort occurred while replacing
the target during the Invoice replay; the next navigation completed and it was
not an application request.

The first independent read identified that the native Expense file picker was
a visually-hidden `1x1` input but still present in the keyboard path. C4.6
corrects that actual accessibility defect without changing upload behavior: the
picker is now `tabIndex={-1}` and `aria-hidden="true"`; the labelled visible
`V3PrimaryAction` remains the sole keyboard and 44px interaction target. The
replayed runtime report records zero visible undersized controls at every
viewport and explicitly records the hidden picker only as an excluded native
implementation detail. `V3ExpenseWorkspace.test.ts` covers that contract.

Private screenshots and the sanitized runtime report remain ignored under the
QA evidence directories.

## Validation

- Focused Finance contracts and presentation suite: `40` passed before the
  accessibility remediation; the focused Expense Workspace and raw-identifier
  tests then passed: `4` passed.
- Full suite: `841` passed, `4` skipped.
- Agent validator: `294/294` passed.
- Lint: passed.
- Build: passed.
- `git diff --check`: passed.
- Independent final Finance review: `PASS`, with P0/P1/P2/P3 all `0`. Its
  private structured artifact is
  `.project-agent/private/c4-6-independent-host-review.md`; it independently
  ran `npm test` and observed `841` passed, `4` skipped.

## Remaining scope

C4.6 and the complete C4 Finance refinement are closed/certified. C5
preparation remains complete; C5 product implementation has not started.
