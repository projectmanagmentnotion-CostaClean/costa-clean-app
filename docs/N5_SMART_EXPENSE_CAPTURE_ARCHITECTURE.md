# N5.1 Smart Expense Capture — architecture audit

## Scope and isolation

This document belongs only to the Costa Clean internal app and the branch
`codex/post-v3-n5-smart-expense-capture`, based on N4 closeout commit
`03469d93ac90999ee4f35690f473bef48299b3b7`. It does not cover Portal,
CP5.1, RC3, public web, unrelated N2–N9 work, or Production.

N5.1 is a document-first capture foundation. It does not perform OCR, call an
LLM, match suppliers, or create an expense when a document is selected.
Manual expense creation remains the canonical path and remains available from
the first capture screen.

## Current implementation inventory

| Area | Current implementation | N5.1 disposition |
| --- | --- | --- |
| V3 expense list/detail | `src/v3/expenses/V3ExpensesPage.tsx`, `V3ExpenseWorkspace.tsx` | REUSE; keep list/detail contracts unchanged |
| Manual create/edit flow | `src/v3/expenses/V3ExpenseFormFlow.tsx` and `src/features/expenses/ExpenseCreateFlow.tsx` | REUSE; manual route must open the existing flow |
| Expense persistence | `src/features/expenses/expenseApi.ts` | REUSE; no second expense writer |
| Existing receipt storage | `src/features/expenses/expenseAttachmentsApi.ts` and `expenseReceiptWorkflow.ts` | HARDEN only; preserve final `expense-receipts/expenses/...` paths |
| Duplicate engine | `src/features/duplicates/duplicateEngine.ts` | REUSE; N5.1 stores SHA for future layers, no redesign |
| Authenticated Supabase client | `src/lib/supabase.ts`, `supabaseRest.ts` | REUSE; no secrets or service-role client |
| Internal authorization | existing `app_private` helper contract in product migrations | REUSE in controlled capture RPCs |
| Temporary capture session/document model | not present before N5.1 | NEW; RLS-protected tables and controlled RPCs |
| Temporary capture storage namespace | not present before N5.1 | NEW; isolated `captures/<session>/<sha256>` paths |
| Capture route selector and preview | not present before N5.1 | NEW; compact V3 surface with camera/upload/manual choices |
| OCR/AI extraction | not present as a truthful N5.1 capability | OUT OF SCOPE; explicitly deferred |

## Safety contracts

- Selecting or uploading a file creates only a temporary capture session and
  capture document; it never inserts into `public.expenses`.
- Manual creation calls the existing expense creation contract unchanged.
- Capture ownership is derived server-side from `auth.uid()` and active
  internal-staff membership.
- Storage upsert is scoped by a dedicated owner/session UPDATE policy; it is
  not a bucket-wide authenticated write permission.
- `service_role` receives only the table privileges required for controlled
  backend administration/QA teardown; authenticated users receive no direct
  table writes.
- Capture idempotency is enforced by a database uniqueness constraint, not by
  a disabled button alone.
- File type, size, empty-file, filename and path checks are shared/hardened;
  SHA-256 is calculated from bytes and persisted.
- Cancel is explicit and auditable. Temporary objects are removed only by the
  exact QA-safe cleanup path or the documented expiry policy.
- `HEIC/HEIF = DEFERRED_N5`; no conversion dependency is introduced.
- Production migrations, writes, storage uploads and deployments are out of
  scope for N5.1.

## Verification boundary

The product migration is present and statically reviewed on this branch. It
was not applied to a remote QA project in this work block: no authenticated QA
migration gate was provided, so remote schema changes and capture fixtures
remain pending the dedicated QA certification gate.
